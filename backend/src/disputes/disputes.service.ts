import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types.js';
import { logActivity } from '../common/activity.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { notify } from '../common/notifications.js';
import type { Prisma } from '../generated/prisma/client.js';
import { DisputeStatus, NotificationType, OrderStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivateFilesService, privateUploadsFor } from '../uploads/private-files.service.js';
import type { CreateDisputeDto } from './dto/dispute.dto.js';

const INCLUDE = {
  order: { select: { id: true, code: true, status: true } },
  buyer: { select: { id: true, name: true, email: true } },
  attachments: {
    select: { id: true, uploadId: true, createdAt: true, upload: { select: { mimeType: true, sizeBytes: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.DisputeInclude;

type DisputeRecord = Prisma.DisputeGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privateFiles: PrivateFilesService,
  ) {}

  async create(buyer: AuthenticatedUser, orderReference: string, dto: CreateDisputeDto) {
    const found = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderReference }, { code: orderReference }] },
      select: { id: true, buyerId: true },
    });
    if (!found || found.buyerId !== buyer.id) throw new AppException('order.notFound', HttpStatus.NOT_FOUND);

    const dispute = await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, found.id);
      if (order.buyerId !== buyer.id) throw new AppException('order.notFound', HttpStatus.NOT_FOUND);
      this.assertEligible(order.status, dto.reason);
      if (await tx.dispute.findUnique({ where: { orderId: order.id }, select: { id: true } })) {
        throw new AppException('dispute.alreadyExists', HttpStatus.CONFLICT);
      }
      const uploadIds = dto.uploadIds ?? [];
      for (const uploadId of [...new Set(uploadIds)].sort()) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Upload" WHERE "id" = ${uploadId} FOR UPDATE
        `;
      }
      const uploads = await privateUploadsFor(tx, uploadIds, 'dispute_attachment', buyer.id);
      if (uploadIds.length) {
        const used = await tx.disputeAttachment.count({ where: { uploadId: { in: uploadIds } } });
        if (used) throw new AppException('uploads.alreadyUsed', HttpStatus.CONFLICT);
      }
      const created = await tx.dispute.create({
        data: {
          orderId: order.id,
          buyerId: buyer.id,
          reason: dto.reason,
          description: dto.description,
          attachments: { create: uploads.map((upload) => ({ uploadId: upload.id, url: upload.url })) },
        },
        include: INCLUDE,
      });
      await notify(tx, {
        role: 'Admin', type: NotificationType.status,
        titleKey: 'notifications.admin.disputeOpened.title', titleParams: { code: order.code },
        bodyKey: 'notifications.admin.disputeOpened.body', bodyParams: { name: buyer.name },
        link: `#admin/disputes/${created.id}`,
      });
      await logActivity(tx, buyer, 'Opened dispute', order.code, `#admin/disputes/${created.id}`);
      return created;
    });
    return this.view(dispute);
  }

  async mine(userId: string) {
    return (await this.prisma.dispute.findMany({
      where: { buyerId: userId }, include: INCLUDE, orderBy: { createdAt: 'desc' },
    })).map((dispute) => this.view(dispute));
  }

  async mineOne(userId: string, id: string) {
    const dispute = await this.prisma.dispute.findFirst({ where: { id, buyerId: userId }, include: INCLUDE });
    if (!dispute) throw new AppException('dispute.notFound', HttpStatus.NOT_FOUND);
    return this.view(dispute);
  }

  async list(status?: DisputeStatus) {
    return (await this.prisma.dispute.findMany({
      where: status ? { status } : {}, include: INCLUDE, orderBy: { createdAt: 'desc' },
    })).map((dispute) => this.view(dispute));
  }

  async one(id: string) {
    const dispute = await this.find(id);
    return this.view(dispute);
  }

  async startReview(admin: AuthenticatedUser, id: string) {
    return this.transition(admin, id, DisputeStatus.open, DisputeStatus.reviewing);
  }

  async resolve(admin: AuthenticatedUser, id: string, resolution: string) {
    return this.finish(admin, id, DisputeStatus.resolved, resolution);
  }

  async reject(admin: AuthenticatedUser, id: string, resolution: string) {
    return this.finish(admin, id, DisputeStatus.rejected, resolution);
  }

  async attachment(actor: AuthenticatedUser, disputeId: string, attachmentId: string) {
    const attachment = await this.prisma.disputeAttachment.findFirst({
      where: { id: attachmentId, disputeId },
      select: { dispute: { select: { buyerId: true } }, upload: { select: { url: true, mimeType: true } } },
    });
    if (!attachment || (actor.role !== 'Admin' && attachment.dispute.buyerId !== actor.id)) {
      throw new AppException('dispute.attachmentNotFound', HttpStatus.NOT_FOUND);
    }
    return this.privateFiles.stream(attachment.upload);
  }

  private async transition(
    admin: AuthenticatedUser,
    id: string,
    from: DisputeStatus,
    to: DisputeStatus,
  ) {
    const dispute = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockDispute(tx, id);
      if (current.status !== from) throw this.invalidTransition(current.status, to);
      await tx.dispute.update({ where: { id }, data: { status: to } });
      await notify(tx, {
        userId: current.buyerId, type: NotificationType.status,
        titleKey: 'notifications.buyer.disputeReviewing.title', titleParams: { code: current.order.code },
        bodyKey: 'notifications.buyer.disputeReviewing.body', link: `#marketplace/disputes/${id}`,
      });
      await logActivity(tx, admin, 'Started dispute review', current.order.code, `#admin/disputes/${id}`);
      return this.findTx(tx, id);
    });
    return this.view(dispute);
  }

  private async finish(
    admin: AuthenticatedUser,
    id: string,
    status: typeof DisputeStatus.resolved | typeof DisputeStatus.rejected,
    resolution: string,
  ) {
    const dispute = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockDispute(tx, id);
      const finalizable: DisputeStatus[] = [DisputeStatus.open, DisputeStatus.reviewing];
      if (!finalizable.includes(current.status)) {
        throw this.invalidTransition(current.status, status);
      }
      await tx.dispute.update({
        where: { id }, data: { status, resolution, resolvedAt: new Date() },
      });
      await notify(tx, {
        userId: current.buyerId, type: NotificationType.status,
        titleKey: `notifications.buyer.dispute${status === DisputeStatus.resolved ? 'Resolved' : 'Rejected'}.title`,
        titleParams: { code: current.order.code },
        bodyKey: `notifications.buyer.dispute${status === DisputeStatus.resolved ? 'Resolved' : 'Rejected'}.body`,
        link: `#marketplace/disputes/${id}`,
      });
      await logActivity(tx, admin, `${status === DisputeStatus.resolved ? 'Resolved' : 'Rejected'} dispute`, current.order.code, `#admin/disputes/${id}`);
      return this.findTx(tx, id);
    });
    return this.view(dispute);
  }

  private assertEligible(status: OrderStatus, reason: string) {
    const eligible: OrderStatus[] = reason === 'not_received'
      ? [OrderStatus.shipped, OrderStatus.delivered, OrderStatus.completed]
      : [OrderStatus.delivered, OrderStatus.completed];
    if (!eligible.includes(status)) throw new AppException('dispute.orderNotEligible', HttpStatus.CONFLICT);
  }

  private async lockOrder(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows[0]) throw new AppException('order.notFound', HttpStatus.NOT_FOUND);
    return tx.order.findUniqueOrThrow({ where: { id }, select: { id: true, code: true, buyerId: true, status: true } });
  }

  private async lockDispute(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Dispute" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows[0]) throw new AppException('dispute.notFound', HttpStatus.NOT_FOUND);
    return this.findTx(tx, id);
  }

  private findTx(tx: Prisma.TransactionClient, id: string) {
    return tx.dispute.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  }

  private async find(id: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: INCLUDE });
    if (!dispute) throw new AppException('dispute.notFound', HttpStatus.NOT_FOUND);
    return dispute;
  }

  private invalidTransition(from: DisputeStatus, to: DisputeStatus) {
    return new AppException('dispute.invalidTransition', HttpStatus.CONFLICT, { from, to });
  }

  private view(dispute: DisputeRecord) {
    return {
      id: dispute.id,
      order: { id: dispute.order.code, status: dispute.order.status },
      buyer: dispute.buyer,
      reason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      resolution: dispute.resolution,
      attachments: dispute.attachments.map((attachment) => ({
        id: attachment.id,
        mimeType: attachment.upload?.mimeType ?? null,
        sizeBytes: attachment.upload?.sizeBytes ?? null,
        createdAt: attachment.createdAt,
      })),
      createdAt: dispute.createdAt,
      resolvedAt: dispute.resolvedAt,
    };
  }
}
