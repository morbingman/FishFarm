import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { notify } from '../common/notifications.js';
import { CompanyService } from '../company/company.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  NotificationType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentPurpose,
  PaymentState,
  SaleMode,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CartLine } from './cart.service.js';
import { CartService } from './cart.service.js';
import type { CreateOrderDto, OrderFilter } from './dto/order.dto.js';

/** Balance is due this many days after the company marks a pre-order ready. */
export const BALANCE_WINDOW_DAYS = 7;

const ORDER_INCLUDE = {
  buyer: { select: { id: true, name: true, email: true, phone: true } },
  company: { select: { id: true, name: true, location: true } },
  items: {
    include: {
      listing: {
        include: {
          draft: { include: { images: { orderBy: { position: 'asc' as const } } } },
        },
      },
    },
  },
  payments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

type OrderRecord = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly company: CompanyService,
  ) {}

  // -------------------------------------------------------------------------
  // Checkout
  // -------------------------------------------------------------------------

  async create(buyer: AuthenticatedUser, dto: CreateOrderDto) {
    if (dto.idempotencyKey) {
      const replay = await this.prisma.payment.findUnique({
        where: { idempotencyKey: `order:${dto.idempotencyKey}:initial` },
        include: { order: { include: ORDER_INCLUDE } },
      });
      if (replay?.order) return this.toView(replay.order);
    }

    const lines = dto.items?.length
      ? await this.linesFromInput(dto.items)
      : await this.cart.checkoutLines(buyer.id);

    const saleModes = [...new Set(lines.map((line) => line.saleMode))];
    if (saleModes.length > 1) {
      throw new AppException('order.mixedSaleModes', HttpStatus.BAD_REQUEST);
    }
    const saleMode = saleModes[0] === SaleMode.pre_order ? SaleMode.pre_order : SaleMode.in_stock;

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const shippingFee = dto.shippingFee ?? 0;
    const total = subtotal + shippingFee;
    const depositAmount =
      saleMode === SaleMode.pre_order
        ? Math.round((total * this.depositPct(lines)) / 100)
        : null;
    const balanceAmount = depositAmount === null ? null : total - depositAmount;

    const company = await this.company.current();
    const order = await this.prisma.$transaction(async (tx) => {
      // Reserve stock first; a failed reservation aborts the whole transaction.
      for (const line of lines) {
        await this.reserveStock(tx, line);
      }

      const created = await tx.order.create({
        data: {
          code: await this.nextOrderCode(tx),
          buyerId: buyer.id,
          companyId: company.id,
          status: OrderStatus.paid,
          saleMode,
          paymentStatus:
            depositAmount === null ? OrderPaymentStatus.paid : OrderPaymentStatus.deposit_paid,
          subtotal,
          shippingFee,
          total,
          depositAmount,
          balanceAmount,
          paidAt: new Date(),
          recipientName: dto.recipientName,
          phone: dto.phone,
          address: dto.address,
          city: dto.city,
          province: dto.province,
          deliveryMethod: dto.deliveryMethod,
          items: {
            create: lines.map((line) => ({
              listingId: line.listingId,
              saleMode: line.saleMode === SaleMode.pre_order ? SaleMode.pre_order : SaleMode.in_stock,
              quantity: line.quantity,
              unitPrice: line.price,
              lineTotal: line.lineTotal,
            })),
          },
          payments: {
            create: {
              purpose:
                depositAmount === null ? PaymentPurpose.order_full : PaymentPurpose.order_deposit,
              method: dto.paymentMethod,
              idempotencyKey: dto.idempotencyKey
                ? `order:${dto.idempotencyKey}:initial`
                : `order:${randomUUID()}:initial`,
              amount: depositAmount ?? total,
              state: PaymentState.paid,
              paidAt: new Date(),
            },
          },
        },
        include: ORDER_INCLUDE,
      });

      if (!dto.items?.length) {
        await tx.cartItem.deleteMany({ where: { userId: buyer.id } });
      }

      await notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: 'notifications.admin.orderPlaced.title',
        titleParams: { code: created.code },
        bodyKey: 'notifications.admin.orderPlaced.body',
        bodyParams: { name: buyer.name, total: created.total },
        link: `#company/orders/${created.code}`,
      });
      await notify(tx, {
        userId: buyer.id,
        type: NotificationType.success,
        titleKey: 'notifications.buyer.orderPlaced.title',
        titleParams: { code: created.code },
        bodyKey: 'notifications.buyer.orderPlaced.body',
        bodyParams: { total: created.total },
        link: `#marketplace/orders/${created.code}`,
      });

      return created;
    });

    return this.toView(order);
  }

  // -------------------------------------------------------------------------
  // Customer view
  // -------------------------------------------------------------------------

  async listMine(userId: string, filter: OrderFilter = 'all') {
    await this.expireUnpaidBalances();

    const orders = await this.prisma.order.findMany({
      where: {
        buyerId: userId,
        ...(filter === 'all' ? {} : { status: filter }),
      },
      include: ORDER_INCLUDE,
      orderBy: { placedAt: 'desc' },
    });

    return orders.map((order) => this.toView(order));
  }

  async getMine(userId: string, id: string) {
    await this.expireUnpaidBalances();
    const order = await this.findOrder(id);
    if (order.buyerId !== userId) {
      throw new AppException('order.notFound', HttpStatus.NOT_FOUND);
    }
    return this.toView(order);
  }

  async cancelMine(userId: string, id: string) {
    const order = await this.findOrder(id);
    if (order.buyerId !== userId) {
      throw new AppException('order.notFound', HttpStatus.NOT_FOUND);
    }
    return this.toView(await this.cancel(userId, order, 'Cancelled by customer'));
  }

  /** Pays the outstanding balance on a pre-order that the company marked ready. */
  async payBalance(user: AuthenticatedUser, id: string, method: CreateOrderDto['paymentMethod']) {
    const order = await this.findOrder(id);
    if (order.buyerId !== user.id) {
      throw new AppException('order.notFound', HttpStatus.NOT_FOUND);
    }
    if (order.saleMode !== SaleMode.pre_order) {
      throw new AppException('order.notPreOrder', HttpStatus.CONFLICT);
    }
    if (order.paymentStatus === OrderPaymentStatus.paid) {
      throw new AppException('order.balanceAlreadyPaid', HttpStatus.CONFLICT);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          purpose: PaymentPurpose.order_balance,
          method,
          idempotencyKey: `order:${order.code}:balance`,
          amount: order.balanceAmount ?? 0,
          state: PaymentState.paid,
          paidAt: new Date(),
        },
      });

      const next = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: OrderPaymentStatus.paid,
          balanceDueAt: null,
        },
        include: ORDER_INCLUDE,
      });

      await notify(tx, {
        userId: order.buyerId,
        type: NotificationType.success,
        titleKey: 'notifications.buyer.balancePaid.title',
        titleParams: { code: order.code },
        bodyKey: 'notifications.buyer.balancePaid.body',
        link: `#marketplace/orders/${order.code}`,
      });
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: 'notifications.admin.balancePaid.title',
        titleParams: { code: order.code },
        bodyKey: 'notifications.admin.balancePaid.body',
        link: `#company/orders/${order.code}`,
      });

      return next;
    });

    return this.toView(updated);
  }

  // -------------------------------------------------------------------------
  // Company operations
  // -------------------------------------------------------------------------

  async listCompany(filter: OrderFilter = 'all') {
    await this.expireUnpaidBalances();
    const company = await this.company.current();

    const orders = await this.prisma.order.findMany({
      where: {
        companyId: company.id,
        ...(filter === 'all' ? {} : { status: filter }),
      },
      include: ORDER_INCLUDE,
      orderBy: { placedAt: 'desc' },
    });

    return orders.map((order) => this.toView(order));
  }

  async getCompany(id: string) {
    await this.expireUnpaidBalances();
    return this.toView(await this.findOrder(id));
  }

  async markReady(admin: AuthenticatedUser, id: string) {
    const order = await this.findOrder(id);
    if (order.status !== OrderStatus.paid) {
      throw this.invalidTransition(order.status, 'mark-ready');
    }

    const preOrder = order.saleMode === SaleMode.pre_order;
    const balanceDueAt = preOrder
      ? new Date(Date.now() + BALANCE_WINDOW_DAYS * 86_400_000)
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ready,
          readyAt: new Date(),
          ...(preOrder
            ? { paymentStatus: OrderPaymentStatus.balance_due, balanceDueAt }
            : {}),
        },
        include: ORDER_INCLUDE,
      });

      await notify(tx, {
        userId: order.buyerId,
        type: NotificationType.status,
        titleKey: preOrder
          ? 'notifications.buyer.orderReadyBalanceDue.title'
          : 'notifications.buyer.orderReady.title',
        titleParams: { code: order.code },
        bodyKey: preOrder
          ? 'notifications.buyer.orderReadyBalanceDue.body'
          : 'notifications.buyer.orderReady.body',
        bodyParams: { days: BALANCE_WINDOW_DAYS, balance: order.balanceAmount ?? 0 },
        link: `#marketplace/orders/${order.code}`,
      });

      return next;
    });

    return this.toView(updated);
  }

  async ship(admin: AuthenticatedUser, id: string) {
    const order = await this.findOrder(id);
    if (order.status !== OrderStatus.ready) {
      throw this.invalidTransition(order.status, 'ship');
    }
    if (
      order.saleMode === SaleMode.pre_order &&
      order.paymentStatus !== OrderPaymentStatus.paid
    ) {
      throw new AppException('order.balanceOutstanding', HttpStatus.CONFLICT);
    }

    return this.toView(
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.shipped },
        include: ORDER_INCLUDE,
      }),
    );
  }

  async deliver(admin: AuthenticatedUser, id: string) {
    const order = await this.findOrder(id);
    if (order.status !== OrderStatus.shipped) {
      throw this.invalidTransition(order.status, 'deliver');
    }

    return this.toView(
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.delivered, deliveredAt: new Date() },
        include: ORDER_INCLUDE,
      }),
    );
  }

  async complete(admin: AuthenticatedUser, id: string) {
    const order = await this.findOrder(id);
    if (order.status !== OrderStatus.delivered) {
      throw this.invalidTransition(order.status, 'complete');
    }

    return this.toView(
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.completed, completedAt: new Date() },
        include: ORDER_INCLUDE,
      }),
    );
  }

  async cancelCompany(admin: AuthenticatedUser, id: string, reason: string) {
    return this.toView(await this.cancel(admin.id, await this.findOrder(id), reason));
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async cancel(actorId: string, order: OrderRecord, reason: string) {
    const cancellable: OrderStatus[] = [
      OrderStatus.pending_payment,
      OrderStatus.paid,
      OrderStatus.ready,
    ];
    if (!cancellable.includes(order.status)) {
      throw this.invalidTransition(order.status, 'cancel');
    }

    const refunded = order.paymentStatus !== OrderPaymentStatus.unpaid;

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.listingDraft.updateMany({
          where: { listingId: item.listingId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      await tx.payment.updateMany({
        where: { orderId: order.id, state: PaymentState.paid },
        data: { state: PaymentState.refunded, refundedAt: new Date() },
      });

      const next = await tx.order.update({
        where: { id: order.id },
        data: {
          status: refunded ? OrderStatus.refunded : OrderStatus.cancelled,
          paymentStatus: refunded ? OrderPaymentStatus.refunded : OrderPaymentStatus.unpaid,
          cancelledAt: new Date(),
          refundedAt: refunded ? new Date() : null,
        },
        include: ORDER_INCLUDE,
      });

      await notify(tx, {
        userId: order.buyerId,
        type: NotificationType.status,
        titleKey: refunded
          ? 'notifications.buyer.orderRefunded.title'
          : 'notifications.buyer.orderCancelled.title',
        titleParams: { code: order.code },
        bodyKey: refunded
          ? 'notifications.buyer.orderRefunded.body'
          : 'notifications.buyer.orderCancelled.body',
        bodyParams: { reason },
        link: `#marketplace/orders/${order.code}`,
      });

      return next;
    });

    this.logger.log(`Order ${order.code} cancelled by ${actorId}: ${reason}`);
    return updated;
  }

  /**
   * Pre-orders whose balance window elapsed are cancelled and refunded, matching
   * the requirement that a missed balance never forfeits the deposit.
   */
  private async expireUnpaidBalances(): Promise<void> {
    const overdue = await this.prisma.order.findMany({
      where: {
        saleMode: SaleMode.pre_order,
        status: OrderStatus.ready,
        paymentStatus: OrderPaymentStatus.balance_due,
        balanceDueAt: { lt: new Date() },
      },
      include: ORDER_INCLUDE,
    });

    for (const order of overdue) {
      await this.cancel(order.buyerId, order, 'Balance not paid within the deadline');
    }
  }

  private async linesFromInput(
    items: Array<{ listingId: string; quantity: number }>,
  ): Promise<CartLine[]> {
    const lines: CartLine[] = [];
    for (const item of items) {
      const listing = await this.prisma.listing.findFirst({
        where: {
          OR: [{ id: item.listingId }, { code: item.listingId }],
          status: 'approved',
          deletedAt: null,
        },
        include: {
          draft: { include: { images: { orderBy: { position: 'asc' } } } },
        },
      });
      if (!listing?.draft) {
        throw new AppException('listing.notAvailable', HttpStatus.NOT_FOUND);
      }
      if (item.quantity > listing.draft.quantity) {
        throw new AppException('cart.quantityExceedsStock', HttpStatus.CONFLICT, {
          available: listing.draft.quantity,
          requested: item.quantity,
        });
      }

      const mainImage =
        listing.draft.images.find((image) => image.isMain) ?? listing.draft.images[0] ?? null;
      lines.push({
        listingId: listing.id,
        code: listing.code,
        name: listing.draft.name,
        species: listing.draft.species,
        breed: listing.draft.breed,
        price: listing.draft.price,
        quantity: item.quantity,
        available: listing.draft.quantity,
        lineTotal: listing.draft.price * item.quantity,
        image: mainImage?.url ?? null,
        saleMode: listing.draft.saleMode,
        depositPct: listing.draft.depositPct,
        expectedReadyDate: listing.draft.expectedReadyDate,
        negotiable: listing.draft.negotiable,
      });
    }
    return lines;
  }

  private async reserveStock(tx: Prisma.TransactionClient, line: CartLine): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ quantity: number }>>`
      UPDATE "ListingDraft"
      SET "quantity" = "quantity" - ${line.quantity}
      WHERE "listingId" = ${line.listingId} AND "quantity" >= ${line.quantity}
      RETURNING "quantity"
    `;
    if (rows.length === 0) {
      throw new AppException('cart.quantityExceedsStock', HttpStatus.CONFLICT, {
        available: 0,
        requested: line.quantity,
      });
    }
  }

  private depositPct(lines: CartLine[]): number {
    const pct = lines[0]?.depositPct;
    if (pct === null || pct === undefined) {
      throw new AppException('order.missingDepositTerms', HttpStatus.CONFLICT);
    }
    return pct;
  }

  private async findOrder(id: string): Promise<OrderRecord> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new AppException('order.notFound', HttpStatus.NOT_FOUND);
    return order;
  }

  private async nextOrderCode(tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ value: bigint }>>`
      INSERT INTO "Sequence" ("name", "value") VALUES ('order', 10023)
      ON CONFLICT ("name") DO UPDATE SET "value" = "Sequence"."value" + 1
      RETURNING "value"
    `;
    return `ORD-${rows[0].value.toString()}`;
  }

  private invalidTransition(from: OrderStatus, action: string): AppException {
    return new AppException('order.invalidTransition', HttpStatus.CONFLICT, { from, action });
  }

  private toView(order: OrderRecord) {
    return {
      id: order.code,
      status: order.status,
      saleMode: order.saleMode,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      depositAmount: order.depositAmount,
      balanceAmount: order.balanceAmount,
      balanceDueAt: order.balanceDueAt,
      company: order.company,
      buyer: order.buyer,
      delivery: {
        recipientName: order.recipientName,
        phone: order.phone,
        address: order.address,
        city: order.city,
        province: order.province,
        deliveryMethod: order.deliveryMethod,
      },
      items: order.items.map((item) => {
        const draft = item.listing.draft;
        const mainImage =
          draft?.images.find((image) => image.isMain) ?? draft?.images[0] ?? null;
        return {
          listingId: item.listingId,
          code: item.listing.code,
          name: draft?.name ?? '',
          species: draft?.species ?? '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          saleMode: item.saleMode,
          image: mainImage?.url ?? null,
        };
      }),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        purpose: payment.purpose,
        method: payment.method,
        provider: payment.provider,
        amount: payment.amount,
        state: payment.state,
        paidAt: payment.paidAt,
        refundedAt: payment.refundedAt,
      })),
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      readyAt: order.readyAt,
      deliveredAt: order.deliveredAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      refundedAt: order.refundedAt,
    };
  }
}
