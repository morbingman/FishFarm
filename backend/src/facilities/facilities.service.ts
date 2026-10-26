import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types.js';
import { logActivity } from '../common/activity.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { CompanyService } from '../company/company.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivateFilesService, privateUploadsFor } from '../uploads/private-files.service.js';
import type { CreateFacilityDto, InspectFacilityDto, SaveVerificationDto } from './dto/facility.dto.js';

const INCLUDE = {
  verification: { include: { documents: { include: { upload: { select: { id: true, mimeType: true, sizeBytes: true } } } } } },
  _count: { select: { batches: true } },
} satisfies Prisma.FacilityInclude;

type FacilityRecord = Prisma.FacilityGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanyService,
    private readonly privateFiles: PrivateFilesService,
  ) {}

  async list() {
    return (await this.prisma.facility.findMany({ include: INCLUDE, orderBy: { createdAt: 'desc' } })).map((facility) => this.view(facility));
  }

  async one(id: string) { return this.view(await this.find(id)); }

  async create(admin: AuthenticatedUser, dto: CreateFacilityDto) {
    const company = await this.company.current();
    const facility = await this.prisma.$transaction(async (tx) => {
      const created = await tx.facility.create({ data: { companyId: company.id, name: dto.name, location: dto.location, region: dto.region }, include: INCLUDE });
      await logActivity(tx, admin, 'Created facility', created.name, `#company/facilities/${created.id}`);
      return created;
    });
    return this.view(facility);
  }

  async saveVerification(admin: AuthenticatedUser, id: string, dto: SaveVerificationDto) {
    const facility = await this.find(id);
    const verification = await this.prisma.$transaction(async (tx) => {
      await this.lockFacility(tx, facility.id);
      for (const uploadId of [...new Set(dto.documents.map((document) => document.uploadId))].sort()) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Upload" WHERE "id" = ${uploadId} FOR UPDATE
        `;
      }

      const uploads = await privateUploadsFor(
        tx,
        dto.documents.map((document) => document.uploadId),
        'farm_document',
      );
      const used = await tx.verificationDocument.count({
        where: {
          uploadId: { in: uploads.map((upload) => upload.id) },
          verification: { facilityId: { not: facility.id } },
        },
      });
      if (used) throw new AppException('uploads.alreadyUsed', HttpStatus.CONFLICT);

      const byId = new Map(uploads.map((upload) => [upload.id, upload]));
      const existing = await tx.farmVerification.findUnique({
        where: { facilityId: facility.id },
        select: { id: true },
      });
      const scalarData = {
        level: dto.level,
        status: 'pending' as const,
        inspectedAt: dto.inspectedAt ? new Date(dto.inspectedAt) : null,
        inspector: dto.inspector,
        notes: dto.notes,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
      };
      const verificationId = existing
        ? (
            await tx.farmVerification.update({
              where: { id: existing.id },
              data: scalarData,
              select: { id: true },
            })
          ).id
        : (
            await tx.farmVerification.create({
              data: { facilityId: facility.id, ...scalarData },
              select: { id: true },
            })
          ).id;

      await tx.verificationDocument.deleteMany({ where: { verificationId } });
      await tx.verificationDocument.createMany({
        data: dto.documents.map((document) => ({
          verificationId,
          type: document.type,
          uploadId: document.uploadId,
          url: byId.get(document.uploadId)!.url,
        })),
      });
      const saved = await tx.farmVerification.findUniqueOrThrow({
        where: { id: verificationId },
        include: {
          documents: {
            include: {
              upload: { select: { id: true, mimeType: true, sizeBytes: true } },
            },
          },
        },
      });
      await logActivity(
        tx,
        admin,
        'Submitted facility compliance',
        facility.name,
        `#admin/facilities/${facility.id}`,
      );
      return saved;
    });
    return this.verificationView(verification);
  }

  async inspect(admin: AuthenticatedUser, id: string, dto: InspectFacilityDto) {
    const facility = await this.find(id);
    if (!facility.verification) throw new AppException('facility.verificationNotFound', HttpStatus.NOT_FOUND);
    if (dto.status === 'pending') throw new AppException('facility.invalidDecision', HttpStatus.BAD_REQUEST);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockFacility(tx, facility.id);
      const current = await tx.farmVerification.findUnique({
        where: { facilityId: facility.id },
        include: {
          documents: {
            include: {
              upload: { select: { id: true, mimeType: true, sizeBytes: true } },
            },
          },
        },
      });
      if (!current) throw new AppException('facility.verificationNotFound', HttpStatus.NOT_FOUND);
      if (
        dto.status === 'approved' &&
        (!dto.validUntil || new Date(dto.validUntil).getTime() <= Date.now() ||
          (dto.level ?? current.level) === 'none' || !current.documents.length ||
          current.documents.some((document) => !document.uploadId))
      ) {
        throw new AppException('facility.approvalIncomplete', HttpStatus.BAD_REQUEST);
      }
      const verification = await tx.farmVerification.update({
        where: { id: current.id },
        data: {
          status: dto.status,
          level: dto.level,
          inspectedAt: dto.inspectedAt ? new Date(dto.inspectedAt) : undefined,
          inspector: dto.inspector,
          notes: dto.notes,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          reviewedAt: new Date(),
          reviewedBy: admin.name,
        },
        include: {
          documents: {
            include: {
              upload: { select: { id: true, mimeType: true, sizeBytes: true } },
            },
          },
        },
      });
      await logActivity(
        tx,
        admin,
        `${dto.status === 'approved' ? 'Approved' : dto.status === 'revoked' ? 'Revoked' : 'Rejected'} facility compliance`,
        facility.name,
        `#admin/facilities/${facility.id}`,
      );
      return verification;
    });
    return this.verificationView(updated);
  }

  async verification(id: string) {
    const facility = await this.find(id);
    if (!facility.verification) throw new AppException('facility.verificationNotFound', HttpStatus.NOT_FOUND);
    return this.verificationView(facility.verification);
  }

  async document(facilityId: string, documentId: string) {
    const document = await this.prisma.verificationDocument.findFirst({
      where: { id: documentId, verification: { facilityId } },
      select: { upload: { select: { url: true, mimeType: true } } },
    });
    if (!document) throw new AppException('facility.documentNotFound', HttpStatus.NOT_FOUND);
    return this.privateFiles.stream(document.upload);
  }

  private async lockFacility(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Facility" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!rows[0]) throw new AppException('facility.notFound', HttpStatus.NOT_FOUND);
  }

  private async find(id: string): Promise<FacilityRecord> {
    const facility = await this.prisma.facility.findUnique({ where: { id }, include: INCLUDE });
    if (!facility) throw new AppException('facility.notFound', HttpStatus.NOT_FOUND);
    return facility;
  }

  private view(facility: FacilityRecord) {
    return {
      id: facility.id, name: facility.name, location: facility.location, region: facility.region,
      verification: facility.verification ? this.verificationView(facility.verification) : null,
      batchCount: facility._count.batches, createdAt: facility.createdAt, updatedAt: facility.updatedAt,
    };
  }

  private verificationView(verification: NonNullable<FacilityRecord['verification']>) {
    return {
      id: verification.id, level: verification.level, status: verification.status,
      inspectedAt: verification.inspectedAt, inspector: verification.inspector, notes: verification.notes,
      validUntil: verification.validUntil, submittedAt: verification.submittedAt,
      reviewedAt: verification.reviewedAt, reviewedBy: verification.reviewedBy,
      documents: verification.documents.map((document) => ({
        id: document.id, type: document.type, controlled: Boolean(document.uploadId),
        mimeType: document.upload?.mimeType ?? null, sizeBytes: document.upload?.sizeBytes ?? null,
        uploadedAt: document.uploadedAt,
      })),
    };
  }
}
