import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types.js';
import { logActivity } from '../common/activity.js';
import { AppException } from '../common/exceptions/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminUsersQueryDto, UpdateUserStatusDto } from './dto/admin-users.dto.js';

const SELECT = {
  id: true, email: true, name: true, role: true, status: true, joinedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminUsersQueryDto) {
    const { q, status, role, page, limit } = query;
    const where: Prisma.UserWhereInput = {
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(q ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where, select: SELECT, orderBy: [{ joinedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.user.count({ where }),
    ], { isolationLevel: 'RepeatableRead' });
    return { items, total, page, limit };
  }

  async updateStatus(actor: AuthenticatedUser, email: string, dto: UpdateUserStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const address = email.trim().toLowerCase();
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "email" = ${address} FOR UPDATE
      `;
      const user = await tx.user.findUnique({ where: { email: address }, select: SELECT });
      if (!user) throw new AppException('user.notFound', HttpStatus.NOT_FOUND);
      if (user.role === 'Admin') throw new AppException('user.protectedAccount', HttpStatus.CONFLICT);
      if (user.status !== dto.expectedStatus || dto.status === dto.expectedStatus) {
        throw new AppException('user.statusConflict', HttpStatus.CONFLICT);
      }
      const updated = await tx.user.update({ where: { id: user.id }, data: { status: dto.status }, select: SELECT });
      if (dto.status === 'suspended') {
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() },
        });
      }
      await logActivity(tx, actor, dto.status === 'suspended' ? 'Suspended user' : 'Reactivated user', user.email, '#admin/users');
      return updated;
    });
  }
}
