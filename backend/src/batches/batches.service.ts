import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types.js';
import { logActivity } from '../common/activity.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { notify } from '../common/notifications.js';
import { CompanyService } from '../company/company.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { BatchStatus, NotificationType, ShareUnitType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UPLOAD_URL_PREFIX } from '../uploads/upload.config.js';
import type { BatchReviewDto, BatchUpdateDto, SaveBatchDto, UpdateBatchDto } from './dto/batch.dto.js';
import type { CompanyBatchQueryDto, PublicBatchQueryDto } from './dto/batch-query.dto.js';

const INCLUDE = {
  facility: { include: { verification: { include: { documents: { select: { id: true, uploadId: true, type: true } } } } } },
  company: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  images: { orderBy: { position: 'asc' as const } },
  costBreakdown: { orderBy: { id: 'asc' as const } },
  updates: {
    include: { photos: true, createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  harvest: { select: { id: true } },
  _count: { select: { sponsorships: true } },
} satisfies Prisma.GrowOutBatchInclude;

type BatchRecord = Prisma.GrowOutBatchGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanyService,
  ) {}

  async publicList(query: PublicBatchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.GrowOutBatchWhereInput = {
      status: BatchStatus.open,
      sharesAvailable: { gt: 0 },
      facility: { verification: {
        ...this.currentComplianceWhere(),
        documents: { some: {}, none: { uploadId: null } },
      } },
      ...(query.species ? { species: { equals: query.species, mode: 'insensitive' } } : {}),
      ...(query.region ? { region: { equals: query.region, mode: 'insensitive' } } : {}),
      ...(query.harvestBefore ? { expectedHarvestDate: { lte: new Date(query.harvestBefore) } } : {}),
      ...(query.priceMax !== undefined ? { packagePricePerShare: { lte: query.priceMax } } : {}),
      ...(query.q ? { OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { species: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.growOutBatch.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.growOutBatch.count({ where }),
    ]);
    return { items: items.map((batch) => this.publicView(batch)), page, limit, total, pages: Math.ceil(total / limit) };
  }

  async publicOne(id: string) {
    const batch = await this.find(id);
    if (!this.isPublic(batch)) throw new AppException('batch.notFound', HttpStatus.NOT_FOUND);
    return this.publicView(batch);
  }

  async publicUpdates(id: string) {
    const batch = await this.find(id);
    if (!this.isPublic(batch)) throw new AppException('batch.notFound', HttpStatus.NOT_FOUND);
    return batch.updates.map((update) => this.updateView(update));
  }

  async companyList(query: CompanyBatchQueryDto) {
    return (await this.prisma.growOutBatch.findMany({
      where: query.status ? { status: query.status } : {}, include: INCLUDE, orderBy: { updatedAt: 'desc' },
    })).map((batch) => this.companyView(batch));
  }

  async companyOne(id: string) { return this.companyView(await this.find(id)); }

  async create(admin: AuthenticatedUser, dto: SaveBatchDto) {
    await this.assertPublicImageSources(dto.images?.map((image) => image.url) ?? [], 'batch_image');
    const company = await this.company.current();
    await this.assertFacility(dto.facilityId);
    const totals = this.deriveShares(dto);
    const batch = await this.prisma.$transaction(async (tx) => {
      await this.assertFacilityTx(tx, dto.facilityId);
      const created = await tx.growOutBatch.create({
        data: {
          code: await this.nextCode(tx), companyId: company.id, facilityId: dto.facilityId, createdById: admin.id,
          title: dto.title, species: dto.species, breed: dto.breed, description: dto.description,
          location: dto.location, region: dto.region, stockingDate: dto.stockingDate ? new Date(dto.stockingDate) : null,
          expectedHarvestDate: dto.expectedHarvestDate ? new Date(dto.expectedHarvestDate) : null,
          stockCount: dto.stockCount, shareUnitType: dto.shareUnitType,
          shareUnit: this.shareUnit(dto.shareUnitType, dto.shareQuantity), shareQuantity: dto.shareQuantity,
          expectedHarvestWeightG: dto.shareUnitType === ShareUnitType.weight ? dto.expectedHarvestWeightG : null,
          totalShares: totals, sharesAvailable: totals, packagePricePerShare: dto.packagePricePerShare,
          contingencyPct: dto.contingencyPct ?? 10, riskDisclosure: dto.riskDisclosure, termsVersion: dto.termsVersion,
          images: dto.images?.length ? { create: dto.images.map((image, index) => ({ url: image.url, position: image.position ?? index, isMain: index === 0 })) } : undefined,
          costBreakdown: { create: dto.costs },
        },
        include: INCLUDE,
      });
      await logActivity(tx, admin, 'Created batch draft', created.code, `#company/batches/${created.code}`);
      return created;
    });
    return this.companyView(batch);
  }

  async update(admin: AuthenticatedUser, id: string, dto: UpdateBatchDto) {
    await this.assertPublicImageSources(dto.images?.map((image) => image.url) ?? [], 'batch_image');
    const existing = await this.find(id);
    if (existing.status !== BatchStatus.draft) throw new AppException('batch.draftOnly', HttpStatus.CONFLICT);
    const batch = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, existing.id);
      const current = await this.findTx(tx, existing.id);
      if (current.status !== BatchStatus.draft) throw new AppException('batch.draftOnly', HttpStatus.CONFLICT);
      const merged = this.mergeDto(current, dto);
      const totalShares = this.deriveShares(merged);
      await this.assertFacilityTx(tx, merged.facilityId);
      const updated = await tx.growOutBatch.update({
        where: { id: current.id },
        data: {
          facilityId: merged.facilityId, title: merged.title, species: merged.species, breed: merged.breed,
          description: merged.description, location: merged.location, region: merged.region,
          stockingDate: merged.stockingDate ? new Date(merged.stockingDate) : null,
          expectedHarvestDate: merged.expectedHarvestDate ? new Date(merged.expectedHarvestDate) : null,
          stockCount: merged.stockCount, shareUnitType: merged.shareUnitType,
          shareUnit: this.shareUnit(merged.shareUnitType, merged.shareQuantity), shareQuantity: merged.shareQuantity,
          expectedHarvestWeightG: merged.shareUnitType === ShareUnitType.weight ? merged.expectedHarvestWeightG : null,
          totalShares, sharesAvailable: totalShares, packagePricePerShare: merged.packagePricePerShare,
          contingencyPct: merged.contingencyPct ?? 10, riskDisclosure: merged.riskDisclosure, termsVersion: merged.termsVersion,
          ...(dto.images !== undefined ? { images: { deleteMany: {}, ...(dto.images.length ? { create: dto.images.map((image, index) => ({ url: image.url, position: image.position ?? index, isMain: index === 0 })) } : {}) } } : {}),
          ...(dto.costs !== undefined ? { costBreakdown: { deleteMany: {}, create: dto.costs } } : {}),
        }, include: INCLUDE,
      });
      await logActivity(tx, admin, 'Updated batch draft', current.code, `#company/batches/${current.code}`);
      return updated;
    });
    return this.companyView(batch);
  }

  async remove(admin: AuthenticatedUser, id: string) {
    const existing = await this.find(id);
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, existing.id);
      const current = await this.findTx(tx, existing.id);
      if (
        current.status !== BatchStatus.draft || current._count.sponsorships ||
        current.updates.length || current.harvest
      ) {
        throw new AppException('batch.deleteForbidden', HttpStatus.CONFLICT);
      }
      await tx.growOutBatch.delete({ where: { id: current.id } });
      await logActivity(
        tx,
        admin,
        'Deleted batch draft',
        current.code,
        `#company/batches/${current.code}`,
      );
    });
    return { id: existing.code, deleted: true };
  }

  async publish(admin: AuthenticatedUser, id: string) {
    return this.open(admin, id, BatchStatus.draft, 'Published batch');
  }

  async submit(admin: AuthenticatedUser, id: string) {
    const existing = await this.find(id);
    if (existing.status !== BatchStatus.draft) throw this.invalid(existing.status, 'submit');
    this.assertPublishable(existing);
    const batch = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, existing.id);
      let current = await this.findTx(tx, existing.id);
      if (current.facilityId) {
        await this.lockFacility(tx, current.facilityId);
        current = await this.findTx(tx, existing.id);
      }
      if (current.status !== BatchStatus.draft) throw this.invalid(current.status, 'submit');
      this.assertPublishable(current);
      const updated = await tx.growOutBatch.update({ where: { id: current.id }, data: { status: BatchStatus.pending_review, submittedAt: new Date(), reviewNote: null }, include: INCLUDE });
      await notify(tx, { role: 'Admin', type: NotificationType.status, titleKey: 'notifications.admin.batchSubmitted.title', titleParams: { code: current.code }, bodyKey: 'notifications.admin.batchSubmitted.body', link: `#admin/batches/${current.code}` });
      await logActivity(tx, admin, 'Submitted batch for review', current.code, `#admin/batches/${current.code}`);
      return updated;
    });
    return this.companyView(batch);
  }

  async queue() {
    return (await this.prisma.growOutBatch.findMany({ where: { status: BatchStatus.pending_review }, include: INCLUDE, orderBy: { submittedAt: 'asc' } })).map((batch) => this.companyView(batch));
  }

  async approve(admin: AuthenticatedUser, id: string) {
    return this.open(admin, id, BatchStatus.pending_review, 'Approved batch');
  }

  async reject(admin: AuthenticatedUser, id: string, dto: BatchReviewDto) {
    const existing = await this.find(id);
    if (existing.status !== BatchStatus.pending_review) throw this.invalid(existing.status, 'reject');
    const batch = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, existing.id);
      const current = await this.findTx(tx, existing.id);
      if (current.status !== BatchStatus.pending_review) throw this.invalid(current.status, 'reject');
      const updated = await tx.growOutBatch.update({ where: { id: current.id }, data: { status: BatchStatus.draft, reviewedAt: new Date(), reviewedBy: admin.name, reviewNote: dto.note }, include: INCLUDE });
      await logActivity(tx, admin, 'Rejected batch review', current.code, `#company/batches/${current.code}`);
      return updated;
    });
    return this.companyView(batch);
  }

  async cancel(admin: AuthenticatedUser, id: string, dto: BatchReviewDto) {
    const existing = await this.find(id);
    const allowed: BatchStatus[] = [BatchStatus.draft, BatchStatus.pending_review, BatchStatus.open];
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, existing.id);
      const current = await this.findTx(tx, existing.id);
      if (!allowed.includes(current.status) || current._count.sponsorships) {
        throw new AppException('batch.cancelForbidden', HttpStatus.CONFLICT);
      }
      const cancelled = await tx.growOutBatch.update({
        where: { id: current.id },
        data: {
          status: BatchStatus.cancelled,
          cancelledAt: new Date(),
          cancelReason: dto.note,
        },
        include: INCLUDE,
      });
      await logActivity(
        tx,
        admin,
        'Cancelled batch',
        current.code,
        `#company/batches/${current.code}`,
      );
      return cancelled;
    });
    return this.companyView(updated);
  }

  async addUpdate(admin: AuthenticatedUser, id: string, dto: BatchUpdateDto) {
    const batch = await this.find(id);
    await this.assertPublicImageSources(dto.photoUrls ?? [], 'batch_update');
    const update = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, batch.id);
      const current = await this.findTx(tx, batch.id);
      if (
        current.status === BatchStatus.draft || current.status === BatchStatus.pending_review ||
        current.status === BatchStatus.cancelled
      ) {
        throw new AppException('batch.updateForbidden', HttpStatus.CONFLICT);
      }
      const created = await tx.batchUpdate.create({ data: { batchId: current.id, createdById: admin.id, stage: dto.stage, averageWeightG: dto.averageWeightG, countAlive: dto.countAlive, note: dto.note, photos: dto.photoUrls?.length ? { create: dto.photoUrls.map((url) => ({ url })) } : undefined }, include: { photos: true, createdBy: { select: { name: true } } } });
      await logActivity(tx, admin, 'Posted batch update', current.code, `#company/batches/${current.code}`);
      return created;
    });
    return this.updateView(update);
  }

  private async open(admin: AuthenticatedUser, id: string, from: BatchStatus, action: string) {
    const existing = await this.find(id);
    if (existing.status !== from) throw this.invalid(existing.status, from === BatchStatus.draft ? 'publish' : 'approve');
    this.assertPublishable(existing);
    const batch = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, existing.id);
      let current = await this.findTx(tx, existing.id);
      if (current.facilityId) {
        await this.lockFacility(tx, current.facilityId);
        current = await this.findTx(tx, existing.id);
      }
      if (current.status !== from) throw this.invalid(current.status, 'open');
      this.assertPublishable(current);
      const verification = current.facility!.verification!;
      const updated = await tx.growOutBatch.update({
        where: { id: current.id }, data: {
          status: BatchStatus.open, submittedAt: current.submittedAt ?? new Date(),
          reviewedAt: new Date(), reviewedBy: admin.name, reviewNote: null,
          farmVerified: true, inspectedAt: verification.inspectedAt, inspector: verification.inspector,
        }, include: INCLUDE,
      });
      await logActivity(tx, admin, action, current.code, `#company/batches/${current.code}`);
      return updated;
    });
    return this.companyView(batch);
  }

  private mergeDto(batch: BatchRecord, dto: UpdateBatchDto): SaveBatchDto {
    return {
      title: dto.title ?? batch.title,
      species: dto.species ?? batch.species,
      breed: dto.breed ?? batch.breed ?? undefined,
      description: dto.description ?? batch.description,
      location: dto.location ?? batch.location,
      region: dto.region ?? batch.region,
      stockingDate: dto.stockingDate ?? batch.stockingDate?.toISOString(),
      expectedHarvestDate: dto.expectedHarvestDate ?? batch.expectedHarvestDate?.toISOString(),
      stockCount: dto.stockCount ?? batch.stockCount,
      shareUnitType: dto.shareUnitType ?? batch.shareUnitType,
      shareQuantity: dto.shareQuantity ?? batch.shareQuantity ?? 0,
      expectedHarvestWeightG: dto.expectedHarvestWeightG ?? batch.expectedHarvestWeightG ?? undefined,
      packagePricePerShare: dto.packagePricePerShare ?? batch.packagePricePerShare,
      contingencyPct: dto.contingencyPct ?? batch.contingencyPct,
      riskDisclosure: dto.riskDisclosure ?? batch.riskDisclosure,
      termsVersion: dto.termsVersion ?? batch.termsVersion,
      facilityId: dto.facilityId ?? batch.facilityId ?? '',
      images: dto.images ?? batch.images.map(({ url, position }) => ({ url, position })),
      costs: dto.costs ?? batch.costBreakdown.map(({ category, label, amount, allocation, note }) => ({ category, label, amount, allocation, note: note ?? undefined })),
    };
  }

  private deriveShares(dto: SaveBatchDto) {
    if (dto.shareUnitType === ShareUnitType.weight) {
      if (!dto.expectedHarvestWeightG) throw new AppException('batch.expectedHarvestWeightRequired', HttpStatus.BAD_REQUEST);
      const shares = Math.floor(dto.expectedHarvestWeightG / dto.shareQuantity);
      if (shares < 1) throw new AppException('batch.invalidShares', HttpStatus.BAD_REQUEST);
      return shares;
    }
    const shares = Math.floor(dto.stockCount / dto.shareQuantity);
    if (shares < 1) throw new AppException('batch.invalidShares', HttpStatus.BAD_REQUEST);
    return shares;
  }

  private assertPublishable(batch: BatchRecord) {
    if (!batch.shareQuantity || batch.totalShares < 1) throw new AppException('batch.invalidShares', HttpStatus.BAD_REQUEST);
    const derived = batch.shareUnitType === ShareUnitType.weight
      ? Math.floor((batch.expectedHarvestWeightG ?? 0) / batch.shareQuantity)
      : Math.floor(batch.stockCount / batch.shareQuantity);
    if (derived !== batch.totalShares || batch.sharesAvailable !== batch.totalShares) throw new AppException('batch.invalidShares', HttpStatus.BAD_REQUEST);
    const costs = batch.costBreakdown.reduce((total, item) => total + (item.allocation === 'per_share' ? item.amount * batch.totalShares : item.amount), 0);
    if (costs !== batch.packagePricePerShare * batch.totalShares) throw new AppException('batch.costMismatch', HttpStatus.BAD_REQUEST, { expected: batch.packagePricePerShare * batch.totalShares, actual: costs });
    if (!batch.images.length) throw new AppException('batch.imagesRequired', HttpStatus.BAD_REQUEST);
    if (!batch.facility || !this.currentCompliance(batch.facility.verification)) throw new AppException('batch.complianceRequired', HttpStatus.CONFLICT);
    const docs = batch.facility.verification!.documents;
    if (!docs.length || docs.some((document) => !document.uploadId)) throw new AppException('batch.controlledDocumentsRequired', HttpStatus.CONFLICT);
  }

  private currentCompliance(verification: BatchRecord['facility'] extends null ? never : NonNullable<BatchRecord['facility']>['verification']) {
    return Boolean(verification && verification.status === 'approved' && verification.level !== 'none' && verification.validUntil && verification.validUntil > new Date());
  }

  private currentComplianceWhere(): Prisma.FarmVerificationWhereInput {
    return { status: 'approved', level: { not: 'none' }, validUntil: { gt: new Date() } };
  }

  private isPublic(batch: BatchRecord) {
    const verification = batch.facility?.verification;
    return batch.status === BatchStatus.open && batch.sharesAvailable > 0 &&
      this.currentCompliance(verification ?? null) && Boolean(verification?.documents.length) &&
      verification!.documents.every((document) => Boolean(document.uploadId));
  }

  private async find(id: string): Promise<BatchRecord> {
    const batch = await this.prisma.growOutBatch.findFirst({ where: { OR: [{ id }, { code: id }] }, include: INCLUDE });
    if (!batch) throw new AppException('batch.notFound', HttpStatus.NOT_FOUND);
    return batch;
  }

  private async findTx(tx: Prisma.TransactionClient, id: string): Promise<BatchRecord> { return tx.growOutBatch.findUniqueOrThrow({ where: { id }, include: INCLUDE }); }
  private async lock(tx: Prisma.TransactionClient, id: string) { await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "GrowOutBatch" WHERE "id" = ${id} FOR UPDATE`; }
  private async lockFacility(tx: Prisma.TransactionClient, id: string) { await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Facility" WHERE "id" = ${id} FOR UPDATE`; }
  private async nextCode(tx: Prisma.TransactionClient) { const rows = await tx.$queryRaw<Array<{ value: bigint }>>`INSERT INTO "Sequence" ("name", "value") VALUES ('batch', 1024) ON CONFLICT ("name") DO UPDATE SET "value" = "Sequence"."value" + 1 RETURNING "value"`; return `BATCH-${rows[0].value}`; }
  private shareUnit(type: ShareUnitType, quantity: number) { return type === ShareUnitType.weight ? `${quantity / 1000} kg` : `${quantity} fish`; }
  private invalid(from: BatchStatus, action: string) { return new AppException('batch.invalidTransition', HttpStatus.CONFLICT, { from, action }); }

  private async assertFacility(id: string) {
    if (!await this.prisma.facility.findUnique({ where: { id }, select: { id: true } })) {
      throw new AppException('facility.notFound', HttpStatus.NOT_FOUND);
    }
  }

  private async assertFacilityTx(tx: Prisma.TransactionClient, id: string) {
    if (!await tx.facility.findUnique({ where: { id }, select: { id: true } })) {
      throw new AppException('facility.notFound', HttpStatus.NOT_FOUND);
    }
  }

  private async assertPublicImageSources(urls: string[], purpose: 'batch_image' | 'batch_update') {
    const local = [...new Set(urls.filter((url) => url.startsWith(`${UPLOAD_URL_PREFIX}/`)))];
    if (urls.some((url) => !url.startsWith(`${UPLOAD_URL_PREFIX}/`) && !/^https?:\/\//i.test(url))) throw new AppException('batch.invalidImageUrl', HttpStatus.BAD_REQUEST);
    if (local.length && await this.prisma.upload.count({ where: { url: { in: local }, purpose } }) !== local.length) throw new AppException('uploads.invalidReference', HttpStatus.BAD_REQUEST);
  }

  private publicView(batch: BatchRecord) {
    return {
      id: batch.code, title: batch.title, species: batch.species, breed: batch.breed, description: batch.description,
      location: batch.location, region: batch.region, status: batch.status, stockingDate: batch.stockingDate,
      expectedHarvestDate: batch.expectedHarvestDate, stockCount: batch.stockCount, shareUnitType: batch.shareUnitType,
      shareUnit: batch.shareUnit, shareQuantity: batch.shareQuantity,
      expectedHarvestWeightG: batch.expectedHarvestWeightG, totalShares: batch.totalShares,
      sharesAvailable: batch.sharesAvailable, packagePricePerShare: batch.packagePricePerShare,
      contingencyPct: batch.contingencyPct, riskDisclosure: batch.riskDisclosure, termsVersion: batch.termsVersion,
      images: batch.images.map(({ id, url, position, isMain }) => ({ id, url, position, isMain })),
      costs: batch.costBreakdown.map(({ category, label, amount, allocation, note }) => ({ category, label, amount, allocation, note })),
      compliance: { level: batch.facility!.verification!.level, inspectedAt: batch.facility!.verification!.inspectedAt, validUntil: batch.facility!.verification!.validUntil },
      facility: { id: batch.facility!.id, name: batch.facility!.name, location: batch.facility!.location },
      updates: batch.updates.map((update) => this.updateView(update)), createdAt: batch.createdAt, updatedAt: batch.updatedAt,
    };
  }

  private companyView(batch: BatchRecord) {
    return {
      ...this.publicViewBase(batch), createdBy: batch.createdBy, facility: batch.facility ? {
        id: batch.facility.id, name: batch.facility.name, location: batch.facility.location,
        verification: batch.facility.verification ? {
          id: batch.facility.verification.id, level: batch.facility.verification.level,
          status: batch.facility.verification.status, inspectedAt: batch.facility.verification.inspectedAt,
          inspector: batch.facility.verification.inspector, validUntil: batch.facility.verification.validUntil,
          documents: batch.facility.verification.documents.map(({ id, type, uploadId }) => ({ id, type, controlled: Boolean(uploadId) })),
        } : null,
      } : null,
      reviewedAt: batch.reviewedAt, reviewedBy: batch.reviewedBy, reviewNote: batch.reviewNote,
      submittedAt: batch.submittedAt, cancelledAt: batch.cancelledAt, cancelReason: batch.cancelReason,
      sponsorshipCount: batch._count.sponsorships,
    };
  }

  private publicViewBase(batch: BatchRecord) {
    return {
      id: batch.code, title: batch.title, species: batch.species, breed: batch.breed, description: batch.description,
      location: batch.location, region: batch.region, status: batch.status, stockingDate: batch.stockingDate,
      expectedHarvestDate: batch.expectedHarvestDate, stockCount: batch.stockCount, shareUnitType: batch.shareUnitType,
      shareUnit: batch.shareUnit, shareQuantity: batch.shareQuantity, expectedHarvestWeightG: batch.expectedHarvestWeightG,
      totalShares: batch.totalShares, sharesAvailable: batch.sharesAvailable, packagePricePerShare: batch.packagePricePerShare,
      contingencyPct: batch.contingencyPct, riskDisclosure: batch.riskDisclosure, termsVersion: batch.termsVersion,
      farmVerified: batch.farmVerified, inspectedAt: batch.inspectedAt, inspector: batch.inspector,
      images: batch.images, costs: batch.costBreakdown, updates: batch.updates.map((update) => this.updateView(update)),
      createdAt: batch.createdAt, updatedAt: batch.updatedAt,
    };
  }

  private updateView(update: BatchRecord['updates'][number]) {
    return { id: update.id, stage: update.stage, averageWeightG: update.averageWeightG, countAlive: update.countAlive, note: update.note, photos: update.photos.map((photo) => ({ id: photo.id, url: photo.url })), createdBy: update.createdBy.name, createdAt: update.createdAt };
  }
}
