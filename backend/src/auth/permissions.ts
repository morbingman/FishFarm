/**
 * Server-side permission matrix (REQUIREMENTS.md §2, revised v2.0).
 *
 * Two roles only. `User` is the customer: browse, order, sponsor, review.
 * `Admin` is company staff operating the single company that owns all
 * inventory and batches, plus platform administration.
 */
export const PERMISSIONS = [
  'market.view',
  'order.create',
  'order.view',
  'order.fulfill',
  'listing.create',
  'listing.update',
  'listing.delete',
  'listing.publish',
  'listing.submit',
  'listing.pause',
  'queue.view',
  'listing.approve',
  'listing.reject',
  'listing.takedown',
  'review.create',
  'dispute.create',
  'dispute.manage',
  'user.view',
  'user.manage',
  'activity.view',
  'profile.update',
  'batch.browse',
  'batch.sponsor',
  'batch.create',
  'batch.update',
  'batch.review',
  'batch.settle',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'User' | 'Admin';

const USER: readonly Permission[] = [
  'market.view',
  'order.create',
  'order.view',
  'profile.update',
  'review.create',
  'dispute.create',
  'batch.browse',
  'batch.sponsor',
];

const ADMIN: readonly Permission[] = [
  'market.view',
  'order.fulfill',
  'listing.create',
  'listing.update',
  'listing.delete',
  'listing.publish',
  'listing.submit',
  'listing.pause',
  'queue.view',
  'listing.approve',
  'listing.reject',
  'listing.takedown',
  'dispute.manage',
  'user.view',
  'user.manage',
  'activity.view',
  'profile.update',
  'batch.browse',
  'batch.create',
  'batch.update',
  'batch.review',
  'batch.settle',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  User: new Set(USER),
  Admin: new Set(ADMIN),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
