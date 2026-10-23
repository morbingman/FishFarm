import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';

const listingInclude = {
  owner: {
    select: { id: true, email: true, name: true, store: true, location: true },
  },
  draft: { include: { images: { orderBy: { position: 'asc' as const } } } },
  history: { orderBy: { at: 'asc' as const } },
};

@Injectable()
export class DomainService {
  constructor(private readonly db: PrismaService) {}

  private async code(name: string, prefix: string) {
    const row = await this.db.sequence.upsert({
      where: { name },
      create: { name, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}-${row.value.toString()}`;
  }

  private draftInput(body: any) {
    const price = Number(body.price);
    const quantity = Number(body.quantity ?? 1);
    if (
      body.saleMode === 'pre_order' &&
      (!body.expectedReadyDate ||
        Number(body.depositPct) < 20 ||
        Number(body.depositPct) > 30)
    )
      throw new BadRequestException('listing.invalidPreorder');
    return {
      name: typeof body.name === 'string' ? body.name.trim() : '',
      species: typeof body.species === 'string' ? body.species.trim() : '',
      breed: body.breed ?? '',
      description: body.description ?? '',
      ageMonths: body.ageMonths == null ? null : Number(body.ageMonths),
      sizeCm: body.sizeCm == null ? null : Number(body.sizeCm),
      gender: body.gender ?? null,
      origin: body.origin ?? null,
      health: body.health ?? null,
      price: Number.isInteger(price) && price >= 0 ? price : 0,
      quantity: Number.isInteger(quantity) && quantity >= 1 ? quantity : 1,
      negotiable: Boolean(body.negotiable),
      location: body.location ?? null,
      region: body.region ?? null,
      shipping: Array.isArray(body.shipping) ? body.shipping : [],
      saleMode: body.saleMode ?? 'in_stock',
      depositPct:
        body.saleMode === 'pre_order' ? Number(body.depositPct ?? 25) : null,
      expectedReadyDate: body.expectedReadyDate
        ? new Date(body.expectedReadyDate)
        : null,
      preorderPolicy: body.preorderPolicy ?? null,
      images: {
        create: (body.images ?? []).map((image: any, position: number) => ({
          url: typeof image === 'string' ? image : image.url,
          position,
          isMain:
            (typeof image === 'object' && image.id === body.mainId) ||
            position === 0,
        })),
      },
    } as any;
  }

  private validatePublish(body: any) {
    const images = Array.isArray(body.images) ? body.images : [];
    const imageUrls = images.map((image: any) =>
      typeof image === 'string' ? image : image?.url,
    );
    const complete =
      typeof body.name === 'string' &&
      body.name.trim().length > 0 &&
      typeof body.species === 'string' &&
      body.species.trim().length > 0 &&
      typeof body.description === 'string' &&
      body.description.trim().length >= 20 &&
      Number.isInteger(Number(body.ageMonths)) &&
      Number(body.ageMonths) >= 0 &&
      Number(body.sizeCm) > 0 &&
      typeof body.gender === 'string' &&
      body.gender.length > 0 &&
      typeof body.origin === 'string' &&
      body.origin.length > 0 &&
      typeof body.health === 'string' &&
      body.health.length > 0 &&
      Number(body.price) > 0 &&
      Number.isInteger(Number(body.quantity)) &&
      Number(body.quantity) >= 1 &&
      imageUrls.length > 0 &&
      imageUrls.every(
        (url: unknown) =>
          typeof url === 'string' &&
          url.startsWith('https://res.cloudinary.com/'),
      ) &&
      typeof body.location === 'string' &&
      body.location.trim().length > 0 &&
      typeof body.region === 'string' &&
      body.region.length > 0 &&
      Array.isArray(body.shipping) &&
      body.shipping.length > 0;
    if (!complete) throw new BadRequestException('listing.incomplete');
  }

  private async listing(code: string) {
    const item = await this.db.listing.findFirst({
      where: { code, deletedAt: null },
      include: listingInclude,
    });
    if (!item) throw new NotFoundException('listing.notFound');
    return item;
  }

  private own(item: any, user: AuthenticatedUser) {
    if (item.ownerId !== user.id)
      throw new ForbiddenException('listing.notOwner');
  }

  private async activity(
    user: AuthenticatedUser,
    action: string,
    target?: string,
    link?: string,
  ) {
    await this.db.activity.create({
      data: {
        actorId: user.id,
        actorLabel: user.name,
        role: user.role,
        action,
        target,
        link,
      },
    });
  }

  private async notifyUser(
    recipientId: string,
    type: any,
    titleKey: string,
    bodyKey: string,
    link?: string,
    params?: object,
  ) {
    await this.db.notification.create({
      data: {
        recipientId,
        type,
        titleKey,
        bodyKey,
        link,
        titleParams: params,
        bodyParams: params,
      },
    });
  }

  async marketplace(query: any) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 20)));
    const where: any = {
      status: 'approved',
      deletedAt: null,
      draft: { quantity: { gt: 0 } },
    };
    if (query.q)
      where.OR = ['name', 'species', 'breed'].map((key) => ({
        draft: { [key]: { contains: query.q, mode: 'insensitive' } },
      }));
    if (query.species)
      where.draft.species = { in: String(query.species).split(',') };
    if (query.breed)
      where.draft.breed = { equals: query.breed, mode: 'insensitive' };
    if (query.priceMax) where.draft.price = { lte: Number(query.priceMax) };
    if (query.location)
      where.draft.region = { contains: query.location, mode: 'insensitive' };
    const orderBy =
      query.sort === 'price_asc'
        ? { draft: { price: 'asc' } }
        : query.sort === 'price_desc'
          ? { draft: { price: 'desc' } }
          : { createdAt: 'desc' };
    const [items, total] = await this.db.$transaction([
      this.db.listing.findMany({
        where,
        include: listingInclude,
        orderBy: orderBy as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.listing.count({ where }),
    ]);
    return {
      items: await Promise.all(items.map((x) => this.project(x))),
      total,
      page,
      pageSize,
    };
  }

  private async project(item: any) {
    const stats = await this.db.review.aggregate({
      where: { listingId: item.id },
      _avg: { rating: true },
      _count: true,
    });
    const d = item.draft;
    return {
      id: item.code,
      name: d.name,
      species: d.species,
      breed: d.breed,
      description: d.description,
      size: d.sizeCm,
      age: d.ageMonths,
      gender: d.gender,
      origin: d.origin,
      health: d.health,
      price: d.price,
      quantity: d.quantity,
      location: d.region ?? d.location,
      seller: item.sellerName,
      sellerId: item.ownerId,
      rating: stats._avg.rating ?? 0,
      reviewCount: stats._count,
      images: d.images,
      image:
        d.images.find((x: any) => x.isMain)?.url ?? d.images[0]?.url ?? null,
      saleMode: d.saleMode,
      depositPct: d.depositPct,
      expectedReadyDate: d.expectedReadyDate,
      preorderPolicy: d.preorderPolicy,
      shipping: d.shipping,
      views: item.views,
    };
  }

  async marketplaceHome() {
    const where = {
      status: 'approved' as const,
      deletedAt: null,
      draft: { quantity: { gt: 0 } },
    };
    const [listings, reviews, successfulTrades] = await Promise.all([
      this.db.listing.findMany({
        where,
        include: listingInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.review.findMany({
        include: {
          buyer: { select: { name: true } },
          order: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.order.count({ where: { status: 'completed' } }),
    ]);

    const categories = new Map<
      string,
      { name: string; count: number; image: string | null }
    >();
    const sellers = new Map<
      string,
      {
        id: string;
        name: string;
        location: string;
        count: number;
        image: string | null;
        specialty: string;
      }
    >();

    for (const listing of listings) {
      if (!listing.draft) continue;
      const mainImage =
        listing.draft.images.find((image) => image.isMain)?.url ??
        listing.draft.images[0]?.url ??
        null;
      const category = categories.get(listing.draft.species);
      if (category) category.count += 1;
      else
        categories.set(listing.draft.species, {
          name: listing.draft.species,
          count: 1,
          image: mainImage,
        });

      const seller = sellers.get(listing.ownerId);
      if (seller) seller.count += 1;
      else
        sellers.set(listing.ownerId, {
          id: listing.ownerId,
          name: listing.owner.store ?? listing.owner.name,
          location: listing.owner.location ?? listing.draft.region ?? '',
          count: 1,
          image: mainImage,
          specialty: listing.draft.species,
        });
    }

    const sellerCards = [...sellers.values()]
      .map((seller) => {
        const ratings = reviews
          .filter((review) => review.sellerId === seller.id)
          .map((review) => review.rating);
        return {
          ...seller,
          rating: ratings.length
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      categories: [...categories.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      featured: await Promise.all(
        listings.slice(0, 4).map((item) => this.project(item)),
      ),
      sellers: sellerCards,
      stats: {
        activeListings: listings.length,
        verifiedSellers: sellers.size,
        successfulTrades,
        satisfiedPercent: reviews.length
          ? Math.round(
              (reviews.filter((review) => review.rating >= 4).length /
                reviews.length) *
                100,
            )
          : 0,
      },
      reviews: reviews
        .filter((review) => Boolean(review.text))
        .slice(0, 3)
        .map((review) => ({
          id: review.id,
          buyerName: review.buyer.name,
          rating: review.rating,
          text: review.text,
          orderCode: review.order.code,
          createdAt: review.createdAt,
        })),
    };
  }

  async marketplaceOne(code: string) {
    const item = await this.listing(code);
    if (item.status !== 'approved' || !item.draft || item.draft.quantity < 1)
      throw new NotFoundException('listing.notFound');
    await this.db.listing.update({
      where: { id: item.id },
      data: { views: { increment: 1 } },
    });
    return this.project(item);
  }
  async marketplaceSeller(name: string) {
    const user = await this.db.user.findFirst({
      where: {
        OR: [
          { store: { equals: name, mode: 'insensitive' } },
          { name: { equals: name, mode: 'insensitive' } },
        ],
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        store: true,
        location: true,
        joinedAt: true,
      },
    });
    if (!user) throw new NotFoundException('seller.notFound');
    const listings = await this.db.listing.findMany({
      where: {
        ownerId: user.id,
        status: 'approved',
        deletedAt: null,
        draft: { quantity: { gt: 0 } },
      },
      include: listingInclude,
    });
    const reviews = await this.db.review.aggregate({
      where: { sellerId: user.id },
      _avg: { rating: true },
      _count: true,
    });
    return {
      ...user,
      rating: reviews._avg.rating ?? 0,
      reviewCount: reviews._count,
      listings: await Promise.all(listings.map((x) => this.project(x))),
    };
  }

  sellerListings(user: AuthenticatedUser, status?: string) {
    return this.db.listing.findMany({
      where: {
        ownerId: user.id,
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      include: listingInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createListing(user: AuthenticatedUser, body: any) {
    const code = await this.code('listing', 'FM');
    const publish = body.publish === true;
    if (publish) this.validatePublish(body);
    const item = await this.db.listing.create({
      data: {
        code,
        ownerId: user.id,
        sellerName: user.store ?? user.name,
        status: publish ? 'approved' : 'draft',
        submittedAt: publish ? new Date() : null,
        draft: { create: this.draftInput(body) },
        history: {
          create: {
            actorId: user.id,
            actorLabel: user.name,
            action: publish ? 'Published listing' : 'Created draft',
          },
        },
      },
      include: listingInclude,
    });
    await this.activity(
      user,
      'Created listing',
      item.draft?.name,
      `#seller/listing/${code}`,
    );
    return item;
  }

  async updateListing(user: AuthenticatedUser, code: string, body: any) {
    const item = await this.listing(code);
    this.own(item, user);
    const publish = body.publish === true;
    if (publish) this.validatePublish(body);
    await this.db.listingDraft.delete({ where: { listingId: item.id } });
    const updated = await this.db.listing.update({
      where: { id: item.id },
      data: {
        status: publish ? 'approved' : item.status,
        submittedAt: publish ? new Date() : item.submittedAt,
        decisionKind: null,
        decisionReason: null,
        decisionFeedback: null,
        draft: { create: this.draftInput(body) },
        history: {
          create: {
            actorId: user.id,
            actorLabel: user.name,
            action: publish ? 'Published listing' : 'Updated draft',
          },
        },
      },
      include: listingInclude,
    });
    await this.activity(
      user,
      'Updated listing',
      updated.draft?.name,
      `#seller/listing/${code}`,
    );
    return updated;
  }

  async transition(
    user: AuthenticatedUser,
    code: string,
    action: string,
    body: any = {},
  ) {
    const item = await this.listing(code);
    const admin = ['approve', 'reject', 'request-changes', 'takedown'].includes(
      action,
    );
    if (admin && user.role !== 'Admin')
      throw new ForbiddenException('listing.moderationRequiresAdmin');
    if (!admin) this.own(item, user);
    const rules: Record<string, { from: string[]; to: string }> = {
      submit: {
        from: ['draft', 'pending', 'changes', 'rejected'],
        to: 'approved',
      },
      withdraw: { from: ['pending'], to: 'draft' },
      pause: { from: ['approved'], to: 'paused' },
      resume: { from: ['paused'], to: 'approved' },
      approve: { from: ['pending'], to: 'approved' },
      reject: { from: ['pending'], to: 'rejected' },
      'request-changes': { from: ['pending'], to: 'changes' },
      takedown: { from: ['approved', 'paused'], to: 'rejected' },
    };
    const rule = rules[action];
    if (!rule || !rule.from.includes(item.status))
      throw new BadRequestException('listing.invalidTransition');
    const decision = ['reject', 'request-changes', 'takedown'].includes(action);
    const updated = await this.db.listing.update({
      where: { id: item.id },
      data: {
        status: rule.to as any,
        submittedAt:
          action === 'submit'
            ? new Date()
            : action === 'withdraw'
              ? null
              : item.submittedAt,
        decisionKind: decision
          ? action === 'request-changes'
            ? 'changes'
            : 'rejected'
          : null,
        decisionReason: decision
          ? (body.reason ?? (action === 'takedown' ? 'Policy violation' : null))
          : null,
        decisionFeedback: decision ? (body.feedback ?? '') : null,
        decisionStep: decision ? Number(body.step ?? 1) : null,
        decisionBy: decision ? user.name : null,
        decisionAt: decision ? new Date() : null,
        history: {
          create: {
            actorId: user.id,
            actorLabel: user.name,
            action,
            note: body.feedback ?? body.reason,
          },
        },
      },
      include: listingInclude,
    });
    await this.notifyUser(
      item.ownerId,
      action === 'approve' ? 'approval' : 'status',
      `listing.${action}.title`,
      `listing.${action}.body`,
      `#seller/listing/${code}`,
      { code },
    );
    await this.activity(
      user,
      `${action} listing`,
      item.draft?.name,
      `#admin/review/${code}`,
    );
    return updated;
  }

  async deleteListing(user: AuthenticatedUser, code: string) {
    const item = await this.listing(code);
    this.own(item, user);
    if (['pending', 'approved'].includes(item.status))
      throw new BadRequestException('listing.cannotDelete');
    await this.db.listing.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });
    await this.activity(user, 'Deleted listing', item.draft?.name);
    return { deleted: true };
  }

  adminUsers() {
    return this.db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        location: true,
        store: true,
        joinedAt: true,
      },
      orderBy: { joinedAt: 'desc' },
    });
  }
  async setUserStatus(user: AuthenticatedUser, email: string, status: any) {
    const target = await this.db.user.findUnique({ where: { email } });
    if (!target) throw new NotFoundException('user.notFound');
    if (target.role === 'Admin')
      throw new ForbiddenException('user.adminProtected');
    const result = await this.db.user.update({
      where: { email },
      data: { status },
    });
    await this.activity(user, `${status} user`, target.name);
    return result;
  }
  activityLog(query: any) {
    return this.db.activity.findMany({
      orderBy: { createdAt: 'desc' },
      skip:
        (Math.max(1, Number(query.page ?? 1)) - 1) *
        Math.min(100, Number(query.pageSize ?? 20)),
      take: Math.min(100, Number(query.pageSize ?? 20)),
    });
  }

  async favorites(user: AuthenticatedUser) {
    const rows = await this.db.favorite.findMany({
      where: { userId: user.id },
      include: { listing: { include: listingInclude } },
    });
    return Promise.all(rows.map((x) => this.project(x.listing)));
  }
  async addFavorite(user: AuthenticatedUser, code: string) {
    const item = await this.listing(code);
    return this.db.favorite.upsert({
      where: { userId_listingId: { userId: user.id, listingId: item.id } },
      create: { userId: user.id, listingId: item.id },
      update: {},
    });
  }
  async removeFavorite(user: AuthenticatedUser, code: string) {
    const item = await this.listing(code);
    await this.db.favorite.deleteMany({
      where: { userId: user.id, listingId: item.id },
    });
    return { deleted: true };
  }

  cart(user: AuthenticatedUser) {
    return this.db.cartItem.findMany({
      where: { userId: user.id },
      include: { listing: { include: listingInclude } },
      orderBy: { createdAt: 'asc' },
    });
  }
  async putCart(user: AuthenticatedUser, code: string, quantity: number) {
    const item = await this.listing(code);
    if (
      item.status !== 'approved' ||
      !item.draft ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > item.draft.quantity
    )
      throw new BadRequestException('cart.unavailable');
    return this.db.cartItem.upsert({
      where: { userId_listingId: { userId: user.id, listingId: item.id } },
      create: { userId: user.id, listingId: item.id, quantity },
      update: { quantity },
    });
  }
  async removeCart(user: AuthenticatedUser, code: string) {
    const item = await this.listing(code);
    await this.db.cartItem.deleteMany({
      where: { userId: user.id, listingId: item.id },
    });
    return { deleted: true };
  }

  async createOrder(user: AuthenticatedUser, body: any) {
    const code = await this.code('order', 'ORD');
    const order = await this.db.$transaction(async (tx) => {
      const listingCodes = Array.isArray(body.listingCodes)
        ? body.listingCodes.filter((value: unknown) => typeof value === 'string')
        : [];
      const cart = await tx.cartItem.findMany({
        where: {
          userId: user.id,
          ...(listingCodes.length
            ? { listing: { code: { in: listingCodes } } }
            : {}),
        },
        include: { listing: { include: { draft: true } } },
      });
      if (!cart.length) throw new BadRequestException('cart.empty');
      if (
        cart.some(
          (item) =>
            item.listing.status !== 'approved' ||
            !item.listing.draft ||
            item.quantity < 1,
        )
      )
        throw new BadRequestException('cart.unavailable');

      const sellers = new Set(cart.map((x) => x.listing.ownerId));
      if (sellers.size !== 1)
        throw new BadRequestException('order.singleSellerRequired');
      const saleModes = new Set(cart.map((x) => x.listing.draft!.saleMode));
      if (saleModes.size !== 1)
        throw new BadRequestException('order.singleSaleModeRequired');

      for (const item of cart) {
        const reserved = await tx.listingDraft.updateMany({
          where: {
            listingId: item.listingId,
            quantity: { gte: item.quantity },
          },
          data: { quantity: { decrement: item.quantity } },
        });
        if (reserved.count !== 1)
          throw new BadRequestException('cart.insufficientStock');
        const inventory = await tx.listingDraft.findUnique({
          where: { listingId: item.listingId },
          select: { quantity: true },
        });
        if (inventory?.quantity === 0)
          await tx.listing.update({
            where: { id: item.listingId },
            data: { status: 'paused' },
          });
      }

      const subtotal = cart.reduce(
        (sum, x) => sum + x.listing.draft!.price * x.quantity,
        0,
      );
      const shippingFee = Number(body.shippingFee ?? 0);
      const saleMode = cart[0].listing.draft!.saleMode;
      const depositPct = cart[0].listing.draft!.depositPct ?? 25;
      const depositAmount =
        saleMode === 'pre_order'
          ? Math.round((subtotal * depositPct) / 100)
          : null;
      const created = await tx.order.create({
        data: {
          code,
          buyerId: user.id,
          sellerId: cart[0].listing.ownerId,
          saleMode,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          depositAmount,
          balanceAmount:
            depositAmount == null ? null : subtotal - depositAmount,
          recipientName: body.recipientName,
          phone: body.phone,
          address: body.address,
          city: body.city,
          province: body.province,
          deliveryMethod: body.deliveryMethod,
          items: {
            create: cart.map((x) => ({
              listingId: x.listingId,
              saleMode: x.listing.draft!.saleMode,
              quantity: x.quantity,
              unitPrice: x.listing.draft!.price,
              lineTotal: x.listing.draft!.price * x.quantity,
            })),
          },
        },
        include: { items: true },
      });
      await tx.cartItem.deleteMany({
        where: {
          userId: user.id,
          listingId: { in: cart.map((item) => item.listingId) },
        },
      });
      return created;
    });
    await this.activity(
      user,
      'Created order',
      code,
      `#marketplace/orders/${code}`,
    );
    return order;
  }

  orders(user: AuthenticatedUser) {
    return this.db.order.findMany({
      where:
        user.role === 'Seller' ? { sellerId: user.id } : { buyerId: user.id },
      include: {
        items: { include: { listing: { include: listingInclude } } },
        payments: true,
        review: true,
        dispute: true,
      },
      orderBy: { placedAt: 'desc' },
    });
  }
  async sellerSummary(user: AuthenticatedUser) {
    const [orders, listings] = await Promise.all([
      this.db.order.findMany({ where: { sellerId: user.id } }),
      this.db.listing.findMany({
        where: { ownerId: user.id, deletedAt: null },
      }),
    ]);
    const paid = orders.filter((x) =>
      ['paid', 'ready', 'shipped', 'delivered', 'completed'].includes(x.status),
    );
    const views = listings.reduce((sum, x) => sum + x.views, 0);
    return {
      revenue: paid.reduce((sum, x) => sum + x.total, 0),
      orders: orders.length,
      views,
      conversion: views ? orders.length / views : 0,
      listings: listings.length,
    };
  }
  sellerCustomers(user: AuthenticatedUser) {
    return this.db.user.findMany({
      where: { ordersAsBuyer: { some: { sellerId: user.id } } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        _count: { select: { ordersAsBuyer: { where: { sellerId: user.id } } } },
      },
    });
  }
  sellerReviews(user: AuthenticatedUser) {
    return this.db.review.findMany({
      where: { sellerId: user.id },
      include: {
        buyer: { select: { name: true } },
        listing: { select: { code: true, draft: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async order(user: AuthenticatedUser, code: string) {
    const item = await this.db.order.findUnique({
      where: { code },
      include: {
        items: { include: { listing: { include: listingInclude } } },
        payments: true,
        review: true,
        dispute: true,
      },
    });
    if (
      !item ||
      (item.buyerId !== user.id &&
        item.sellerId !== user.id &&
        user.role !== 'Admin')
    )
      throw new NotFoundException('order.notFound');
    return item;
  }
  adminOrders() {
    return this.db.order.findMany({
      include: {
        buyer: { select: { name: true, email: true } },
        items: { include: { listing: { include: listingInclude } } },
        payments: true,
      },
      orderBy: { placedAt: 'desc' },
    });
  }
  async updateOrder(user: AuthenticatedUser, code: string, status: any) {
    const order = await this.db.order.findUnique({
      where: { code },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('order.notFound');
    const allowed: Record<string, string[]> = {
      pending_payment: ['paid', 'cancelled'],
      paid: ['ready', 'cancelled'],
      ready: ['shipped'],
      shipped: ['delivered'],
      delivered: ['completed'],
    };
    if (!(allowed[order.status] ?? []).includes(status))
      throw new BadRequestException('order.invalidTransition');
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      if (status === 'cancelled') {
        for (const item of order.items) {
          await tx.listingDraft.update({
            where: { listingId: item.listingId },
            data: { quantity: { increment: item.quantity } },
          });
          await tx.listing.updateMany({
            where: { id: item.listingId, status: 'paused' },
            data: { status: 'approved' },
          });
        }
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          status,
          ...(status === 'ready' ? { readyAt: now } : {}),
          ...(status === 'delivered' ? { deliveredAt: now } : {}),
          ...(status === 'completed' ? { completedAt: now } : {}),
          ...(status === 'cancelled' ? { cancelledAt: now } : {}),
        },
      });
    });
    await this.activity(user, `Order ${status}`, code, `#admin/orders/${code}`);
    return updated;
  }
  async pay(user: AuthenticatedUser, code: string, body: any, balance = false) {
    const order = await this.order(user, code);
    if (order.buyerId !== user.id) throw new ForbiddenException();
    if (
      (!balance && order.status !== 'pending_payment') ||
      (balance && order.paymentStatus !== 'balance_due')
    )
      throw new BadRequestException('payment.notDue');
    const amount = balance
      ? order.balanceAmount
      : order.saleMode === 'pre_order'
        ? order.depositAmount
        : order.total;
    if (!amount) throw new BadRequestException('payment.notDue');
    const failed = Boolean(body.simulateFailure);
    const payment = await this.db.payment.create({
      data: {
        orderId: order.id,
        purpose: balance
          ? 'order_balance'
          : order.saleMode === 'pre_order'
            ? 'order_deposit'
            : 'order_full',
        method: body.method ?? 'bank_card',
        idempotencyKey:
          body.idempotencyKey ??
          `${order.id}-${balance ? 'balance' : 'initial'}`,
        amount,
        state: failed ? 'failed' : 'paid',
        failureReason: failed ? 'payment.simulatedFailure' : null,
        paidAt: failed ? null : new Date(),
      },
    });
    if (!failed)
      await this.db.order.update({
        where: { id: order.id },
        data: {
          status: balance || order.saleMode === 'in_stock' ? 'paid' : 'paid',
          paymentStatus:
            balance || order.saleMode === 'in_stock' ? 'paid' : 'deposit_paid',
          paidAt: new Date(),
        },
      });
    else
      await this.db.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.listingDraft.update({
            where: { listingId: item.listingId },
            data: { quantity: { increment: item.quantity } },
          });
          await tx.listing.updateMany({
            where: { id: item.listingId, status: 'paused' },
            data: { status: 'approved' },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'cancelled', cancelledAt: new Date() },
        });
      });
    return payment;
  }
  async markReady(user: AuthenticatedUser, code: string) {
    const order = await this.order(user, code);
    if (order.sellerId !== user.id) throw new ForbiddenException();
    const now = new Date();
    return this.db.order.update({
      where: { id: order.id },
      data: {
        status: 'ready',
        readyAt: now,
        paymentStatus:
          order.saleMode === 'pre_order' ? 'balance_due' : order.paymentStatus,
        balanceDueAt:
          order.saleMode === 'pre_order'
            ? new Date(now.getTime() + 7 * 86400000)
            : null,
      },
    });
  }
  async confirmDelivery(user: AuthenticatedUser, code: string) {
    const order = await this.order(user, code);
    if (order.buyerId !== user.id) throw new ForbiddenException();
    return this.db.order.update({
      where: { id: order.id },
      data: {
        status: 'completed',
        deliveredAt: new Date(),
        completedAt: new Date(),
      },
    });
  }
  async review(user: AuthenticatedUser, code: string, body: any) {
    const order = await this.order(user, code);
    if (
      order.buyerId !== user.id ||
      !['delivered', 'completed'].includes(order.status)
    )
      throw new BadRequestException('review.notAllowed');
    const item = order.items[0];
    return this.db.review.create({
      data: {
        orderId: order.id,
        listingId: item.listingId,
        buyerId: user.id,
        sellerId: order.sellerId,
        rating: Number(body.rating),
        text: body.text,
      },
    });
  }
  async dispute(user: AuthenticatedUser, code: string, body: any) {
    const order = await this.order(user, code);
    if (order.buyerId !== user.id) throw new ForbiddenException();
    return this.db.dispute.create({
      data: {
        orderId: order.id,
        buyerId: user.id,
        reason: body.reason,
        description: body.description,
        attachments: {
          create: (body.attachments ?? []).map((url: string) => ({ url })),
        },
      },
    });
  }

  notifications(user: AuthenticatedUser) {
    return this.db.notification.findMany({
      where: { OR: [{ recipientId: user.id }, { recipientRole: user.role }] },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  markNotification(user: AuthenticatedUser, id: string, read: boolean) {
    return this.db.notification.updateMany({
      where: {
        id,
        OR: [{ recipientId: user.id }, { recipientRole: user.role }],
      },
      data: { readAt: read ? new Date() : null },
    });
  }
  readAll(user: AuthenticatedUser) {
    return this.db.notification.updateMany({
      where: { OR: [{ recipientId: user.id }, { recipientRole: user.role }] },
      data: { readAt: new Date() },
    });
  }
  deleteNotification(user: AuthenticatedUser, id: string) {
    return this.db.notification.deleteMany({
      where: {
        id,
        OR: [{ recipientId: user.id }, { recipientRole: user.role }],
      },
    });
  }

  conversations(user: AuthenticatedUser) {
    return this.db.conversation.findMany({
      where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      include: {
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true, store: true } },
        listing: { select: { code: true, sellerName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }
  async startConversation(user: AuthenticatedUser, body: any) {
    const listing = await this.listing(body.listingId);
    if (listing.ownerId === user.id)
      throw new BadRequestException('conversation.self');
    const existing = await this.db.conversation.findFirst({
      where: {
        buyerId: user.id,
        sellerId: listing.ownerId,
        listingId: listing.id,
      },
      include: { messages: true },
    });
    return (
      existing ??
      this.db.conversation.create({
        data: {
          buyerId: user.id,
          sellerId: listing.ownerId,
          listingId: listing.id,
        },
        include: { messages: true },
      })
    );
  }
  async messages(user: AuthenticatedUser, id: string) {
    const c = await this.db.conversation.findUnique({ where: { id } });
    if (!c || (c.buyerId !== user.id && c.sellerId !== user.id))
      throw new NotFoundException('conversation.notFound');
    return this.db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
  async sendMessage(user: AuthenticatedUser, id: string, body: string) {
    await this.messages(user, id);
    const message = await this.db.message.create({
      data: { conversationId: id, senderId: user.id, body },
    });
    await this.db.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });
    return message;
  }

  batches() {
    return this.db.growOutBatch.findMany({
      where: {
        status: { in: ['open', 'fully_sponsored', 'growing', 'harvesting'] },
      },
      include: {
        images: { orderBy: { position: 'asc' } },
        costBreakdown: true,
        updates: { include: { photos: true }, orderBy: { createdAt: 'desc' } },
        seller: { select: { name: true, store: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async batch(code: string) {
    const item = await this.db.growOutBatch.findUnique({
      where: { code },
      include: {
        images: true,
        costBreakdown: true,
        updates: { include: { photos: true }, orderBy: { createdAt: 'desc' } },
        seller: { select: { name: true, store: true } },
      },
    });
    if (!item) throw new NotFoundException('batch.notFound');
    return item;
  }
  adminBatches(user: AuthenticatedUser) {
    return this.db.growOutBatch.findMany({
      where: { sellerId: user.id },
      include: {
        images: { orderBy: { position: 'asc' } },
        costBreakdown: true,
        updates: { include: { photos: true }, orderBy: { createdAt: 'desc' } },
        sponsorships: {
          select: { id: true, status: true, sponsorId: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createBatch(user: AuthenticatedUser, body: any) {
    const requiredText = [body.title, body.species, body.description];
    const packagePricePerShare = Number(body.packagePricePerShare);
    const ageMonths = Number(body.ageMonths);
    const images: unknown[] = Array.isArray(body.images) ? body.images : [];
    const imageUrls: string[] = images.map((image: unknown) =>
      typeof image === 'string' ? image : '',
    );
    if (
      requiredText.some(
        (value) => typeof value !== 'string' || value.trim().length === 0,
      ) ||
      body.description.trim().length < 10 ||
      !Number.isInteger(packagePricePerShare) ||
      packagePricePerShare < 1 ||
      !Number.isInteger(ageMonths) ||
      ageMonths < 0 ||
      imageUrls.length === 0 ||
      imageUrls.some(
        (url) =>
          !url.startsWith('https://res.cloudinary.com/') || url.length > 2048,
      )
    ) {
      throw new BadRequestException('batch.incomplete');
    }
    const code = await this.code('batch', 'BATCH');
    const item = await this.db.growOutBatch.create({
      data: {
        code,
        sellerId: user.id,
        title: body.title.trim(),
        species: body.species.trim(),
        breed:
          typeof body.breed === 'string' ? body.breed.trim() || null : null,
        description: body.description.trim(),
        ageMonths,
        currentSizeCm: null,
        targetSizeCm: null,
        gender:
          typeof body.gender === 'string' ? body.gender.trim() || null : null,
        health: null,
        carePlan: null,
        status: 'open',
        location: null,
        region: null,
        stockingDate: null,
        expectedHarvestDate: null,
        stockCount: 1,
        shareUnitType: 'count',
        shareUnit: '1 fish',
        expectedHarvestWeightG: null,
        totalShares: 1,
        sharesAvailable: 1,
        packagePricePerShare,
        contingencyPct: 10,
        riskDisclosure: null,
        termsVersion:
          typeof body.termsVersion === 'string' && body.termsVersion.trim()
            ? body.termsVersion.trim()
            : '1.0',
        farmVerified: true,
        reviewedAt: new Date(),
        reviewedBy: user.id,
        images: {
          create: imageUrls.map((url, position) => ({
            url,
            position,
            isMain: position === 0,
          })),
        },
      },
      include: {
        images: { orderBy: { position: 'asc' } },
        costBreakdown: true,
        updates: true,
      },
    });
    await this.activity(
      user,
      'Created juvenile fish sponsorship',
      item.title,
      `#farming/${item.code}`,
    );
    return item;
  }
  sponsorships(user: AuthenticatedUser) {
    return this.db.sponsorship.findMany({
      where: { sponsorId: user.id },
      include: {
        batch: {
          include: {
            images: true,
            updates: {
              include: { photos: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        payments: true,
        escrowReleases: true,
        adjustments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  adminSponsorships(user: AuthenticatedUser) {
    return this.db.sponsorship.findMany({
      where: { batch: { sellerId: user.id } },
      include: {
        sponsor: { select: { id: true, email: true, name: true } },
        batch: {
          include: {
            images: true,
            updates: {
              include: { photos: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        payments: true,
        escrowReleases: true,
        adjustments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async updateSponsorshipStatus(
    user: AuthenticatedUser,
    id: string,
    requestedStatus: string,
  ) {
    const item = await this.db.sponsorship.findUnique({
      where: { id },
      include: { batch: true },
    });
    if (!item || item.batch.sellerId !== user.id)
      throw new NotFoundException('sponsorship.notFound');

    const statusMap: Record<string, string> = {
      confirmed: 'funded',
      preparing: 'preparing',
      farming: 'growing',
      ready: 'ready_for_delivery',
      handover: 'handover',
      completed: 'settled',
      cancelled: 'cancelled',
    };
    const next = statusMap[requestedStatus];
    const allowed: Record<string, string[]> = {
      pending_payment: ['funded', 'cancelled'],
      funded: ['preparing', 'cancelled'],
      preparing: ['growing', 'cancelled'],
      growing: ['ready_for_delivery'],
      ready_for_delivery: ['handover'],
      handover: ['settled'],
      delivered: ['settled'],
    };
    if (!next || !(allowed[item.status] ?? []).includes(next))
      throw new BadRequestException('sponsorship.invalidTransition');

    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      const sponsorship = await tx.sponsorship.update({
        where: { id },
        data: {
          status: next as any,
          ...(next === 'growing' ? { growingAt: now } : {}),
          ...(next === 'ready_for_delivery' ? { readyAt: now } : {}),
          ...(next === 'settled'
            ? { deliveredAt: now, settledAt: now }
            : {}),
          ...(next === 'cancelled' ? { cancelledAt: now } : {}),
        },
      });
      const batchStatus =
        next === 'growing'
          ? 'growing'
          : next === 'ready_for_delivery'
            ? 'harvesting'
            : next === 'handover'
              ? 'harvested'
              : next === 'settled'
                ? 'settled'
                : null;
      if (batchStatus)
        await tx.growOutBatch.update({
          where: { id: item.batchId },
          data: { status: batchStatus as any },
        });
      if (next === 'cancelled')
        await tx.growOutBatch.update({
          where: { id: item.batchId },
          data: {
            sharesAvailable: { increment: item.shares },
            status: 'open',
          },
        });
      return sponsorship;
    });
    await this.notifyUser(
      item.sponsorId,
      'status',
      'Farming booking updated',
      `Booking status: ${requestedStatus}`,
      `#account/farming-orders/${id}`,
    );
    await this.activity(
      user,
      `Farming booking: ${requestedStatus}`,
      id,
      `#admin/bookings/${id}`,
    );
    return updated;
  }
  async sponsor(user: AuthenticatedUser, code: string, body: any) {
    const batch = await this.batch(code);
    const shares = Number(body.shares);
    if (
      !Number.isInteger(shares) ||
      shares < 1 ||
      shares > batch.sharesAvailable
    )
      throw new BadRequestException('sponsorship.invalidShares');
    const packageAmount = shares * batch.packagePricePerShare;
    return this.db.$transaction(async (tx) => {
      const updated = await tx.growOutBatch.updateMany({
        where: { id: batch.id, sharesAvailable: { gte: shares } },
        data: {
          sharesAvailable: { decrement: shares },
          ...(batch.sharesAvailable === shares
            ? { status: 'fully_sponsored' }
            : {}),
        },
      });
      if (!updated.count) throw new BadRequestException('sponsorship.soldOut');
      return tx.sponsorship.create({
        data: {
          batchId: batch.id,
          sponsorId: user.id,
          shares,
          packageAmount,
          deliveryFee: Number(body.deliveryFee ?? 0),
          totalAmount: packageAmount + Number(body.deliveryFee ?? 0),
          recipientName: body.recipientName,
          phone: body.phone,
          address: body.address,
          city: body.city,
          province: body.province,
          deliveryMethod: body.deliveryMethod,
          termsSnapshot: {
            termsVersion: batch.termsVersion,
            shareUnit: batch.shareUnit,
            packagePricePerShare: batch.packagePricePerShare,
            riskDisclosure: batch.riskDisclosure,
          },
        },
      });
    });
  }
  async paySponsorship(user: AuthenticatedUser, id: string, body: any) {
    const sponsorship = await this.db.sponsorship.findUnique({ where: { id } });
    if (!sponsorship || sponsorship.sponsorId !== user.id)
      throw new NotFoundException('sponsorship.notFound');
    const failed = Boolean(body.simulateFailure);
    const payment = await this.db.payment.create({
      data: {
        sponsorshipId: id,
        purpose: 'sponsorship_package',
        method: body.method ?? 'bank_transfer',
        idempotencyKey: body.idempotencyKey ?? `${id}-package`,
        amount: sponsorship.totalAmount,
        state: failed ? 'failed' : 'paid',
        failureReason: failed ? 'payment.simulatedFailure' : null,
        paidAt: failed ? null : new Date(),
      },
    });
    if (!failed)
      await this.db.sponsorship.update({
        where: { id },
        data: { status: 'funded', paidAt: new Date() },
      });
    else if (sponsorship.status === 'pending_payment')
      await this.db.$transaction([
        this.db.sponsorship.update({
          where: { id },
          data: { status: 'cancelled' },
        }),
        this.db.growOutBatch.update({
          where: { id: sponsorship.batchId },
          data: {
            sharesAvailable: { increment: sponsorship.shares },
            status: 'open',
          },
        }),
      ]);
    return payment;
  }
}
