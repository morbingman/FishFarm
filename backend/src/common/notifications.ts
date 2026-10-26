import type { NotificationType, UserRole } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { normalizePrefs } from '../users/users.service.js';

export type NotificationInput = {
  userId?: string;
  role?: UserRole;
  type: NotificationType;
  titleKey: string;
  titleParams?: Record<string, string | number | boolean>;
  bodyKey: string;
  bodyParams?: Record<string, string | number | boolean>;
  link?: string;
};

export async function notify(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void> {
  const recipients = await tx.user.findMany({
    where: input.userId ? { id: input.userId } : input.role ? { role: input.role, status: 'active' } : { id: { in: [] } },
    select: { id: true, prefs: true },
  });
  const enabled = recipients.filter((user) => {
    const prefs = normalizePrefs(user.prefs);
    return !((input.type === 'system' && !prefs.system) ||
      (input.type === 'reminder' && !prefs.reminders) ||
      (input.type === 'status' && !prefs.status));
  });
  if (!enabled.length) return;
  // Keep recipients alive until the notification foreign keys are written.
  const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "User"
    WHERE "id" IN (${Prisma.join(enabled.map((user) => user.id))})
    ORDER BY "id" FOR KEY SHARE
  `);
  const ids = new Set(existing.map((user) => user.id));
  const retained = enabled.filter((user) => ids.has(user.id));
  if (!retained.length) return;
  await tx.notification.createMany({
    data: retained.map((user) => ({
      recipientId: user.id,
      type: input.type,
      titleKey: input.titleKey,
      titleParams: input.titleParams as Prisma.InputJsonValue | undefined,
      bodyKey: input.bodyKey,
      bodyParams: input.bodyParams as Prisma.InputJsonValue | undefined,
      link: input.link,
    })),
  });
}
