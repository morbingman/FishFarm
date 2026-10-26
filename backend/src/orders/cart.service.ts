import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ListingStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type CartLine = {
  listingId: string;
  code: string;
  name: string;
  species: string;
  breed: string;
  price: number;
  quantity: number;
  available: number;
  lineTotal: number;
  image: string | null;
  saleMode: string;
  depositPct: number | null;
  expectedReadyDate: Date | null;
  negotiable: boolean;
};

const CART_LISTING_INCLUDE = {
  draft: { include: { images: { orderBy: { position: 'asc' as const } } } },
} satisfies Prisma.ListingInclude;

const CART_INCLUDE = {
  listing: { include: CART_LISTING_INCLUDE },
} satisfies Prisma.CartItemInclude;

type CartRecord = Prisma.CartItemGetPayload<{ include: typeof CART_INCLUDE }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.summarize(await this.lines(userId));
  }

  async add(userId: string, listingId: string, quantity = 1) {
    const listing = await this.findSellable(listingId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_listingId: { userId, listingId: listing.id } },
    });
    const next = (existing?.quantity ?? 0) + quantity;
    this.assertStock(listing.draft!.quantity, next);

    await this.prisma.cartItem.upsert({
      where: { userId_listingId: { userId, listingId: listing.id } },
      create: { userId, listingId: listing.id, quantity: next },
      update: { quantity: next },
    });

    return this.get(userId);
  }

  async update(userId: string, listingId: string, quantity: number) {
    const listing = await this.findSellable(listingId);
    this.assertStock(listing.draft!.quantity, quantity);

    const item = await this.prisma.cartItem.findUnique({
      where: { userId_listingId: { userId, listingId: listing.id } },
    });
    if (!item) throw new AppException('cart.itemNotFound', HttpStatus.NOT_FOUND);

    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.get(userId);
  }

  async remove(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { OR: [{ id: listingId }, { code: listingId }] },
      select: { id: true },
    });
    if (!listing) throw new AppException('cart.itemNotFound', HttpStatus.NOT_FOUND);

    await this.prisma.cartItem.deleteMany({ where: { userId, listingId: listing.id } });
    return this.get(userId);
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return this.summarize([]);
  }

  /**
   * Cart rows are re-validated at checkout as well as at add time, because price,
   * stock and listing status can change in between.
   */
  async checkoutLines(
    userId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<CartLine[]> {
    const lines = await this.lines(userId, db);
    if (lines.length === 0) throw new AppException('cart.empty', HttpStatus.BAD_REQUEST);
    return lines;
  }

  summarize(lines: CartLine[]) {
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const saleModes = [...new Set(lines.map((line) => line.saleMode))];

    return {
      items: lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      saleMode: saleModes.length === 1 ? saleModes[0] : saleModes.length === 0 ? null : 'mixed',
    };
  }

  private async lines(
    userId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<CartLine[]> {
    const items = await db.cartItem.findMany({
      where: { userId },
      include: CART_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return items.map((item) => this.toLine(item));
  }

  private async findSellable(listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        OR: [{ id: listingId }, { code: listingId }],
        status: ListingStatus.approved,
        deletedAt: null,
      },
      include: CART_LISTING_INCLUDE,
    });
    if (!listing?.draft) {
      throw new AppException('listing.notAvailable', HttpStatus.NOT_FOUND);
    }
    return listing;
  }

  private assertStock(available: number, requested: number): void {
    if (requested > available) {
      throw new AppException('cart.quantityExceedsStock', HttpStatus.CONFLICT, {
        available,
        requested,
      });
    }
  }

  private toLine(item: CartRecord): CartLine {
    const draft = item.listing.draft;
    const mainImage = draft?.images.find((image) => image.isMain) ?? draft?.images[0] ?? null;

    return {
      listingId: item.listing.id,
      code: item.listing.code,
      name: draft?.name ?? '',
      species: draft?.species ?? '',
      breed: draft?.breed ?? '',
      price: draft?.price ?? 0,
      quantity: item.quantity,
      available: draft?.quantity ?? 0,
      lineTotal: (draft?.price ?? 0) * item.quantity,
      image: mainImage?.url ?? null,
      saleMode: draft?.saleMode ?? 'in_stock',
      depositPct: draft?.depositPct ?? null,
      expectedReadyDate: draft?.expectedReadyDate ?? null,
      negotiable: draft?.negotiable ?? false,
    };
  }
}
