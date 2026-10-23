import {
  hasPermission,
  PERMISSIONS,
  permissionsFor,
  ROLE_PERMISSIONS,
} from './permissions.js';

describe('permission matrix (REQUIREMENTS.md §2)', () => {
  it('grants buyers ordering but not self-managed listings', () => {
    expect(hasPermission('Buyer', 'order.create')).toBe(true);
    expect(hasPermission('Buyer', 'order.view')).toBe(true);
    expect(hasPermission('Buyer', 'listing.create')).toBe(false);
    expect(hasPermission('Buyer', 'listing.approve')).toBe(false);
    expect(hasPermission('Buyer', 'user.manage')).toBe(false);
  });

  it('keeps ordering buyer-only', () => {
    expect(hasPermission('Seller', 'order.create')).toBe(false);
    expect(hasPermission('Admin', 'order.create')).toBe(false);
    expect(hasPermission('Seller', 'order.fulfill')).toBe(true);
  });

  it('gives sellers their listing lifecycle but no moderation powers', () => {
    for (const permission of [
      'listing.create',
      'listing.update',
      'listing.delete',
      'listing.submit',
      'listing.pause',
    ] as const) {
      expect(hasPermission('Seller', permission)).toBe(true);
    }
    expect(hasPermission('Seller', 'queue.view')).toBe(false);
    expect(hasPermission('Seller', 'listing.approve')).toBe(false);
    expect(hasPermission('Seller', 'listing.reject')).toBe(false);
    expect(hasPermission('Seller', 'listing.takedown')).toBe(false);
    expect(hasPermission('Seller', 'user.manage')).toBe(false);
  });

  it('gives admins moderation, user management, and listing management', () => {
    for (const permission of [
      'queue.view',
      'listing.approve',
      'listing.reject',
      'listing.takedown',
      'user.view',
      'user.manage',
      'activity.view',
      'profile.update',
      'listing.create',
      'listing.update',
      'listing.delete',
      'listing.submit',
      'listing.pause',
      'order.fulfill',
    ] as const) {
      expect(hasPermission('Admin', permission)).toBe(true);
    }
    expect(hasPermission('Admin', 'order.create')).toBe(false);
    expect(hasPermission('Admin', 'batch.sponsor')).toBe(false);
  });

  it('scopes batch actions by role', () => {
    expect(hasPermission('Buyer', 'batch.browse')).toBe(true);
    expect(hasPermission('Buyer', 'batch.sponsor')).toBe(true);
    expect(hasPermission('Buyer', 'batch.create')).toBe(false);

    expect(hasPermission('Seller', 'batch.create')).toBe(true);
    expect(hasPermission('Seller', 'batch.update')).toBe(true);
    expect(hasPermission('Seller', 'batch.sponsor')).toBe(false);
    expect(hasPermission('Seller', 'batch.review')).toBe(false);

    expect(hasPermission('Admin', 'batch.review')).toBe(true);
    expect(hasPermission('Admin', 'batch.settle')).toBe(true);
    expect(hasPermission('Admin', 'batch.create')).toBe(true);
    expect(hasPermission('Admin', 'batch.update')).toBe(true);
  });

  it('lets every role browse the market and edit their profile', () => {
    for (const role of ['Buyer', 'Seller', 'Admin'] as const) {
      expect(hasPermission(role, 'market.view')).toBe(true);
      expect(hasPermission(role, 'profile.update')).toBe(true);
    }
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
    const permissions = permissionsFor('Buyer');
    permissions.push('listing.approve');
    expect(hasPermission('Buyer', 'listing.approve')).toBe(false);
  });

  it('denies unknown roles (default-deny)', () => {
    expect(hasPermission('Unknown' as never, 'market.view')).toBe(false);
    expect(permissionsFor('Unknown' as never)).toEqual([]);
  });
});
