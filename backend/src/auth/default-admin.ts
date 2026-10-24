import * as argon2 from 'argon2';
import type { PrismaClient } from '../generated/prisma/client.js';

// Server-only bootstrap credentials. Never import this module from the frontend.
export const DEFAULT_ADMIN_EMAIL = 'admin@fish.com';
export const DEFAULT_ADMIN_PASSWORD = '12345';

export async function ensureDefaultAdmin(
  prisma: PrismaClient,
  options: { email?: string; password?: string; resetPassword?: boolean } = {},
): Promise<void> {
  const email = (options.email ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = options.password ?? DEFAULT_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error('Default admin email/password must not be empty.');
  const existing = await prisma.user.findUnique({ where: { email } });
  // A restart must preserve a password the administrator has already changed.
  const passwordHash =
    !existing || options.resetPassword
      ? await argon2.hash(password)
      : undefined;
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: passwordHash ?? existing!.passwordHash,
      name: 'FishFarm Admin',
      role: 'Admin',
      status: 'active',
      emailVerifiedAt: new Date(),
    },
    update: {
      role: 'Admin',
      ...(options.resetPassword ? { passwordHash } : {}),
    },
  });
  if (options.resetPassword && existing) {
    await prisma.session.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
