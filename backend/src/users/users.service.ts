import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app.exception.js';
import type { UserRole, UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NotificationPrefs, PublicUser } from '../auth/types.js';
import type { UpdatePrefsDto } from './dto/update-prefs.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  location: string | null;
  joinedAt: Date;
  emailVerifiedAt: Date | null;
  prefs: unknown;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      phone: user.phone,
      location: user.location,
      joinedAt: user.joinedAt,
      emailVerifiedAt: user.emailVerifiedAt,
      prefs: normalizePrefs(user.prefs),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException('error.notFound', HttpStatus.NOT_FOUND);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
      },
    });

    return this.toPublicUser(updated);
  }

  async getPrefs(userId: string): Promise<NotificationPrefs> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { prefs: true },
    });
    if (!user) throw new AppException('error.notFound', HttpStatus.NOT_FOUND);
    return normalizePrefs(user.prefs);
  }

  async updatePrefs(
    userId: string,
    dto: UpdatePrefsDto,
  ): Promise<NotificationPrefs> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize partial merges with other writers before reading the current prefs.
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
      `;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { prefs: true },
      });
      if (!user) throw new AppException('error.notFound', HttpStatus.NOT_FOUND);

      const current = normalizePrefs(user.prefs);
      const prefs: NotificationPrefs = {
        status: dto.status ?? current.status,
        system: dto.system ?? current.system,
        reminders: dto.reminders ?? current.reminders,
      };

      await tx.user.update({
        where: { id: userId },
        data: { prefs },
      });

      return prefs;
    });
  }
}

export function normalizePrefs(value: unknown): NotificationPrefs {
  const prefs = (
    typeof value === 'object' && value !== null ? value : {}
  ) as Record<string, unknown>;
  return {
    status: prefs.status !== false,
    system: prefs.system !== false,
    reminders: prefs.reminders !== false,
  };
}
