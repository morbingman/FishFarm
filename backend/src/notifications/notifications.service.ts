import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app.exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NotificationsQueryDto } from './notifications.validation.js';

const notificationSelect = {
  id: true,
  type: true,
  titleKey: true,
  titleParams: true,
  bodyKey: true,
  bodyParams: true,
  link: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(recipientId: string, query: NotificationsQueryDto) {
    const { read, type, page, limit } = query;
    const where: Prisma.NotificationWhereInput = {
      recipientId,
      ...(type === undefined ? {} : { type }),
      ...(read === 'unread'
        ? { readAt: null }
        : read === 'read'
          ? { readAt: { not: null } }
          : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const items = await tx.notification.findMany({
          where,
          select: notificationSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        });
        const total = await tx.notification.count({ where });
        const unreadTotal = await tx.notification.count({
          where: { recipientId, readAt: null },
        });
        return { items, total, unreadTotal, page, limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async markRead(recipientId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // PostgreSQL rechecks this predicate after a competing UPDATE commits.
        // Only the first reader writes; later readers retain that timestamp.
        await tx.notification.updateMany({
          where: { id, recipientId, readAt: null },
          data: { readAt: new Date() },
        });
        const item = await tx.notification.findFirst({
          where: { id, recipientId },
          select: notificationSelect,
        });
        if (!item)
          throw new AppException('notification.notFound', HttpStatus.NOT_FOUND);
        return item;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async readAll(recipientId: string) {
    const readAt = new Date();
    // One UPDATE owns the snapshot. Arrivals after it can remain unread.
    const { count: updated } = await this.prisma.notification.updateMany({
      where: { recipientId, readAt: null },
      data: { readAt },
    });
    return { updated, readAt: readAt.toISOString() };
  }
}
