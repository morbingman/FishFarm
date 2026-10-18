import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  DecisionKind,
  ListingStatus,
  NotificationType,
  SaleMode,
  type UserRole,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizePrefs } from '../users/users.service.js';
import type { AdminQueueTab, SellerListingFilter } from './dto/list-listings.dto.js';
import type {
  ListingImageDto,
  ModerateListingDto,
  SaveListingDto,
  TakedownListingDto,
} from './dto/save-listing.dto.js';

const LISTING_INCLUDE = {
  owner: { select: { id: true, email: true, name: true, store: true } },
  draft: { include: { images: { orderBy: { position: 'asc' } } } },
  history: { orderBy: { at: 'asc' } },
} satisfies Prisma.ListingInclude;

type ListingRecord = Prisma.ListingGetPayload<{ include: typeof LISTING_INCLUDE }>;

type NotificationInput = {
  userId?: string;
  role?: UserRole;
  type: NotificationType;
  titleKey: string;
  titleParams?: Record<string, string | number | boolean>;
  bodyKey: string;
  bodyParams?: Record<string, string | number | boolean>;
  link?: string;
};

type ActivityRole = 'Seller' | 'Admin';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Seller
  // -------------------------------------------------------------------------

  async listSeller(user: AuthenticatedUser, filter: SellerListingFilter = 'all') {
    const where: Prisma.ListingWhereInput = { ownerId: user.id, deletedAt: null };

    if (filter === 'attention') {
      where.status = { in: [ListingStatus.changes, ListingStatus.rejected] };
    } else if (filter !== 'all') {
      where.status = filter;
    }

    const listings = await this.prisma.listing.findMany({
      where,
      include: LISTING_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });

    return listings.map((listing) => this.toView(listing));
  }

  async getSeller(user: AuthenticatedUser, id: string) {
    const listing = await this.findOwned(user.id, id);
    return this.toView(listing);
  }

  async create(user: AuthenticatedUser, dto: SaveListingDto) {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({
        where: { id: user.id },
        select: { name: true, store: true },
      });
      if (!owner) throw new AppException('error.notFound', HttpStatus.NOT_FOUND);

      const code = await this.nextListingCode(tx);
      const listing = await tx.listing.create({
        data: {
          code,
          ownerId: user.id,
          sellerName: owner.store ?? owner.name,
          status: ListingStatus.draft,
          draft: { create: this.draftCreate(dto) },
          history: {
            create: {
              actorId: user.id,
              actorLabel: user.name,
              action: 'Created draft',
            },
          },
        },
        include: LISTING_INCLUDE,
      });

      await this.log(tx, user, 'Seller', 'Created listing', listing.draft?.name || code, `#seller/listing/${code}`);
      return this.toView(listing);
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: SaveListingDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.findOwned(user.id, id, tx);
      if (!listing.draft) throw new AppException('listing.notFound', HttpStatus.NOT_FOUND);
      if (listing.status === ListingStatus.pending) {
        throw new AppException('listing.underReview', HttpStatus.CONFLICT);
      }

      // Editing a live listing changes the canonical content, so it must go
      // back through review and disappear from the marketplace until approved.
      const editedLive =
        listing.status === ListingStatus.approved || listing.status === ListingStatus.paused;
      const now = new Date();

      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          ...(editedLive
            ? {
                status: ListingStatus.pending,
                submittedAt: now,
                decisionKind: null,
                decisionReason: null,
                decisionFeedback: null,
                decisionStep: null,
                decisionBy: null,
                decisionAt: null,
              }
            : {}),
          draft: {
            update: {
              ...this.draftUpdate(dto, listing.draft),
              ...(dto.images !== undefined
                ? { images: { deleteMany: {}, create: this.imageRows(dto.images) } }
                : {}),
            },
          },
          history: {
            create: {
              actorId: user.id,
              actorLabel: user.name,
              action: editedLive ? 'Edited — resubmitted for review' : 'Updated draft',
            },
          },
        },
        include: LISTING_INCLUDE,
      });

      await this.log(
        tx,
        user,
        'Seller',
        editedLive ? 'Edited live listing (sent for review)' : 'Updated listing draft',
        updated.draft?.name || updated.code,
        `#seller/listing/${updated.code}`,
      );

      if (editedLive) {
        await this.notify(tx, {
          role: 'Admin',
          type: NotificationType.status,
          titleKey: 'notifications.admin.listingResubmitted.title',
          titleParams: { name: updated.draft?.name ?? updated.code },
          bodyKey: 'notifications.admin.listingResubmitted.body',
          bodyParams: {
            seller: updated.sellerName,
            name: updated.draft?.name ?? updated.code,
            code: updated.code,
          },
          link: `#admin/review/${updated.code}`,
        });
      }

      return this.toView(updated);
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.findOwned(user.id, id, tx);
      if (
        listing.status === ListingStatus.pending ||
        listing.status === ListingStatus.approved ||
        listing.status === ListingStatus.paused
      ) {
        throw new AppException('listing.deleteForbidden', HttpStatus.CONFLICT, {
          status: listing.status,
        });
      }

      await tx.listing.update({
        where: { id: listing.id },
        data: {
          deletedAt: new Date(),
          history: {
            create: {
              actorId: user.id,
              actorLabel: user.name,
              action: 'Deleted listing',
            },
          },
        },
      });

      await this.log(
        tx,
        user,
        'Seller',
        'Deleted listing',
        listing.draft?.name ?? listing.code,
        `#seller/listing/${listing.code}`,
      );

      return { id: listing.code, deleted: true };
    });
  }

  async submit(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.findOwned(user.id, id, tx);
      const allowed: ListingStatus[] = [
        ListingStatus.draft,
        ListingStatus.changes,
        ListingStatus.rejected,
        ListingStatus.approved,
      ];
      if (!allowed.includes(listing.status)) {
        throw this.invalidTransition(listing.status, 'submit');
      }

      this.assertSubmittable(listing);

      const resubmit = listing.status !== ListingStatus.draft;
      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          status: ListingStatus.pending,
          submittedAt: new Date(),
          decisionKind: null,
          decisionReason: null,
          decisionFeedback: null,
          decisionStep: null,
          decisionBy: null,
          decisionAt: null,
          history: {
            create: {
              actorId: user.id,
              actorLabel: user.name,
              action: resubmit ? 'Resubmitted for review' : 'Submitted for review',
            },
          },
        },
        include: LISTING_INCLUDE,
      });

      await this.notify(tx, {
        userId: user.id,
        type: NotificationType.success,
        titleKey: 'notifications.listing.submitted.title',
        titleParams: { name: updated.draft?.name ?? updated.code },
        bodyKey: 'notifications.listing.submitted.body',
        bodyParams: { name: updated.draft?.name ?? updated.code },
        link: `#seller/listing/${updated.code}`,
      });
      await this.notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: resubmit
          ? 'notifications.admin.listingResubmitted.title'
          : 'notifications.admin.listingSubmitted.title',
        titleParams: { name: updated.draft?.name ?? updated.code },
        bodyKey: resubmit
          ? 'notifications.admin.listingResubmitted.body'
          : 'notifications.admin.listingSubmitted.body',
        bodyParams: {
          seller: updated.sellerName,
          name: updated.draft?.name ?? updated.code,
          code: updated.code,
        },
        link: `#admin/review/${updated.code}`,
      });
      await this.log(
        tx,
        user,
        'Seller',
        resubmit ? 'Resubmitted listing' : 'Submitted listing for review',
        updated.draft?.name ?? updated.code,
        `#seller/listing/${updated.code}`,
      );

      return this.toView(updated);
    });
  }

  async withdraw(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.findOwned(user.id, id, tx);
      if (listing.status !== ListingStatus.pending) {
        throw this.invalidTransition(listing.status, 'withdraw');
      }

      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          status: ListingStatus.draft,
          submittedAt: null,
          history: {
            create: {
              actorId: user.id,
              actorLabel: user.name,
              action: 'Withdrawn from review',
            },
          },
        },
        include: LISTING_INCLUDE,
      });

      await this.notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: 'notifications.admin.listingWithdrawn.title',
        titleParams: { name: updated.draft?.name ?? updated.code },
        bodyKey: 'notifications.admin.listingWithdrawn.body',
        bodyParams: {
          seller: updated.sellerName,
          name: updated.draft?.name ?? updated.code,
          code: updated.code,
        },
        link: '#admin/queue',
      });
      await this.log(
        tx,
        user,
        'Seller',
        'Withdrew listing from review',
        updated.draft?.name ?? updated.code,
        `#seller/listing/${updated.code}`,
      );

      return this.toView(updated);
    });
  }

  async pause(user: AuthenticatedUser, id: string) {
    return this.setPaused(user, id, true);
  }

  async resume(user: AuthenticatedUser, id: string) {
    return this.setPaused(user, id, false);
  }

  private async setPaused(user: AuthenticatedUser, id: string, paused: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.findOwned(user.id, id, tx);
      const required = paused ? ListingStatus.approved : ListingStatus.paused;
      if (listing.status !== required) {
        throw this.invalidTransition(listing.status, paused ? 'pause' : 'resume');
      }

      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          status: paused ? ListingStatus.paused : ListingStatus.approved,
          history: {
            create: {
              actorId: user.id,
              actorLabel: user.name,
              action: paused ? 'Paused (hidden from marketplace)' : 'Resumed (live again)',
            },
          },
        },
        include: LISTING_INCLUDE,
      });

      await this.log(
        tx,
        user,
        'Seller',
        paused ? 'Paused listing' : 'Resumed listing',
        updated.draft?.name ?? updated.code,
        `#seller/listing/${updated.code}`,
      );

      return this.toView(updated);
    });
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async queue(tab: AdminQueueTab = 'pending') {
    const status: Prisma.ListingWhereInput['status'] =
      tab === 'pending'
        ? ListingStatus.pending
        : tab === 'approved'
          ? ListingStatus.approved
          : { in: [ListingStatus.changes, ListingStatus.rejected] };

    const listings = await this.prisma.listing.findMany({
      where: { status, deletedAt: null },
      include: LISTING_INCLUDE,
      orderBy: tab === 'pending' ? { submittedAt: 'asc' } : { updatedAt: 'desc' },
    });

    return listings.map((listing) => this.toView(listing));
  }

  async getAdmin(id: string) {
    const listing = await this.findAny(id);
    return { ...this.toView(listing), checks: this.reviewChecks(listing) };
  }

  async approve(admin: AuthenticatedUser, id: string) {
    return this.decide(admin, id, ListingStatus.approved);
  }

  async reject(admin: AuthenticatedUser, id: string, dto: ModerateListingDto) {
    return this.decide(admin, id, ListingStatus.rejected, dto);
  }

  async requestChanges(admin: AuthenticatedUser, id: string, dto: ModerateListingDto) {
    return this.decide(admin, id, ListingStatus.changes, dto);
  }

  private async decide(
    admin: AuthenticatedUser,
    id: string,
    kind: 'approved' | 'rejected' | 'changes',
    dto?: ModerateListingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.findAny(id, tx);
      if (listing.status !== ListingStatus.pending) {
        throw this.invalidTransition(listing.status, kind);
      }
      if (kind !== ListingStatus.approved && !dto) {
        throw new AppException('validation.required', HttpStatus.BAD_REQUEST);
      }

      const approved = kind === ListingStatus.approved;
      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          status: kind,
          ...(approved
            ? {
                decisionKind: null,
                decisionReason: null,
                decisionFeedback: null,
                decisionStep: null,
                decisionBy: null,
                decisionAt: null,
              }
            : {
                decisionKind:
                  kind === ListingStatus.changes ? DecisionKind.changes : DecisionKind.rejected,
                decisionReason: dto!.reason,
                decisionFeedback: dto!.feedback,
                decisionStep: dto!.step ?? 1,
                decisionBy: admin.name,
                decisionAt: new Date(),
              }),
          history: {
            create: {
              actorId: admin.id,
              actorLabel: admin.name,
              action: approved
                ? 'Approved'
                : kind === ListingStatus.changes
                  ? 'Changes requested'
                  : 'Rejected',
              note: approved ? undefined : dto!.feedback,
            },
          },
        },
        include: LISTING_INCLUDE,
      });

      const name = updated.draft?.name ?? updated.code;
      const link = `#seller/listing/${updated.code}`;

      if (approved) {
        await this.notify(tx, {
          userId: updated.ownerId,
          type: NotificationType.approval,
          titleKey: 'notifications.listing.approved.title',
          titleParams: { name },
          bodyKey: 'notifications.listing.approved.body',
          bodyParams: { name },
          link,
        });
      } else if (kind === ListingStatus.changes) {
        await this.notify(tx, {
          userId: updated.ownerId,
          type: NotificationType.approval,
          titleKey: 'notifications.listing.changes.title',
          titleParams: { name },
          bodyKey: 'notifications.listing.changes.body',
          bodyParams: { name, reason: dto!.reason, feedback: dto!.feedback },
          link,
        });
      } else {
        await this.notify(tx, {
          userId: updated.ownerId,
          type: NotificationType.error,
          titleKey: 'notifications.listing.rejected.title',
          titleParams: { name },
          bodyKey: 'notifications.listing.rejected.body',
          bodyParams: { name, reason: dto!.reason, feedback: dto!.feedback },
          link,
        });
      }

      await this.log(
        tx,
        admin,
        'Admin',
        approved
          ? 'Approved listing'
          : kind === ListingStatus.changes
            ? 'Requested changes'
            : 'Rejected listing',
        name,
        `#admin/review/${updated.code}`,
      );

      return this.toView(updated);
    });
  }

  async takedown(admin: AuthenticatedUser, id: string, dto: TakedownListingDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.findAny(id, tx);
      if (
        listing.status !== ListingStatus.approved &&
        listing.status !== ListingStatus.paused
      ) {
        throw this.invalidTransition(listing.status, 'takedown');
      }

      const updated = await tx.listing.update({
        where: { id: listing.id },
        data: {
          status: ListingStatus.rejected,
          decisionKind: DecisionKind.rejected,
          decisionReason: 'Policy violation',
          decisionFeedback: dto.reason,
          decisionStep: 1,
          decisionBy: admin.name,
          decisionAt: new Date(),
          history: {
            create: {
              actorId: admin.id,
              actorLabel: admin.name,
              action: 'Taken down',
              note: dto.reason,
            },
          },
        },
        include: LISTING_INCLUDE,
      });

      const name = updated.draft?.name ?? updated.code;
      await this.notify(tx, {
        userId: updated.ownerId,
        type: NotificationType.error,
        titleKey: 'notifications.listing.takedown.title',
        titleParams: { name },
        bodyKey: 'notifications.listing.takedown.body',
        bodyParams: { name, reason: dto.reason },
        link: `#seller/listing/${updated.code}`,
      });
      await this.log(
        tx,
        admin,
        'Admin',
        'Took down listing',
        name,
        `#admin/review/${updated.code}`,
      );

      return this.toView(updated);
    });
  }

  async activity(limit = 100) {
    const bounded = Math.min(Math.max(limit, 1), 300);
    return this.prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: bounded,
    });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async findOwned(
    ownerId: string,
    id: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<ListingRecord> {
    const listing = await tx.listing.findFirst({
      where: {
        ownerId,
        deletedAt: null,
        OR: [{ id }, { code: id }],
      },
      include: LISTING_INCLUDE,
    });
    if (!listing) throw new AppException('listing.notFound', HttpStatus.NOT_FOUND);
    return listing;
  }

  private async findAny(
    id: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<ListingRecord> {
    const listing = await tx.listing.findFirst({
      where: { deletedAt: null, OR: [{ id }, { code: id }] },
      include: LISTING_INCLUDE,
    });
    if (!listing) throw new AppException('listing.notFound', HttpStatus.NOT_FOUND);
    return listing;
  }

  private async nextListingCode(tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ value: bigint }>>`
      INSERT INTO "Sequence" ("name", "value") VALUES ('listing', 48301)
      ON CONFLICT ("name") DO UPDATE SET "value" = "Sequence"."value" + 1
      RETURNING "value"
    `;
    return `FM-${rows[0].value.toString()}`;
  }

  private draftCreate(dto: SaveListingDto): Prisma.ListingDraftCreateWithoutListingInput {
    const saleMode = dto.saleMode ?? SaleMode.in_stock;
    this.assertPreorderFields(saleMode, dto.depositPct, dto.expectedReadyDate);

    return {
      name: dto.name ?? '',
      species: dto.species ?? '',
      breed: dto.breed ?? '',
      description: dto.description ?? '',
      ageMonths: dto.ageMonths ?? null,
      sizeCm: dto.sizeCm ?? null,
      gender: dto.gender ?? null,
      origin: dto.origin ?? null,
      health: dto.health ?? null,
      price: dto.price ?? 0,
      quantity: dto.quantity ?? 1,
      negotiable: dto.negotiable ?? false,
      location: dto.location ?? null,
      region: dto.region ?? null,
      shipping: dto.shipping ?? [],
      saleMode,
      depositPct: saleMode === SaleMode.pre_order ? (dto.depositPct ?? null) : null,
      expectedReadyDate:
        saleMode === SaleMode.pre_order && dto.expectedReadyDate
          ? new Date(dto.expectedReadyDate)
          : null,
      preorderPolicy: saleMode === SaleMode.pre_order ? (dto.preorderPolicy ?? null) : null,
      ...(dto.images !== undefined ? { images: { create: this.imageRows(dto.images) } } : {}),
    };
  }

  private draftUpdate(
    dto: SaveListingDto,
    current: NonNullable<ListingRecord['draft']>,
  ): Prisma.ListingDraftUpdateWithoutListingInput {
    const saleMode = dto.saleMode ?? current.saleMode;
    this.assertPreorderFields(
      saleMode,
      dto.depositPct ?? current.depositPct,
      dto.expectedReadyDate ?? current.expectedReadyDate?.toISOString(),
    );

    const data: Prisma.ListingDraftUpdateWithoutListingInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.species !== undefined) data.species = dto.species;
    if (dto.breed !== undefined) data.breed = dto.breed;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.ageMonths !== undefined) data.ageMonths = dto.ageMonths;
    if (dto.sizeCm !== undefined) data.sizeCm = dto.sizeCm;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.origin !== undefined) data.origin = dto.origin;
    if (dto.health !== undefined) data.health = dto.health;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.negotiable !== undefined) data.negotiable = dto.negotiable;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.shipping !== undefined) data.shipping = dto.shipping;
    if (dto.saleMode !== undefined) data.saleMode = dto.saleMode;

    if (saleMode === SaleMode.in_stock) {
      data.depositPct = null;
      data.expectedReadyDate = null;
      data.preorderPolicy = null;
    } else {
      if (dto.depositPct !== undefined) data.depositPct = dto.depositPct;
      if (dto.expectedReadyDate !== undefined) {
        data.expectedReadyDate = new Date(dto.expectedReadyDate);
      }
      if (dto.preorderPolicy !== undefined) data.preorderPolicy = dto.preorderPolicy;
    }

    return data;
  }

  private assertPreorderFields(
    saleMode: SaleMode,
    depositPct: number | null | undefined,
    expectedReadyDate: string | null | undefined,
  ): void {
    if (saleMode !== SaleMode.pre_order) return;
    if (depositPct === null || depositPct === undefined || depositPct < 20 || depositPct > 30) {
      throw new AppException('listing.depositPct', HttpStatus.BAD_REQUEST);
    }
    if (!expectedReadyDate || Number.isNaN(new Date(expectedReadyDate).getTime())) {
      throw new AppException('listing.expectedReadyDate', HttpStatus.BAD_REQUEST);
    }
  }

  private imageRows(images: ListingImageDto[]) {
    const mainIndex = images.findIndex((image) => image.isMain);
    return images.map((image, index) => ({
      url: image.url,
      position: image.position ?? index,
      isMain: mainIndex === -1 ? index === 0 : index === mainIndex,
    }));
  }

  private assertSubmittable(listing: ListingRecord): void {
    const draft = listing.draft;
    if (!draft) {
      throw new AppException('listing.incomplete', HttpStatus.BAD_REQUEST, { field: 'draft' });
    }

    const required: Array<[string, boolean]> = [
      ['name', draft.name.trim().length > 0],
      ['species', draft.species.trim().length > 0],
      ['description', draft.description.trim().length >= 20],
      ['ageMonths', draft.ageMonths !== null],
      ['sizeCm', draft.sizeCm !== null && draft.sizeCm > 0],
      ['gender', Boolean(draft.gender)],
      ['origin', Boolean(draft.origin)],
      ['health', Boolean(draft.health)],
      ['price', draft.price > 0],
      ['quantity', draft.quantity >= 1],
      ['images', draft.images.length > 0],
      ['location', Boolean(draft.location?.trim())],
      ['region', Boolean(draft.region?.trim())],
      ['shipping', draft.shipping.length > 0],
    ];

    const missing = required.find(([, ok]) => !ok);
    if (missing) {
      throw new AppException('listing.incomplete', HttpStatus.BAD_REQUEST, { field: missing[0] });
    }

    this.assertPreorderFields(
      draft.saleMode,
      draft.depositPct,
      draft.expectedReadyDate?.toISOString(),
    );
  }

  private invalidTransition(from: ListingStatus, action: string): AppException {
    return new AppException('listing.invalidTransition', HttpStatus.CONFLICT, {
      from,
      action,
    });
  }

  private reviewChecks(listing: ListingRecord) {
    const draft = listing.draft;
    return [
      { key: 'images', ok: (draft?.images.length ?? 0) > 0 },
      {
        key: 'details',
        ok: Boolean(
          draft?.name &&
            draft.species &&
            draft.description.length >= 20 &&
            draft.gender &&
            draft.origin &&
            draft.health,
        ),
      },
      { key: 'pricing', ok: (draft?.price ?? 0) > 0 && (draft?.quantity ?? 0) > 0 },
      { key: 'location', ok: Boolean(draft?.location && draft?.region) },
      {
        key: 'preorder',
        ok:
          draft?.saleMode !== SaleMode.pre_order ||
          (draft.depositPct !== null &&
            draft.depositPct >= 20 &&
            draft.depositPct <= 30 &&
            Boolean(draft.expectedReadyDate)),
      },
    ];
  }

  private toView(listing: ListingRecord) {
    const draft = listing.draft;
    return {
      id: listing.code,
      owner: listing.owner.email,
      sellerName: listing.sellerName,
      status: listing.status,
      draft: draft
        ? {
            name: draft.name,
            species: draft.species,
            breed: draft.breed,
            description: draft.description,
            ageMonths: draft.ageMonths,
            sizeCm: draft.sizeCm,
            gender: draft.gender,
            origin: draft.origin,
            health: draft.health,
            price: draft.price,
            quantity: draft.quantity,
            negotiable: draft.negotiable,
            images: draft.images.map((image) => ({
              id: image.id,
              url: image.url,
              position: image.position,
              isMain: image.isMain,
            })),
            mainId: (draft.images.find((image) => image.isMain) ?? draft.images[0])?.id ?? null,
            location: draft.location,
            region: draft.region,
            shipping: draft.shipping,
            saleMode: draft.saleMode,
            depositPct: draft.depositPct,
            expectedReadyDate: draft.expectedReadyDate,
            preorderPolicy: draft.preorderPolicy,
          }
        : null,
      decision: listing.decisionKind
        ? {
            kind: listing.decisionKind,
            reason: listing.decisionReason,
            feedback: listing.decisionFeedback,
            step: listing.decisionStep ?? 1,
            by: listing.decisionBy,
            at: listing.decisionAt,
          }
        : null,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      submittedAt: listing.submittedAt,
      views: listing.views,
      history: listing.history.map((entry) => ({
        at: entry.at,
        by: entry.actorLabel,
        action: entry.action,
        ...(entry.note ? { note: entry.note } : {}),
      })),
    };
  }

  private async notify(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void> {
    if (input.userId) {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { prefs: true },
      });
      const prefs = normalizePrefs(user?.prefs);
      if (
        (input.type === NotificationType.system && !prefs.system) ||
        (input.type === NotificationType.reminder && !prefs.reminders) ||
        (input.type === NotificationType.status && !prefs.status)
      ) {
        return;
      }
    }

    await tx.notification.create({
      data: {
        ...(input.userId ? { recipientId: input.userId } : {}),
        ...(input.role ? { recipientRole: input.role } : {}),
        type: input.type,
        titleKey: input.titleKey,
        titleParams: input.titleParams as Prisma.InputJsonValue | undefined,
        bodyKey: input.bodyKey,
        bodyParams: input.bodyParams as Prisma.InputJsonValue | undefined,
        link: input.link,
      },
    });
  }

  private async log(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    role: ActivityRole,
    action: string,
    target?: string,
    link?: string,
  ): Promise<void> {
    await tx.activity.create({
      data: {
        actorId: actor.id,
        actorLabel: actor.name,
        role,
        action,
        target,
        link,
      },
    });
  }
}
