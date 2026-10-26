import type { AuthenticatedUser } from '../auth/types.js';
import type { Prisma } from '../generated/prisma/client.js';

export type ActivityActor = Pick<AuthenticatedUser, 'id' | 'name' | 'role'> | null;

export async function logActivity(
  tx: Prisma.TransactionClient,
  actor: ActivityActor,
  action: string,
  target: string,
  link: string,
): Promise<void> {
  await tx.activity.create({
    data: {
      actorId: actor?.id,
      actorLabel: actor?.name ?? 'System',
      role: actor?.role ?? 'System',
      action,
      target,
      link,
    },
  });
}
