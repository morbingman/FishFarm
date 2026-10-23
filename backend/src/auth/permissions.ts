/**
 * Server-side counterpart of the frontend's `MATRIX` (REQUIREMENTS.md §2).
 * The API is the enforcement point; these keys are the contract.
 */
export const PERMISSIONS = [
  'market.view',
  'order.create',
  'order.view',
  'order.fulfill',
  'listing.create',
  'listing.update',
  'listing.delete',
  'listing.submit',
  'listing.pause',
  'queue.view',
  'listing.approve',
  'listing.reject',
  'listing.takedown',
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

export type Role = 'Buyer' | 'Seller' | 'Admin';

const BUYER: readonly Permission[] = [
  'market.view',
  'order.create',
  'order.view',
  'profile.update',
  'batch.browse',
  'batch.sponsor',
];

const SELLER: readonly Permission[] = [
  'market.view',
  'listing.create',
  'listing.update',
  'listing.delete',
  'listing.submit',
  'listing.pause',
  'order.fulfill',
  'profile.update',
  'batch.browse',
  'batch.create',
  'batch.update',
];

const ADMIN: readonly Permission[] = [
  'market.view',
  'listing.create',
  'listing.update',
  'listing.delete',
  'listing.submit',
  'listing.pause',
  'order.fulfill',
  'queue.view',
  'listing.approve',
  'listing.reject',
  'listing.takedown',
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
  Buyer: new Set(BUYER),
  Seller: new Set(SELLER),
  Admin: new Set(ADMIN),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
