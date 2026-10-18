import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app.exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { SaleMode } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListMarketplaceDto } from './dto/list-marketplace.dto.js';

const MARKETPLACE_INCLUDE = {
  owner: {
    select: { id: true, email: true, name: true, store: true, location: true, joinedAt: true },
  },
  draft: { include: { images: { orderBy: { position: 'asc' as const } } } },
} satisfies Prisma.ListingInclude;

type MarketplaceListing = Prisma.ListingGetPayload<{ include: typeof MARKETPLACE_INCLUDE }>;

type SellerRating = { rating: number | null; reviewCount: number };

const NEW_LISTING_DAYS = 7;

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListMarketplaceDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where = await this.buildWhere(dto);

    if (where === null) {
      return { items: [], page, pageSize, total: 0, totalPages: 0 };
    }

    const [total, listings] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: MARKETPLACE_INCLUDE,
        orderBy: this.orderBy(dto.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const ratings = await this.ratingsFor(listings.map((listing) => listing.ownerId));

    return {
      items: listings.map((listing) =>
        this.toProduct(listing, ratings.get(listing.ownerId) ?? this.emptyRating()),
      ),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async detail(id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        deletedAt: null,
        status: 'approved',
        OR: [{ id }, { code: id }],
      },
      include: MARKETPLACE_INCLUDE,
    });
    if (!listing) {
      throw new AppException('marketplace.listingNotFound', HttpStatus.NOT_FOUND);
    }

    const ratings = await this.ratingsFor([listing.ownerId]);
    return this.toProduct(listing, ratings.get(listing.ownerId) ?? this.emptyRating());
  }

  async seller(name: string, page = 1, pageSize = 20) {
    const seller = await this.prisma.user.findFirst({
      where: {
        role: 'Seller',
        status: 'active',
        OR: [
          { store: { equals: name, mode: 'insensitive' } },
          { name: { equals: name, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, store: true, location: true, joinedAt: true },
    });
    if (!seller) {
      throw new AppException('marketplace.sellerNotFound', HttpStatus.NOT_FOUND);
    }

    const where: Prisma.ListingWhereInput = {
      ownerId: seller.id,
      status: 'approved',
      deletedAt: null,
    };

    const [total, listings, ratings] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: MARKETPLACE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.aggregate({
        where: { sellerId: seller.id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const rating = this.roundRating(ratings._avg.rating);
    const sellerRating: SellerRating = { rating, reviewCount: ratings._count._all };

    return {
      seller: {
        name: seller.store ?? seller.name,
        ownerName: seller.name,
        store: seller.store,
        location: seller.location,
        joinedAt: seller.joinedAt,
        ...sellerRating,
      },
      listings: {
        items: listings.map((listing) => this.toProduct(listing, sellerRating)),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private async buildWhere(dto: ListMarketplaceDto): Promise<Prisma.ListingWhereInput | null> {
    const where: Prisma.ListingWhereInput = {
      status: 'approved',
      deletedAt: null,
    };

    const draft: Prisma.ListingDraftWhereInput = {};
    const and: Prisma.ListingWhereInput[] = [];

    if (dto.q?.trim()) {
      const query = dto.q.trim();
      and.push({
        OR: [
          { draft: { name: { contains: query, mode: 'insensitive' } } },
          { draft: { species: { contains: query, mode: 'insensitive' } } },
          { draft: { breed: { contains: query, mode: 'insensitive' } } },
          { sellerName: { contains: query, mode: 'insensitive' } },
          { draft: { location: { contains: query, mode: 'insensitive' } } },
          { draft: { region: { contains: query, mode: 'insensitive' } } },
        ],
      });
    }

    if (dto.species?.length) {
      draft.species = { in: dto.species };
    }
    if (dto.breed?.trim()) {
      draft.breed = { equals: dto.breed.trim(), mode: 'insensitive' };
    }
    if (dto.priceMax !== undefined) {
      draft.price = { lte: dto.priceMax };
    }
    if (dto.size === 'under15') {
      draft.sizeCm = { lt: 15 };
    } else if (dto.size === '15plus') {
      draft.sizeCm = { gte: 15 };
    }
    if (dto.location?.trim()) {
      const location = dto.location.trim();
      and.push({
        OR: [
          { draft: { region: { contains: location, mode: 'insensitive' } } },
          { draft: { location: { contains: location, mode: 'insensitive' } } },
        ],
      });
    }
    if (dto.available !== false) {
      draft.quantity = { gt: 0 };
    }

    if (Object.keys(draft).length > 0) where.draft = draft;

    if (dto.sellerRating !== undefined) {
      const ratedSellers = await this.prisma.review.groupBy({
        by: ['sellerId'],
        having: { rating: { _avg: { gte: dto.sellerRating } } },
        _avg: { rating: true },
      });
      if (ratedSellers.length === 0) return null;
      where.ownerId = { in: ratedSellers.map((row) => row.sellerId) };
    }

    if (and.length > 0) where.AND = and;
    return where;
  }

  private orderBy(
    sort: ListMarketplaceDto['sort'],
  ): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ draft: { price: 'asc' } }, { createdAt: 'desc' }];
      case 'price_desc':
        return [{ draft: { price: 'desc' } }, { createdAt: 'desc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      default:
        return [{ views: 'desc' }, { createdAt: 'desc' }];
    }
  }

  private async ratingsFor(sellerIds: string[]): Promise<Map<string, SellerRating>> {
    if (sellerIds.length === 0) return new Map();

    const rows = await this.prisma.review.groupBy({
      by: ['sellerId'],
      where: { sellerId: { in: sellerIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return new Map(
      rows.map((row) => [
        row.sellerId,
        {
          rating: this.roundRating(row._avg.rating),
          reviewCount: row._count._all,
        },
      ]),
    );
  }

  private roundRating(value: number | null): number | null {
    return value === null ? null : Math.round(value * 10) / 10;
  }

  private emptyRating(): SellerRating {
    return { rating: null, reviewCount: 0 };
  }

  private toProduct(listing: MarketplaceListing, sellerRating: SellerRating) {
    const draft = listing.draft;
    const mainImage = draft?.images.find((image) => image.isMain) ?? draft?.images[0] ?? null;

    return {
      id: listing.code,
      name: draft?.name ?? '',
      species: draft?.species ?? '',
      breed: draft?.breed ?? '',
      description: draft?.description ?? '',
      sizeCm: draft?.sizeCm ?? null,
      price: draft?.price ?? 0,
      quantity: draft?.quantity ?? 0,
      negotiable: draft?.negotiable ?? false,
      ageMonths: draft?.ageMonths ?? null,
      gender: draft?.gender ?? null,
      origin: draft?.origin ?? null,
      health: draft?.health ?? null,
      location: draft?.location ?? null,
      region: draft?.region ?? null,
      shipping: draft?.shipping ?? [],
      images: draft?.images.map((image) => ({
        id: image.id,
        url: image.url,
        position: image.position,
        isMain: image.isMain,
      })) ?? [],
      image: mainImage?.url ?? null,
      label: this.label(listing),
      seller: {
        name: listing.sellerName,
        store: listing.owner.store,
        location: listing.owner.location,
        joinedAt: listing.owner.joinedAt,
        rating: sellerRating.rating,
        reviewCount: sellerRating.reviewCount,
      },
      rating: sellerRating.rating,
      reviewCount: sellerRating.reviewCount,
      saleMode: draft?.saleMode ?? SaleMode.in_stock,
      depositPct: draft?.depositPct ?? null,
      expectedReadyDate: draft?.expectedReadyDate ?? null,
      preorderPolicy: draft?.preorderPolicy ?? null,
      createdAt: listing.createdAt,
      views: listing.views,
    };
  }

  private label(listing: MarketplaceListing): 'pre_order' | 'new' | 'verified' {
    if (listing.draft?.saleMode === SaleMode.pre_order) return 'pre_order';
    const ageMs = Date.now() - listing.createdAt.getTime();
    return ageMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000 ? 'new' : 'verified';
  }
}
