import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { logActivity } from '../common/activity.js';
import { notify } from '../common/notifications.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  AdjustmentKind,
  BatchStatus,
  EscrowMilestone,
  EscrowState,
  HarvestStatus,
  NotificationType,
  PaymentMethod,
  PaymentPurpose,
  PaymentState,
  ShareUnitType,
  SponsorshipStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSponsorshipDto, HarvestBatchDto, LedgerQueryDto, ListSponsorshipsDto, PaySponsorshipDto } from './dto/sponsorship.dto.js';

/** Escrow split per §11.2/§11.8: 30% stocking, 40% mid-growth, remainder at harvest. */
const ESCROW_SPLIT = [
  { milestone: EscrowMilestone.stocking, pct: 30 },
  { milestone: EscrowMilestone.mid_growth, pct: 40 },
] as const;

const SPONSOR_INCLUDE = {
  sponsor: { select: { id: true, name: true, email: true, phone: true } },
  batch: {
    select: {
      id: true,
      code: true,
      title: true,
      species: true,
      status: true,
      location: true,
      region: true,
      shareUnitType: true,
      shareUnit: true,
      shareQuantity: true,
      stockingDate: true,
      expectedHarvestDate: true,
      images: { orderBy: { position: 'asc' as const }, take: 1 },
    },
  },
  payments: { orderBy: { createdAt: 'asc' as const } },
  escrowReleases: { orderBy: { createdAt: 'asc' as const } },
  adjustments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SponsorshipInclude;

const ACTIVE_STATUSES: SponsorshipStatus[] = [SponsorshipStatus.pending_payment, SponsorshipStatus.funded, SponsorshipStatus.growing];

type SponsorshipRow = Prisma.SponsorshipGetPayload<{ include: typeof SPONSOR_INCLUDE }>;

/**
 * API-facing sponsorship shape. The frontend validates responses against an
 * exact key allowlist, so storage-only columns (sponsorId, payment provider
 * metadata, image ordering fields) are stripped here rather than leaked.
 */
function serializeSponsorship(row: SponsorshipRow) {
  return {
    id: row.id,
    batchId: row.batchId,
    shares: row.shares,
    packageAmount: row.packageAmount,
    deliveryFee: row.deliveryFee,
    totalAmount: row.totalAmount,
    status: row.status,
    recipientName: row.recipientName,
    phone: row.phone,
    address: row.address,
    city: row.city,
    province: row.province,
    deliveryMethod: row.deliveryMethod,
    termsSnapshot: row.termsSnapshot,
    paidAt: row.paidAt,
    growingAt: row.growingAt,
    readyAt: row.readyAt,
    deliveredAt: row.deliveredAt,
    settledAt: row.settledAt,
    cancelledAt: row.cancelledAt,
    refundedAt: row.refundedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sponsor: row.sponsor,
    batch: {
      ...row.batch,
      images: row.batch.images.map((image) => ({ id: image.id, url: image.url })),
    },
    payments: row.payments.map((payment) => ({
      id: payment.id,
      purpose: payment.purpose,
      method: payment.method,
      amount: payment.amount,
      state: payment.state,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
    })),
    escrowReleases: row.escrowReleases.map((tranche) => ({
      id: tranche.id,
      milestone: tranche.milestone,
      amount: tranche.amount,
      state: tranche.state,
      releasedAt: tranche.releasedAt,
      createdAt: tranche.createdAt,
    })),
    adjustments: row.adjustments.map((adjustment) => ({
      id: adjustment.id,
      kind: adjustment.kind,
      amount: adjustment.amount,
      reason: adjustment.reason,
      status: adjustment.status,
      createdAt: adjustment.createdAt,
      appliedAt: adjustment.appliedAt,
    })),
  };
}

/** §11.4: unpaid reservations expire 24h after reservation; shares return to the pool. */
const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SponsorshipsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Unpaid-reservation expiry (§11.4: pending_payment ──expires──▶ cancelled)
  // -------------------------------------------------------------------------

  private duePendingWhere(now: Date): Prisma.SponsorshipWhereInput {
    return {
      status: SponsorshipStatus.pending_payment,
      createdAt: { lt: new Date(now.getTime() - RESERVATION_TTL_MS) },
    };
  }

  /**
   * Expire due unpaid reservations of one batch. The caller must already hold
   * the batch advisory lock `sponsor:batch:${code}`. Shares return to the pool
   * and a fully_sponsored batch reopens.
   */
  private async expireBatchInTx(tx: Prisma.TransactionClient, code: string): Promise<void> {
    const now = new Date();
    const due = await tx.sponsorship.findMany({
      where: { batch: { code }, ...this.duePendingWhere(now) },
      select: { id: true, shares: true, sponsorId: true },
    });
    if (!due.length) return;
    const batch = await tx.growOutBatch.findUnique({ where: { code }, select: { id: true, status: true } });
    if (!batch) return;
    for (const row of due) {
      const expired = await tx.sponsorship.updateMany({
        where: { id: row.id, status: SponsorshipStatus.pending_payment },
        data: { status: SponsorshipStatus.cancelled, cancelledAt: now },
      });
      if (!expired.count) continue;
      await tx.growOutBatch.update({
        where: { id: batch.id },
        data: {
          sharesAvailable: { increment: row.shares },
          ...(batch.status === BatchStatus.fully_sponsored ? { status: BatchStatus.open } : {}),
        },
      });
      await logActivity(tx, null, 'Unpaid reservation expired', code, `#company/batches/${code}`);
      await notify(tx, {
        userId: row.sponsorId,
        type: NotificationType.status,
        titleKey: 'notifications.buyer.reservationExpired.title',
        titleParams: { code },
        bodyKey: 'notifications.buyer.reservationExpired.body',
        bodyParams: { shares: row.shares },
        link: `#marketplace/sponsorships/${row.id}`,
      });
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: 'notifications.admin.reservationExpired.title',
        titleParams: { code },
        bodyKey: 'notifications.admin.reservationExpired.body',
        bodyParams: { shares: row.shares },
        link: `#company/batches/${code}`,
      });
    }
  }

  /** Lazy expiry on read paths; each affected batch is expired under its own advisory lock. */
  private async expireDue(sponsorId?: string): Promise<void> {
    const due = await this.prisma.sponsorship.findMany({
      where: { ...this.duePendingWhere(new Date()), ...(sponsorId ? { sponsorId } : {}) },
      select: { batch: { select: { code: true } } },
    });
    const codes = [...new Set(due.map((row) => row.batch.code))];
    for (const code of codes) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ locked: number }>>`
          SELECT 1::int AS "locked"
          FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:batch:${code}`}, 0))
        `;
        await this.expireBatchInTx(tx, code);
      });
    }
  }

  // -------------------------------------------------------------------------
  // Reserve (§11.4: choose shares + delivery, no payment yet)
  // -------------------------------------------------------------------------

  async reserve(user: AuthenticatedUser, code: string, dto: CreateSponsorshipDto) {
    const shares = dto.shares;
    if (!Number.isSafeInteger(shares) || shares < 1) {
      throw new AppException('sponsorship.invalidShares', HttpStatus.BAD_REQUEST);
    }
    return this.prisma.$transaction(async (tx) => {
      // Serialize reservations per batch so sharesAvailable can never oversell.
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:batch:${code}`}, 0))
      `;
      // Due unpaid reservations return their shares before the availability check.
      await this.expireBatchInTx(tx, code);
      const batch = await tx.growOutBatch.findUnique({
        where: { code },
        select: {
          id: true, code: true, companyId: true, status: true, sharesAvailable: true,
          title: true, species: true, breed: true, description: true, location: true, region: true,
          shareUnitType: true, shareUnit: true, shareQuantity: true, totalShares: true,
          expectedHarvestDate: true, packagePricePerShare: true, contingencyPct: true,
          riskDisclosure: true, termsVersion: true,
          farmVerified: true, inspectedAt: true, inspector: true,
          costBreakdown: { orderBy: { id: 'asc' as const } },
        },
      });
      if (!batch) throw new AppException('sponsorship.batchNotFound', HttpStatus.NOT_FOUND);
      if (batch.status !== BatchStatus.open) {
        throw new AppException('sponsorship.batchNotOpen', HttpStatus.CONFLICT);
      }
      if (batch.sharesAvailable < shares) {
        throw new AppException('sponsorship.insufficientShares', HttpStatus.CONFLICT);
      }
      const packageAmount = batch.packagePricePerShare * shares;
      if (!Number.isSafeInteger(packageAmount) || packageAmount > 2_147_483_647) {
        throw new AppException('sponsorship.invalidAmount', HttpStatus.BAD_REQUEST);
      }
      const remaining = batch.sharesAvailable - shares;
      const [sponsorship] = await Promise.all([
        tx.sponsorship.create({
          data: {
            batchId: batch.id,
            sponsorId: user.id,
            shares,
            packageAmount,
            deliveryFee: 0,
            totalAmount: packageAmount,
            status: SponsorshipStatus.pending_payment,
            recipientName: dto.recipientName,
            phone: dto.phone,
            address: dto.address,
            city: dto.city,
            province: dto.province,
            deliveryMethod: dto.deliveryMethod,
            termsSnapshot: {
              code: batch.code,
              title: batch.title,
              species: batch.species,
              breed: batch.breed,
              location: batch.location,
              region: batch.region,
              shareUnitType: batch.shareUnitType,
              shareUnit: batch.shareUnit,
              shareQuantity: batch.shareQuantity,
              totalShares: batch.totalShares,
              packagePricePerShare: batch.packagePricePerShare,
              contingencyPct: batch.contingencyPct,
              riskDisclosure: batch.riskDisclosure,
              termsVersion: batch.termsVersion,
              expectedHarvestDate: batch.expectedHarvestDate,
              farmVerified: batch.farmVerified,
              inspectedAt: batch.inspectedAt,
              inspector: batch.inspector,
              costs: batch.costBreakdown,
            } satisfies Prisma.InputJsonValue,
          },
          include: SPONSOR_INCLUDE,
        }),
        tx.growOutBatch.update({
          where: { id: batch.id },
          data: {
            sharesAvailable: { decrement: shares },
            ...(remaining === 0 ? { status: BatchStatus.fully_sponsored } : {}),
          },
        }),
      ]);
      await logActivity(tx, user, 'Reserved batch shares', batch.code, `#farming/${batch.code}`);
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: 'notifications.admin.sponsorshipReserved.title',
        titleParams: { code: batch.code, shares },
        bodyKey: 'notifications.admin.sponsorshipReserved.body',
        bodyParams: { name: user.name, shares },
        link: `#company/batches/${batch.code}`,
      });
      await notify(tx, {
        userId: user.id,
        type: NotificationType.status,
        titleKey: 'notifications.buyer.sponsorshipReserved.title',
        titleParams: { code: batch.code, shares },
        bodyKey: 'notifications.buyer.sponsorshipReserved.body',
        bodyParams: { shares, total: packageAmount },
        link: `#marketplace/sponsorships/${sponsorship.id}`,
      });
      return serializeSponsorship(sponsorship);
    });
  }

  // -------------------------------------------------------------------------
  // Pay (§11.4: full package price, idempotent; creates escrow tranches)
  // -------------------------------------------------------------------------

  async pay(user: AuthenticatedUser, id: string, dto: PaySponsorshipDto) {
    const key = `sponsorship:${id}:pay:${dto.idempotencyKey ?? randomUUID()}`;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:pay:${id}`}, 0))
      `;
      const replay = await tx.payment.findUnique({
        where: { idempotencyKey: key },
        include: { sponsorship: { include: SPONSOR_INCLUDE } },
      });
      if (replay?.sponsorship) {
        if (replay.sponsorship.sponsorId !== user.id) {
          throw new AppException('sponsorship.forbidden', HttpStatus.FORBIDDEN);
        }
        return serializeSponsorship(replay.sponsorship);
      }
      const sponsorship = await tx.sponsorship.findUnique({ where: { id }, include: { batch: true } });
      if (!sponsorship) throw new AppException('sponsorship.notFound', HttpStatus.NOT_FOUND);
      if (sponsorship.sponsorId !== user.id) {
        throw new AppException('sponsorship.forbidden', HttpStatus.FORBIDDEN);
      }
      if (sponsorship.status !== SponsorshipStatus.pending_payment) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      if (sponsorship.batch.status === BatchStatus.cancelled) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      // An expired reservation can no longer be paid; it is cancelled lazily on
      // the next read (throwing here would roll any expiry write back).
      if (sponsorship.createdAt.getTime() <= Date.now() - RESERVATION_TTL_MS) {
        throw new AppException('sponsorship.expired', HttpStatus.CONFLICT);
      }
      const now = new Date();
      // A batch that already reached growing puts the fresh payment straight into growing
      // and releases its stocking tranche immediately (§11.4: funded → growing).
      const growing = sponsorship.batch.status === BatchStatus.growing;
      // The harvest tranche absorbs the rounding remainder so tranches sum
      // exactly; it is written directly in the create because the response is
      // the update's in-memory snapshot — a follow-up tranche correction would
      // never be visible to the caller.
      const allocated = ESCROW_SPLIT.reduce(
        (sum, { pct }) => sum + Math.floor((sponsorship.packageAmount * pct) / 100),
        0,
      );
      const paid = await tx.sponsorship.update({
        where: { id },
        data: {
          status: growing ? SponsorshipStatus.growing : SponsorshipStatus.funded,
          paidAt: now,
          ...(growing ? { growingAt: now } : {}),
          payments: {
            create: {
              purpose: PaymentPurpose.sponsorship_package,
              method: dto.paymentMethod,
              idempotencyKey: key,
              amount: sponsorship.packageAmount,
              state: PaymentState.paid,
              paidAt: now,
            },
          },
          escrowReleases: {
            create: [
              ...ESCROW_SPLIT.map(({ milestone, pct }) => ({
                milestone,
                amount: Math.floor((sponsorship.packageAmount * pct) / 100),
                state: EscrowState.held,
              })),
              { milestone: EscrowMilestone.harvest, amount: sponsorship.packageAmount - allocated, state: EscrowState.held },
            ],
          },
        },
        include: SPONSOR_INCLUDE,
      });
      if (growing) {
        await tx.escrowRelease.updateMany({
          where: { sponsorshipId: id, milestone: EscrowMilestone.stocking, state: EscrowState.held },
          data: { state: EscrowState.released, releasedAt: now },
        });
      }
      await logActivity(tx, user, 'Paid sponsorship package', sponsorship.batch.code, `#marketplace/sponsorships/${id}`);
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.success,
        titleKey: 'notifications.admin.sponsorshipPaid.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: 'notifications.admin.sponsorshipPaid.body',
        bodyParams: { name: user.name, total: sponsorship.packageAmount },
        link: `#company/batches/${sponsorship.batch.code}`,
      });
      await notify(tx, {
        userId: user.id,
        type: NotificationType.success,
        titleKey: 'notifications.buyer.sponsorshipPaid.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: 'notifications.buyer.sponsorshipPaid.body',
        bodyParams: { total: sponsorship.packageAmount },
        link: `#marketplace/sponsorships/${id}`,
      });
      return serializeSponsorship(paid);
    });
  }

  // -------------------------------------------------------------------------
  // Sponsor views
  // -------------------------------------------------------------------------

  async mine(userId: string, query: ListSponsorshipsDto) {
    await this.expireDue(userId);
    const where: Prisma.SponsorshipWhereInput = {
      sponsorId: userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.sponsorship.findMany({
        where,
        include: SPONSOR_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take ?? 50,
      }),
      this.prisma.sponsorship.count({ where }),
    ]);
    return { items: items.map(serializeSponsorship), total };
  }

  /** §11 owner history: the sponsor's money events across all their sponsorships,
   *  newest first. Payments are the single ledger source — package and delivery-fee
   *  payments (a funded cancellation flips the original row to refunded) plus the
   *  refund-purpose rows shortfall issues. Unpaid reservations have no rows. */
  async ledger(userId: string, query: LedgerQueryDto) {
    const where: Prisma.PaymentWhereInput = { sponsorship: { sponsorId: userId } };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take ?? 50,
        select: {
          id: true,
          sponsorshipId: true,
          purpose: true,
          method: true,
          amount: true,
          state: true,
          createdAt: true,
          paidAt: true,
          refundedAt: true,
          sponsorship: { select: { shares: true, status: true, batch: { select: { code: true, title: true } } } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: rows.map((row) => {
        // The where clause guarantees the sponsorship exists; the type follows the
        // nullable Payment.sponsorshipId column.
        const sponsorship = row.sponsorship!;
        return {
          id: row.id,
          sponsorshipId: row.sponsorshipId,
          shares: sponsorship.shares,
          sponsorshipStatus: sponsorship.status,
          batchCode: sponsorship.batch.code,
          batchTitle: sponsorship.batch.title,
          purpose: row.purpose,
          method: row.method,
          amount: row.amount,
          state: row.state,
          createdAt: row.createdAt,
          paidAt: row.paidAt,
          refundedAt: row.refundedAt,
        };
      }),
      total,
    };
  }

  async one(user: AuthenticatedUser, id: string) {
    await this.expireDue(user.id);
    const sponsorship = await this.prisma.sponsorship.findUnique({
      where: { id },
      include: SPONSOR_INCLUDE,
    });
    if (!sponsorship) throw new AppException('sponsorship.notFound', HttpStatus.NOT_FOUND);
    if (sponsorship.sponsorId !== user.id) {
      throw new AppException('sponsorship.forbidden', HttpStatus.FORBIDDEN);
    }
    return serializeSponsorship(sponsorship);
  }

  async escrow(user: AuthenticatedUser, id: string) {
    const sponsorship = await this.one(user, id);
    const releases = sponsorship.escrowReleases;
    const held = releases.filter((row) => row.state === EscrowState.held).reduce((sum, row) => sum + row.amount, 0);
    const released = releases.filter((row) => row.state === EscrowState.released).reduce((sum, row) => sum + row.amount, 0);
    const reversed = releases.filter((row) => row.state === EscrowState.reversed).reduce((sum, row) => sum + row.amount, 0);
    return {
      sponsorshipId: sponsorship.id,
      packageAmount: sponsorship.packageAmount,
      tranches: releases.map((tranche) => ({
        id: tranche.id,
        milestone: tranche.milestone,
        amount: tranche.amount,
        state: tranche.state,
        releasedAt: tranche.releasedAt,
        createdAt: tranche.createdAt,
      })),
      held,
      released,
      reversed,
    };
  }

  // -------------------------------------------------------------------------
  // Cancel (§11.4: allowed before growing; funded reservations refund fully)
  // -------------------------------------------------------------------------

  async cancel(user: AuthenticatedUser, id: string, dto: { reason?: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:cancel:${id}`}, 0))
      `;
      const sponsorship = await tx.sponsorship.findUnique({ where: { id }, include: { batch: true } });
      if (!sponsorship) throw new AppException('sponsorship.notFound', HttpStatus.NOT_FOUND);
      if (sponsorship.sponsorId !== user.id) {
        throw new AppException('sponsorship.forbidden', HttpStatus.FORBIDDEN);
      }
      if (
        !([SponsorshipStatus.pending_payment, SponsorshipStatus.funded] as SponsorshipStatus[]).includes(sponsorship.status) ||
        sponsorship.batch.status === BatchStatus.cancelled
      ) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      const funded = sponsorship.status === SponsorshipStatus.funded;
      const now = new Date();
      const cancelled = await tx.sponsorship.update({
        where: { id },
        data: {
          status: funded ? SponsorshipStatus.refunded : SponsorshipStatus.cancelled,
          cancelledAt: now,
          ...(funded ? { refundedAt: now } : {}),
        },
        include: SPONSOR_INCLUDE,
      });
      await tx.growOutBatch.update({
        where: { id: sponsorship.batchId },
        data: {
          sharesAvailable: { increment: sponsorship.shares },
          ...(sponsorship.batch.status === BatchStatus.fully_sponsored
            ? { status: BatchStatus.open }
            : {}),
        },
      });
      if (funded) {
        await tx.payment.updateMany({
          where: { sponsorshipId: id, state: PaymentState.paid },
          data: { state: PaymentState.refunded, refundedAt: now },
        });
        await tx.escrowRelease.updateMany({
          where: { sponsorshipId: id, state: EscrowState.held },
          data: { state: EscrowState.reversed },
        });
        await tx.adjustment.create({
          data: {
            sponsorshipId: id,
            kind: AdjustmentKind.refund,
            amount: sponsorship.packageAmount,
            reason: dto?.reason ?? 'Cancelled before growing; unreleased escrow refunded in full',
            status: 'applied',
            appliedAt: now,
          },
        });
      }
      await logActivity(tx, user, funded ? 'Cancelled funded sponsorship' : 'Cancelled unpaid reservation', sponsorship.batch.code, `#marketplace/sponsorships/${id}`);
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: funded
          ? 'notifications.admin.sponsorshipRefunded.title'
          : 'notifications.admin.sponsorshipCancelled.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: funded
          ? 'notifications.admin.sponsorshipRefunded.body'
          : 'notifications.admin.sponsorshipCancelled.body',
        bodyParams: { name: user.name },
        link: `#company/batches/${sponsorship.batch.code}`,
      });
      await notify(tx, {
        userId: user.id,
        type: NotificationType.status,
        titleKey: funded
          ? 'notifications.buyer.sponsorshipRefunded.title'
          : 'notifications.buyer.sponsorshipCancelled.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: funded
          ? 'notifications.buyer.sponsorshipRefunded.body'
          : 'notifications.buyer.sponsorshipCancelled.body',
        bodyParams: funded ? { total: sponsorship.packageAmount } : { shares: sponsorship.shares },
        link: `#marketplace/sponsorships/${id}`,
      });
      return serializeSponsorship(cancelled);
    });
  }

  // -------------------------------------------------------------------------
  // Growing, harvest and settlement (§11.3–§11.5)
  // -------------------------------------------------------------------------

  async grow(admin: AuthenticatedUser, code: string) {
    return this.prisma.$transaction(async (tx) => {
      // Same lock as reservations/cancellation: growing must not interleave with
      // share changes or a fully_sponsored reopen.
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:batch:${code}`}, 0))
      `;
      // Due unpaid reservations release their shares before the batch leaves open.
      await this.expireBatchInTx(tx, code);
      const batch = await tx.growOutBatch.findUnique({
        where: { code },
        select: { id: true, code: true, status: true },
      });
      if (!batch) throw new AppException('sponsorship.batchNotFound', HttpStatus.NOT_FOUND);
      if (batch.status !== BatchStatus.open && batch.status !== BatchStatus.fully_sponsored) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      const now = new Date();
      const updated = await tx.growOutBatch.update({
        where: { id: batch.id },
        data: { status: BatchStatus.growing },
        select: { id: true, code: true, title: true, status: true, sharesAvailable: true, stockCount: true, stockingDate: true },
      });
      // Funded sponsorships begin growing and their stocking tranche is earned.
      const funded = await tx.sponsorship.findMany({
        where: { batchId: batch.id, status: SponsorshipStatus.funded },
        select: { id: true, shares: true, sponsorId: true },
      });
      if (funded.length) {
        const ids = funded.map((row) => row.id);
        await tx.sponsorship.updateMany({
          where: { id: { in: ids } },
          data: { status: SponsorshipStatus.growing, growingAt: now },
        });
        await tx.escrowRelease.updateMany({
          where: { sponsorshipId: { in: ids }, milestone: EscrowMilestone.stocking, state: EscrowState.held },
          data: { state: EscrowState.released, releasedAt: now },
        });
      }
      await logActivity(tx, admin, 'Started batch growing', code, `#company/batches/${code}`);
      for (const row of funded) {
        await notify(tx, {
          userId: row.sponsorId,
          type: NotificationType.status,
          titleKey: 'notifications.buyer.batchGrowing.title',
          titleParams: { code },
          bodyKey: 'notifications.buyer.batchGrowing.body',
          bodyParams: { shares: row.shares },
          link: '#marketplace/sponsorships',
        });
      }
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: 'notifications.admin.batchGrowing.title',
        titleParams: { code },
        bodyKey: 'notifications.admin.batchGrowing.body',
        link: `#company/batches/${code}`,
      });
      return updated;
    });
  }

  async harvest(admin: AuthenticatedUser, code: string, dto: HarvestBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:batch:${code}`}, 0))
      `;
      const batch = await tx.growOutBatch.findUnique({
        where: { code },
        select: {
          id: true, code: true, status: true, stockCount: true,
          shareUnitType: true, shareQuantity: true, totalShares: true, expectedHarvestWeightG: true,
        },
      });
      if (!batch) throw new AppException('sponsorship.batchNotFound', HttpStatus.NOT_FOUND);
      if (batch.status !== BatchStatus.growing) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      if (batch.shareUnitType === ShareUnitType.weight && (dto.actualWeightG ?? 0) < 1) {
        throw new AppException('sponsorship.harvestWeightRequired', HttpStatus.BAD_REQUEST);
      }
      const now = new Date();
      const promised = batch.shareUnitType === ShareUnitType.weight
        ? batch.expectedHarvestWeightG ?? (batch.shareQuantity ?? 0) * batch.totalShares
        : (batch.shareQuantity ?? 0) * batch.totalShares;
      const actual = batch.shareUnitType === ShareUnitType.weight ? dto.actualWeightG! : dto.actualCount;
      const mortalityRateBps = batch.stockCount > 0
        ? Math.max(0, Math.round(((batch.stockCount - dto.actualCount) / batch.stockCount) * 10_000))
        : 0;
      const yieldPerShare = batch.totalShares > 0
        ? batch.shareUnitType === ShareUnitType.weight
          ? `${((actual / batch.totalShares) / 1000).toFixed(3)} kg`
          : `${(actual / batch.totalShares).toFixed(2)} fish`
        : null;
      const harvestRow = await tx.harvest.create({
        data: {
          batchId: batch.id,
          harvestedAt: now,
          actualCount: dto.actualCount,
          actualWeightG: dto.actualWeightG ?? null,
          yieldPerShare,
          mortalityRateBps,
          status: HarvestStatus.published,
          publishedAt: now,
        },
      });
      await tx.growOutBatch.update({ where: { id: batch.id }, data: { status: BatchStatus.harvested } });
      // Growing sponsorships become ready for delivery; mid-growth escrow is earned.
      // Shortfall refunds pro-rata of the undelivered portion, capped at the held
      // harvest tranche — released escrow can never be recalled (§11.5).
      const growing = await tx.sponsorship.findMany({
        where: { batchId: batch.id, status: SponsorshipStatus.growing },
        select: {
          id: true, shares: true, sponsorId: true, packageAmount: true,
          payments: { where: { state: PaymentState.paid }, select: { method: true }, take: 1 },
          escrowReleases: {
            where: { milestone: EscrowMilestone.harvest, state: EscrowState.held },
            select: { id: true, amount: true },
          },
        },
      });
      const deliveryFeePerShare = dto.deliveryFeePerShare ?? 0;
      if (deliveryFeePerShare > 0) {
        for (const row of growing) {
          const total = row.packageAmount + deliveryFeePerShare * row.shares;
          if (!Number.isSafeInteger(total) || total > 2_147_483_647) {
            throw new AppException('sponsorship.invalidAmount', HttpStatus.BAD_REQUEST);
          }
        }
      }
      for (const row of growing) {
        await tx.escrowRelease.updateMany({
          where: { sponsorshipId: row.id, milestone: EscrowMilestone.mid_growth, state: EscrowState.held },
          data: { state: EscrowState.released, releasedAt: now },
        });
        const tranche = row.escrowReleases[0];
        const shortfallRatio = promised > 0 && actual < promised ? (promised - actual) / promised : 0;
        const refund = Math.min(tranche?.amount ?? 0, Math.floor(row.packageAmount * shortfallRatio));
        if (refund > 0 && tranche) {
          if (refund >= tranche.amount) {
            await tx.escrowRelease.update({ where: { id: tranche.id }, data: { state: EscrowState.reversed } });
          } else {
            await tx.escrowRelease.update({
              where: { id: tranche.id },
              data: { amount: tranche.amount - refund, state: EscrowState.released, releasedAt: now },
            });
          }
          await tx.payment.create({
            data: {
              sponsorshipId: row.id,
              purpose: PaymentPurpose.refund,
              method: row.payments[0]?.method ?? PaymentMethod.bank_transfer,
              idempotencyKey: `sponsorship:${row.id}:shortfall`,
              amount: refund,
              state: PaymentState.refunded,
              refundedAt: now,
            },
          });
          await tx.adjustment.create({
            data: {
              sponsorshipId: row.id,
              kind: AdjustmentKind.shortfall_refund,
              amount: refund,
              reason: `Shortfall: promised ${promised}, actual ${actual}`,
              status: 'applied',
              appliedAt: now,
            },
          });
          await notify(tx, {
            userId: row.sponsorId,
            type: NotificationType.status,
            titleKey: 'notifications.buyer.shortfallRefund.title',
            titleParams: { code },
            bodyKey: 'notifications.buyer.shortfallRefund.body',
            bodyParams: { amount: refund },
            link: `#marketplace/sponsorships/${row.id}`,
          });
        }
        await tx.sponsorship.update({
          where: { id: row.id },
          data: {
            status: SponsorshipStatus.ready_for_delivery,
            readyAt: now,
            // §11.4: the optional last-mile delivery fee is charged per share at
            // harvest; it sits outside escrow and is paid before delivery confirmation.
            ...(deliveryFeePerShare > 0
              ? { deliveryFee: deliveryFeePerShare * row.shares, totalAmount: row.packageAmount + deliveryFeePerShare * row.shares }
              : {}),
          },
        });
        await notify(tx, {
          userId: row.sponsorId,
          type: NotificationType.success,
          titleKey: 'notifications.buyer.batchHarvested.title',
          titleParams: { code },
          bodyKey: 'notifications.buyer.batchHarvested.body',
          bodyParams: { shares: row.shares },
          link: `#marketplace/sponsorships/${row.id}`,
        });
      }
      await logActivity(tx, admin, 'Published batch harvest', code, `#company/batches/${code}`);
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.success,
        titleKey: 'notifications.admin.batchHarvested.title',
        titleParams: { code },
        bodyKey: 'notifications.admin.batchHarvested.body',
        bodyParams: { actual: dto.actualCount },
        link: `#company/batches/${code}`,
      });
      return { batch: { id: batch.id, code: batch.code, status: BatchStatus.harvested }, harvest: harvestRow };
    });
  }

  async confirmDelivery(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const sponsorship = await tx.sponsorship.findUnique({
        where: { id },
        include: { batch: { select: { id: true, code: true, status: true } } },
      });
      if (!sponsorship) throw new AppException('sponsorship.notFound', HttpStatus.NOT_FOUND);
      if (sponsorship.sponsorId !== user.id) {
        throw new AppException('sponsorship.forbidden', HttpStatus.FORBIDDEN);
      }
      if (sponsorship.batch.status === BatchStatus.cancelled) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      // Batch-wide delivery lock: two concurrent confirmations must not both miss
      // the settlement transition, and settlement must not race with harvest.
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:batch:${sponsorship.batch.code}`}, 0))
      `;
      const current = await tx.sponsorship.findUniqueOrThrow({ where: { id } });
      if (
        current.status !== SponsorshipStatus.ready_for_delivery ||
        sponsorship.batch.status !== BatchStatus.harvested
      ) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      // §11.4: the optional delivery fee charged at harvest is paid before handover.
      if (current.deliveryFee > 0) {
        const feePaid = await tx.payment.findFirst({
          where: { sponsorshipId: id, purpose: PaymentPurpose.delivery_fee, state: PaymentState.paid },
          select: { id: true },
        });
        if (!feePaid) throw new AppException('sponsorship.deliveryFeeDue', HttpStatus.CONFLICT);
      }
      const now = new Date();
      await tx.sponsorship.update({
        where: { id },
        data: { status: SponsorshipStatus.delivered, deliveredAt: now },
      });
      // The batch settles when every sponsorship is delivered or refunded (§11.3);
      // delivered sponsorships settle with it.
      const remaining = await tx.sponsorship.count({
        where: {
          batchId: sponsorship.batchId,
          status: {
            in: [
              SponsorshipStatus.pending_payment,
              SponsorshipStatus.funded,
              SponsorshipStatus.growing,
              SponsorshipStatus.ready_for_delivery,
            ] as SponsorshipStatus[],
          },
        },
      });
      const settled = remaining === 0;
      if (settled) {
        await tx.growOutBatch.update({ where: { id: sponsorship.batchId }, data: { status: BatchStatus.settled } });
        await tx.sponsorship.updateMany({
          where: { batchId: sponsorship.batchId, status: SponsorshipStatus.delivered },
          data: { status: SponsorshipStatus.settled, settledAt: now },
        });
      }
      await logActivity(tx, user, 'Confirmed sponsorship delivery', sponsorship.batch.code, `#marketplace/sponsorships/${id}`);
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.status,
        titleKey: settled ? 'notifications.admin.batchSettled.title' : 'notifications.admin.sponsorshipDelivered.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: settled ? 'notifications.admin.batchSettled.body' : 'notifications.admin.sponsorshipDelivered.body',
        bodyParams: settled ? undefined : { name: user.name },
        link: `#company/batches/${sponsorship.batch.code}`,
      });
      await notify(tx, {
        userId: user.id,
        type: NotificationType.success,
        titleKey: settled ? 'notifications.buyer.batchSettled.title' : 'notifications.buyer.sponsorshipDelivered.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: settled ? 'notifications.buyer.batchSettled.body' : 'notifications.buyer.sponsorshipDelivered.body',
        bodyParams: settled ? undefined : { shares: current.shares },
        link: `#marketplace/sponsorships/${id}`,
      });
      const result = await tx.sponsorship.findUniqueOrThrow({ where: { id }, include: SPONSOR_INCLUDE });
      return serializeSponsorship(result);
    });
  }

  // -------------------------------------------------------------------------
  // Delivery fee (§11.4: the only possible later charge, due before handover)
  // -------------------------------------------------------------------------

  async payDeliveryFee(user: AuthenticatedUser, id: string, dto: PaySponsorshipDto) {
    // One fixed key: the fee is a single charge, so a replay returns the same record.
    const key = `sponsorship:${id}:delivery-fee`;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(hashtextextended(${`sponsor:pay:${id}`}, 0))
      `;
      const replay = await tx.payment.findUnique({
        where: { idempotencyKey: key },
        include: { sponsorship: { include: SPONSOR_INCLUDE } },
      });
      if (replay?.sponsorship) {
        if (replay.sponsorship.sponsorId !== user.id) {
          throw new AppException('sponsorship.forbidden', HttpStatus.FORBIDDEN);
        }
        return serializeSponsorship(replay.sponsorship);
      }
      const sponsorship = await tx.sponsorship.findUnique({ where: { id }, include: { batch: true } });
      if (!sponsorship) throw new AppException('sponsorship.notFound', HttpStatus.NOT_FOUND);
      if (sponsorship.sponsorId !== user.id) {
        throw new AppException('sponsorship.forbidden', HttpStatus.FORBIDDEN);
      }
      if (sponsorship.status !== SponsorshipStatus.ready_for_delivery || sponsorship.batch.status === BatchStatus.cancelled) {
        throw new AppException('sponsorship.invalidTransition', HttpStatus.CONFLICT);
      }
      if (sponsorship.deliveryFee <= 0) {
        throw new AppException('sponsorship.deliveryFeeNothingDue', HttpStatus.CONFLICT);
      }
      const paid = await tx.sponsorship.update({
        where: { id },
        data: {
          payments: {
            create: {
              purpose: PaymentPurpose.delivery_fee,
              method: dto.paymentMethod,
              idempotencyKey: key,
              amount: sponsorship.deliveryFee,
              state: PaymentState.paid,
              paidAt: new Date(),
            },
          },
        },
        include: SPONSOR_INCLUDE,
      });
      await logActivity(tx, user, 'Paid sponsorship delivery fee', sponsorship.batch.code, `#marketplace/sponsorships/${id}`);
      await notify(tx, {
        role: 'Admin',
        type: NotificationType.success,
        titleKey: 'notifications.admin.sponsorshipDeliveryFeePaid.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: 'notifications.admin.sponsorshipDeliveryFeePaid.body',
        bodyParams: { name: user.name, total: sponsorship.deliveryFee },
        link: `#company/batches/${sponsorship.batch.code}`,
      });
      await notify(tx, {
        userId: user.id,
        type: NotificationType.success,
        titleKey: 'notifications.buyer.sponsorshipDeliveryFeePaid.title',
        titleParams: { code: sponsorship.batch.code },
        bodyKey: 'notifications.buyer.sponsorshipDeliveryFeePaid.body',
        bodyParams: { total: sponsorship.deliveryFee },
        link: `#marketplace/sponsorships/${id}`,
      });
      return serializeSponsorship(paid);
    });
  }

  // -------------------------------------------------------------------------
  // Company (Admin) views
  // -------------------------------------------------------------------------

  async companyList(query: ListSponsorshipsDto) {
    await this.expireDue();
    const where: Prisma.SponsorshipWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.sponsorship.findMany({
        where,
        include: SPONSOR_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take ?? 50,
      }),
      this.prisma.sponsorship.count({ where }),
    ]);
    return { items: items.map(serializeSponsorship), total };
  }

  async companySponsors(batchCode: string) {
    await this.expireDue();
    const batch = await this.prisma.growOutBatch.findUnique({
      where: { code: batchCode },
      select: { id: true, code: true },
    });
    if (!batch) throw new AppException('sponsorship.batchNotFound', HttpStatus.NOT_FOUND);
    const items = await this.prisma.sponsorship.findMany({
      where: {
        batchId: batch.id,
        status: {
          in: [
            ...ACTIVE_STATUSES,
            SponsorshipStatus.ready_for_delivery,
            SponsorshipStatus.delivered,
            SponsorshipStatus.settled,
            SponsorshipStatus.refunded,
          ] as SponsorshipStatus[],
        },
      },
      include: SPONSOR_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return { batch: { id: batch.id, code: batch.code }, items: items.map(serializeSponsorship) };
  }
}
