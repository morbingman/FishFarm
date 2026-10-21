import { hasPermission, PERMISSIONS, permissionsFor, ROLE_PERMISSIONS } from './permissions.js';

describe('permission matrix (REQUIREMENTS.md §2)', () => {
  it('lets users order, sponsor and review but not manage company inventory', () => {
    for (const permission of [
      'market.view',
      'order.create',
      'order.view',
      'batch.browse',
      'batch.sponsor',
      'review.create',
      'dispute.create',
      'profile.update',
    ] as const) {
      expect(hasPermission('User', permission)).toBe(true);
    }
    for (const permission of [
      'listing.create',
      'listing.update',
      'listing.publish',
      'listing.approve',
      'batch.create',
      'batch.settle',
      'user.manage',
      'activity.view',
      'order.fulfill',
    ] as const) {
      expect(hasPermission('User', permission)).toBe(false);
    }
  });

  it('gives admins the company commercial side and platform management', () => {
    for (const permission of [
      'market.view',
      'order.fulfill',
      'listing.create',
      'listing.update',
      'listing.delete',
      'listing.publish',
      'queue.view',
      'listing.approve',
      'listing.reject',
      'listing.takedown',
      'batch.create',
      'batch.update',
      'batch.review',
      'batch.settle',
      'user.view',
      'user.manage',
      'activity.view',
      'dispute.manage',
      'profile.update',
    ] as const) {
      expect(hasPermission('Admin', permission)).toBe(true);
    }
  });

  it('keeps ordering and sponsorship user-only', () => {
    expect(hasPermission('Admin', 'order.create')).toBe(false);
    expect(hasPermission('Admin', 'order.view')).toBe(false);
    expect(hasPermission('Admin', 'batch.sponsor')).toBe(false);
    expect(hasPermission('Admin', 'review.create')).toBe(false);
    expect(hasPermission('Admin', 'dispute.create')).toBe(false);
  });

  it('only exposes the two roles', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(['Admin', 'User']);
    expect(hasPermission('Seller' as never, 'listing.create')).toBe(false);
    expect(hasPermission('Buyer' as never, 'order.create')).toBe(false);
  });

  it('only contains known permission keys', () => {
    const known = new Set<string>(PERMISSIONS);
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(known.has(permission)).toBe(true);
      }
    }
  });

  it('returns a copy from permissionsFor', () => {
    const permissions = permissionsFor('User');
    permissions.push('listing.approve');
    expect(hasPermission('User', 'listing.approve')).toBe(false);
  });

  it('denies unknown roles (default-deny)', () => {
    expect(hasPermission('Unknown' as never, 'market.view')).toBe(false);
    expect(permissionsFor('Unknown' as never)).toEqual([]);
  });
});
