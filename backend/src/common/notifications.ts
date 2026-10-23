import type { NotificationType, UserRole } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationType as NotificationTypeEnum } from '../generated/prisma/enums.js';
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

/**
 * Writes one notification row. A User-targeted notification respects the
 * recipient's `prefs`; role broadcasts (for example to every Admin) are always
 * written so each Admin keeps their own read state.
 */
export async function notify(
  tx: Prisma.TransactionClient,
  input: NotificationInput,
): Promise<void> {
  if (input.userId) {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { prefs: true },
    });
    const prefs = normalizePrefs(user?.prefs);
    if (
      (input.type === NotificationTypeEnum.system && !prefs.system) ||
      (input.type === NotificationTypeEnum.reminder && !prefs.reminders) ||
      (input.type === NotificationTypeEnum.status && !prefs.status)
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
