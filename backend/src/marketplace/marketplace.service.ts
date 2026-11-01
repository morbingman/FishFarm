import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app.exception.js';
import { CompanyService } from '../company/company.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { SaleMode } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListMarketplaceDto } from './dto/list-marketplace.dto.js';

const MARKETPLACE_INCLUDE = {
  company: { select: { id: true, name: true, location: true, joinedAt: true } },
  draft: { include: { images: { orderBy: { position: 'asc' as const } } } },
} satisfies Prisma.ListingInclude;

type MarketplaceListing = Prisma.ListingGetPayload<{ include: typeof MARKETPLACE_INCLUDE }>;

type CompanyRating = { rating: number | null; reviewCount: number };

const NEW_LISTING_DAYS = 7;

/**
 * Public catalog read. The catalog is the company's own inventory, so there is
 * one store profile and one company-level rating rather than per-seller pages.
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
  ) {}

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

    const companyRating = await this.companyRating();

    return {
      items: listings.map((listing) => this.toProduct(listing, companyRating)),
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

    const companyRating = await this.companyRating();
    return this.toProduct(listing, companyRating);
  }

  /**
   * The company store profile. There is exactly one store, so this returns it
   * with the overall rating and the live catalog's size.
   */
  async store() {
    const company = await this.companyService.current();
    const rating = await this.companyRating();

    const [listed, species] = await this.prisma.$transaction([
      this.prisma.listing.count({ where: { status: 'approved', deletedAt: null } }),
      this.prisma.listingDraft.findMany({
        where: { listing: { status: 'approved', deletedAt: null } },
        select: { species: true },
        distinct: ['species'],
      }),
    ]);

    return {
      id: company.id,
      name: company.name,
      about: company.about,
      location: company.location,
      phone: company.phone,
      email: company.email,
      joinedAt: company.joinedAt,
      ...rating,
      listings: listed,
      species: species.map((row) => row.species).filter(Boolean).sort(),
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
          { companyName: { contains: query, mode: 'insensitive' } },
          { draft: { location: { contains: query, mode: 'insensitive' } } },
          { draft: { region: { contains: query, mode: 'insensitive' } } },
          // The card-visible listing code ("FM-18420") must be searchable too —
          // partial matches ("19544") land here via contains.
          { code: { contains: query, mode: 'insensitive' } },
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

    // A single company sells everything, so a rating floor either matches the
    // whole catalog or excludes all of it.
    if (dto.rating !== undefined) {
      const company = await this.companyService.current();
      const rating = await this.companyRating(company.id);
      if (rating.rating === null || rating.rating < dto.rating) return null;
    }

    if (and.length > 0) where.AND = and;
    return where;
  }

  private orderBy(sort: ListMarketplaceDto['sort']): Prisma.ListingOrderByWithRelationInput[] {
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

  private async companyRating(companyId?: string): Promise<CompanyRating> {
    const id = companyId ?? (await this.companyService.current()).id;
    const row = await this.prisma.review.aggregate({
      where: { companyId: id },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      rating: this.roundRating(row._avg.rating),
      reviewCount: row._count._all,
    };
  }

  private roundRating(value: number | null): number | null {
    return value === null ? null : Math.round(value * 10) / 10;
  }

  private toProduct(listing: MarketplaceListing, companyRating: CompanyRating) {
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
      images:
        draft?.images.map((image) => ({
          id: image.id,
          url: image.url,
          position: image.position,
          isMain: image.isMain,
        })) ?? [],
      image: mainImage?.url ?? null,
      label: this.label(listing),
      company: {
        id: listing.company.id,
        name: listing.companyName,
        location: listing.company.location,
        joinedAt: listing.company.joinedAt,
        rating: companyRating.rating,
        reviewCount: companyRating.reviewCount,
      },
      rating: companyRating.rating,
      reviewCount: companyRating.reviewCount,
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
