import request, { type Response } from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UsersService } from '../src/users/users.service.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';
const REFRESH_COOKIE = 'fishfarm_refresh';
const DIRECTORY_KEYS = ['email', 'id', 'joinedAt', 'name', 'role', 'status'];
type Status = 'active' | 'suspended';
type Fixture = { id: string; email: string; token: string; cookie: string };
type DirectoryItem = {
  id: string;
  email: string;
  name: string;
  role: 'User' | 'Admin';
  status: Status;
  joinedAt: string;
};
type Directory = {
  items: DirectoryItem[];
  total: number;
  page: number;
  limit: number;
};

function refreshCookie(response: Response): string {
  const header = response.headers['set-cookie'] as
    string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies.find((value) =>
    value.startsWith(`${REFRESH_COOKIE}=`),
  );
  if (!cookie) throw new Error('refresh cookie was not set');
  return cookie.split(';', 1)[0];
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Admin users (e2e)', () => {
  const run = `admin-users-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const directoryQuery = `${run}-directory`;
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let admin: Fixture;
  let customer: Fixture;
  let guardTarget: Fixture;
  let activeAdmin: Fixture;
  let suspendedAdmin: Fixture;
  let directoryUsers: Fixture[];
  const userIds: string[] = [];
  const companyIds: string[] = [];
  const listingIds: string[] = [];
  const orderIds: string[] = [];

  beforeAll(async () => {
    // createTestApp and vitest.config.e2e.ts use the isolated *_test database.
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await register('actor');
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'Admin' },
    });
    admin = { ...admin, ...(await login(admin)) };
    customer = await register('caller');
    guardTarget = await register('guard-target');
    const activeOne = await register(
      'directory-active-one',
      `${run} NameOnlyMarker`,
    );
    const activeTwo = await register('directory-active-two');
    const suspended = await register('directory-suspended');
    activeAdmin = await register('directory-admin');
    suspendedAdmin = await register('directory-suspended-admin');
    await prisma.user.updateMany({
      where: { id: { in: [activeAdmin.id, suspendedAdmin.id] } },
      data: { role: 'Admin' },
    });
    // These are owned fixtures only; provision an already suspended Admin to
    // exercise protection in the reverse direction without an unprotect API.
    await prisma.user.update({
      where: { id: suspendedAdmin.id },
      data: { status: 'suspended' },
    });
    await patchStatus(suspended.email, {
      status: 'suspended',
      expectedStatus: 'active',
    }).expect(200);
    directoryUsers = [
      activeOne,
      activeTwo,
      suspended,
      activeAdmin,
      suspendedAdmin,
    ];
    await prisma.user.update({
      where: { id: activeOne.id },
      data: {
        phone: '0900123456',
        location: 'Private profile location',
        prefs: { status: false, system: true, reminders: false },
        emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (!prisma) {
      if (app) await app.close();
      return;
    }
    try {
      // Every predicate is scoped to records created by this suite. Do not
      // clear broadcast notifications, shared company data, or other audits.
      await prisma.dispute.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.conversation.deleteMany({
        where: { buyerId: { in: userIds } },
      });
      await prisma.favorite.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.cartItem.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.upload.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
      await prisma.notification.deleteMany({
        where: { recipientId: { in: userIds } },
      });
      await prisma.activity.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.verificationCode.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app.close();
    }
  }, 30_000);

  async function register(
    label: string,
    name = `${run}-${label}`,
  ): Promise<Fixture> {
    const email = `${run}-${label}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: PASSWORD, name })
      .expect(201);
    const id = response.body.user.id as string;
    userIds.push(id);
    return {
      id,
      email,
      token: response.body.accessToken as string,
      cookie: refreshCookie(response),
    };
  }

  async function login(user: Pick<Fixture, 'email'>) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return {
      token: response.body.accessToken as string,
      cookie: refreshCookie(response),
    };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function patchStatus(email: string, body: unknown, token = admin.token) {
    return request(app.getHttpServer())
      .patch(`/v1/admin/users/${encodeURIComponent(email)}/status`)
      .set(auth(token))
      .send(body as object);
  }

  async function list(
    query: Record<string, string | number> = {},
  ): Promise<Directory> {
    const response = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set(auth(admin.token))
      .query({ q: directoryQuery, ...query })
      .expect(200);
    return response.body as Directory;
  }

  function expectProjection(item: DirectoryItem) {
    expect(Object.keys(item).sort()).toEqual(DIRECTORY_KEYS);
    expect(item).toEqual({
      id: expect.any(String),
      email: expect.any(String),
      name: expect.any(String),
      role: expect.stringMatching(/^(User|Admin)$/),
      status: expect.stringMatching(/^(active|suspended)$/),
      joinedAt: expect.any(String),
    });
    expect(new Date(item.joinedAt).toISOString()).toBe(item.joinedAt);
    expect(item.email).toBe(item.email.toLowerCase());
  }

  async function audits(email: string) {
    return prisma.activity.findMany({
      where: { actorId: admin.id, target: email, link: '#admin/users' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async function sessions(user: Fixture) {
    return prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { id: 'asc' },
    });
  }

  describe('permissions', () => {
    it('requires authentication and user.view for the directory', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .expect(401)
        .expect(({ body }) => expect(body.code).toBe('auth.missingToken'));
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set(auth(customer.token))
        .expect(403)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            code: 'auth.forbidden',
            params: { permission: 'user.view' },
          }),
        );
    });

    it('requires authentication and user.manage before changing any account', async () => {
      const before = await sessions(guardTarget);
      const path = `/v1/admin/users/${encodeURIComponent(guardTarget.email)}/status`;
      const body = { status: 'suspended', expectedStatus: 'active' };
      await request(app.getHttpServer())
        .patch(path)
        .send(body)
        .expect(401)
        .expect(({ body: error }) =>
          expect(error.code).toBe('auth.missingToken'),
        );
      await patchStatus(guardTarget.email, body, customer.token)
        .expect(403)
        .expect(({ body: error }) =>
          expect(error).toMatchObject({
            code: 'auth.forbidden',
            params: { permission: 'user.manage' },
          }),
        );
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: guardTarget.id } }))
          .status,
      ).toBe('active');
      expect(await sessions(guardTarget)).toEqual(before);
      expect(await audits(guardTarget.email)).toEqual([]);
    });
  });

  describe('safe directory projection, search, filters and pagination', () => {
    it('returns exactly the minimal projection, numeric defaults and a filtered total', async () => {
      const result = await list();
      expect(Object.keys(result).sort()).toEqual([
        'items',
        'limit',
        'page',
        'total',
      ]);
      expect(result).toMatchObject({ total: 5, page: 1, limit: 25 });
      expect(result.items.map((item) => item.id).sort()).toEqual(
        directoryUsers.map((user) => user.id).sort(),
      );
      for (const item of result.items) {
        expectProjection(item);
        const row = await prisma.user.findUniqueOrThrow({
          where: { id: item.id },
        });
        expect(item).toEqual({
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          status: row.status,
          joinedAt: row.joinedAt.toISOString(),
        });
      }
    });

    it('searches trimmed, case-insensitive email and name substrings without leaking unrelated accounts', async () => {
      const emailSearch = await list({
        q: `  ${directoryUsers[0].email.toUpperCase()}  `,
      });
      expect(emailSearch.total).toBe(1);
      expect(emailSearch.items[0].id).toBe(directoryUsers[0].id);
      const nameSearch = await list({ q: `  ${run} nAmEoNlYmArKeR  ` });
      expect(nameSearch.total).toBe(1);
      expect(nameSearch.items[0].id).toBe(directoryUsers[0].id);
      const missing = await list({ q: `${run}-no-match` });
      expect(missing).toEqual({ items: [], total: 0, page: 1, limit: 25 });
    });

    it.each([
      [{ status: 'active' }, [0, 1, 3]],
      [{ status: 'suspended' }, [2, 4]],
      [{ role: 'User' }, [0, 1, 2]],
      [{ role: 'Admin' }, [3, 4]],
      [{ status: 'active', role: 'User' }, [0, 1]],
      [{ status: 'suspended', role: 'Admin' }, [4]],
    ] as const)(
      'combines the search with filters %j',
      async (query, indices) => {
        const result = await list(query);
        expect(result.total).toBe(indices.length);
        expect(result.items.map((item) => item.id).sort()).toEqual(
          indices.map((index) => directoryUsers[index].id).sort(),
        );
        result.items.forEach(expectProjection);
      },
    );

    it('pages deterministically with no overlap and reports total independently of page size', async () => {
      const all = await list({ limit: 100 });
      const first = await list({ page: 1, limit: 2 });
      const second = await list({ page: 2, limit: 2 });
      const third = await list({ page: 3, limit: 2 });
      const beyond = await list({ page: 4, limit: 2 });
      expect(first).toMatchObject({ total: 5, page: 1, limit: 2 });
      expect(second).toMatchObject({ total: 5, page: 2, limit: 2 });
      expect(third).toMatchObject({ total: 5, page: 3, limit: 2 });
      expect(beyond).toEqual({ items: [], total: 5, page: 4, limit: 2 });
      const pagedIds = [...first.items, ...second.items, ...third.items].map(
        (item) => item.id,
      );
      expect(pagedIds).toEqual(all.items.map((item) => item.id));
      expect(new Set(pagedIds).size).toBe(5);
      expect((await list({ page: 1, limit: 2 })).items).toEqual(first.items);
      expect(await list({ page: 1_000_000, limit: 100 })).toEqual({
        items: [],
        total: 5,
        page: 1_000_000,
        limit: 100,
      });
      expect((await list({ limit: 1 })).items).toHaveLength(1);
    });

    it('accepts omitted or whitespace-only search and the trimmed 100-character boundary', async () => {
      for (const query of [{}, { q: '' }, { q: '   ' }]) {
        const response = await request(app.getHttpServer())
          .get('/v1/admin/users')
          .set(auth(admin.token))
          .query({ ...query, limit: 100 })
          .expect(200);
        const result = response.body as Directory;
        expect(result.page).toBe(1);
        expect(result.limit).toBe(100);
        expect(result.total).toBeGreaterThanOrEqual(userIds.length);
        result.items.forEach(expectProjection);
      }
      await list({ q: `  ${'x'.repeat(100)}  ` });
      // HTTP scalar query values are text, even when a client supplies a JS number/null.
      await list({ q: 123 });
      await list({ q: 'null' });
    });
  });

  describe('strict query validation', () => {
    it.each([
      ['unknown', 'sort=name'],
      ['legacy reason', 'reason=maintenance'],
      ['long search', `q=${'x'.repeat(101)}`],
      ['repeated search', 'q=one&q=two'],
      ['nested search', 'q[value]=one'],
      ['bad status', 'status=deleted'],
      ['wrong-case status', 'status=Active'],
      ['empty status', 'status='],
      ['null status', 'status=null'],
      ['number status', 'status=1'],
      ['repeated status', 'status=active&status=suspended'],
      ['bad role', 'role=System'],
      ['wrong-case role', 'role=admin'],
      ['empty role', 'role='],
      ['null role', 'role=null'],
      ['number role', 'role=1'],
      ['repeated role', 'role=User&role=Admin'],
      ...[
        '0',
        '-1',
        '1.5',
        '1000001',
        'null',
        'abc',
        '1e2',
        '1x',
        '',
        '%20',
        '%2B1',
        'Infinity',
      ].map((value) => [`page ${value}`, `page=${value}`]),
      ['repeated page', 'page=1&page=2'],
      ['nested page', 'page[value]=1'],
      ...[
        '0',
        '-1',
        '1.5',
        '101',
        'null',
        'abc',
        '1e2',
        '1x',
        '',
        '%20',
        '%2B1',
        'Infinity',
      ].map((value) => [`limit ${value}`, `limit=${value}`]),
      ['repeated limit', 'limit=1&limit=2'],
      ['nested limit', 'limit[value]=1'],
    ])('rejects %s instead of coercing/ignoring it', async (_label, query) => {
      await request(app.getHttpServer())
        .get(`/v1/admin/users?${query}`)
        .set(auth(admin.token))
        .expect(400)
        .expect(({ body }) => expect(body.code).toBe('validation.failed'));
    });
  });

  describe('strict status body validation and conflicts', () => {
    it.each([
      ['missing fields', {}],
      ['missing expectedStatus', { status: 'suspended' }],
      ['missing status', { expectedStatus: 'active' }],
      [
        'unknown field',
        { status: 'suspended', expectedStatus: 'active', extra: true },
      ],
      [
        'unsupported reason',
        { status: 'suspended', expectedStatus: 'active', reason: 'Spam' },
      ],
      [
        'empty reason',
        { status: 'suspended', expectedStatus: 'active', reason: '' },
      ],
      ['bad status', { status: 'deleted', expectedStatus: 'active' }],
      ['wrong-case status', { status: 'Suspended', expectedStatus: 'active' }],
      ['empty status', { status: '', expectedStatus: 'active' }],
      ['null status', { status: null, expectedStatus: 'active' }],
      ['number status', { status: 1, expectedStatus: 'active' }],
      ['boolean status', { status: true, expectedStatus: 'active' }],
      ['array status', { status: ['suspended'], expectedStatus: 'active' }],
      [
        'object status',
        { status: { value: 'suspended' }, expectedStatus: 'active' },
      ],
      [
        'bad expectedStatus',
        { status: 'suspended', expectedStatus: 'deleted' },
      ],
      [
        'wrong-case expectedStatus',
        { status: 'suspended', expectedStatus: 'Active' },
      ],
      ['null expectedStatus', { status: 'suspended', expectedStatus: null }],
      ['number expectedStatus', { status: 'suspended', expectedStatus: 0 }],
      [
        'array expectedStatus',
        { status: 'suspended', expectedStatus: ['active'] },
      ],
    ])(
      'rejects %s without changing status, sessions or audit',
      async (_label, body) => {
        const beforeSessions = await sessions(guardTarget);
        await patchStatus(guardTarget.email, body)
          .expect(400)
          .expect(({ body: error }) =>
            expect(error.code).toBe('validation.failed'),
          );
        expect(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: guardTarget.id },
            })
          ).status,
        ).toBe('active');
        expect(await sessions(guardTarget)).toEqual(beforeSessions);
        expect(await audits(guardTarget.email)).toEqual([]);
      },
    );

    it.each(['active', 'suspended'] as const)(
      'rejects a no-op request for %s without an audit',
      async (status) => {
        const target = status === 'active' ? guardTarget : directoryUsers[2];
        const beforeSessions = await sessions(target);
        const beforeAudits = await audits(target.email);
        await patchStatus(target.email, { status, expectedStatus: status })
          .expect(409)
          .expect(({ body }) => expect(body.code).toBe('user.statusConflict'));
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: target.id } }))
            .status,
        ).toBe(status);
        expect(await sessions(target)).toEqual(beforeSessions);
        expect(await audits(target.email)).toEqual(beforeAudits);
      },
    );

    it.each(['active', 'suspended'] as const)(
      'rejects stale expected state against an %s account with no audit or session change',
      async (status) => {
        const target = status === 'active' ? guardTarget : directoryUsers[2];
        const expectedStatus = status === 'active' ? 'suspended' : 'active';
        const beforeSessions = await sessions(target);
        const beforeAudits = await audits(target.email);
        await patchStatus(target.email, { status, expectedStatus })
          .expect(409)
          .expect(({ body }) => expect(body.code).toBe('user.statusConflict'));
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: target.id } }))
            .status,
        ).toBe(status);
        expect(await sessions(target)).toEqual(beforeSessions);
        expect(await audits(target.email)).toEqual(beforeAudits);
      },
    );

    it.each([
      ['active Admin suspension', 'activeAdmin', 'suspended', 'active'],
      ['active Admin reverse request', 'activeAdmin', 'active', 'suspended'],
      ['suspended Admin reactivation', 'suspendedAdmin', 'active', 'suspended'],
      [
        'suspended Admin forward request',
        'suspendedAdmin',
        'suspended',
        'active',
      ],
      ['self suspension', 'admin', 'suspended', 'active'],
      ['self reverse request', 'admin', 'active', 'suspended'],
    ] as const)(
      'protects %s before considering stale state',
      async (_label, targetName, status, expectedStatus) => {
        const target = { activeAdmin, suspendedAdmin, admin }[targetName];
        const before = await prisma.user.findUniqueOrThrow({
          where: { id: target.id },
        });
        const beforeSessions = await sessions(target);
        const beforeAudits = await audits(target.email);
        await patchStatus(target.email.toUpperCase(), {
          status,
          expectedStatus,
        })
          .expect(409)
          .expect(({ body }) =>
            expect(body.code).toBe('user.protectedAccount'),
          );
        expect(
          await prisma.user.findUniqueOrThrow({ where: { id: target.id } }),
        ).toEqual(before);
        const afterSessions = await sessions(target);
        if (target.id === admin.id) {
          // Authentication legitimately touches the caller's lastActiveAt even
          // on a forbidden mutation; all credential and revocation fields stay intact.
          const credentials = (rows: typeof beforeSessions) =>
            rows.map(({ lastActiveAt: _lastActiveAt, ...session }) => session);
          expect(credentials(afterSessions)).toEqual(
            credentials(beforeSessions),
          );
        } else {
          expect(afterSessions).toEqual(beforeSessions);
        }
        expect(await audits(target.email)).toEqual(beforeAudits);
      },
    );

    it.each([
      ['suspended', 'active'],
      ['active', 'suspended'],
    ] as const)(
      'returns user.notFound for a missing account in the %s direction',
      async (status, expectedStatus) => {
        const email = `${run}-missing@example.com`;
        await patchStatus(email.toUpperCase(), { status, expectedStatus })
          .expect(404)
          .expect(({ body }) => expect(body.code).toBe('user.notFound'));
        expect(await audits(email)).toEqual([]);
      },
    );
  });

  it('serializes duplicate suspension and reactivation: one success, one conflict and one audit per transition', async () => {
    const target = await register('concurrent');
    for (const [status, expectedStatus, action] of [
      ['suspended', 'active', 'Suspended user'],
      ['active', 'suspended', 'Reactivated user'],
    ] as const) {
      const beforeSessions = await sessions(target);
      const responses = await Promise.all([
        patchStatus(target.email, { status, expectedStatus }),
        patchStatus(target.email.toUpperCase(), { status, expectedStatus }),
      ]);
      expect(
        responses.map((response) => response.status).sort((a, b) => a - b),
      ).toEqual([200, 409]);
      expect(
        responses.find((response) => response.status === 409)?.body.code,
      ).toBe('user.statusConflict');
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: target.id } }))
          .status,
      ).toBe(status);
      const entries = await audits(target.email);
      expect(entries.filter((entry) => entry.action === action)).toHaveLength(
        1,
      );
      expect(entries).toHaveLength(status === 'suspended' ? 1 : 2);
      const afterSessions = await sessions(target);
      expect(afterSessions.every((session) => session.revokedAt !== null)).toBe(
        true,
      );
      if (status === 'active') expect(afterSessions).toEqual(beforeSessions);
    }
  });

  async function createOwnedBusinessData(target: Fixture) {
    const companyId = `${run}-company`;
    await prisma.company.create({
      data: { id: companyId, name: 'Admin users isolated fixture company' },
    });
    companyIds.push(companyId);
    const listing = await prisma.listing.create({
      data: {
        code: `${run}-listing`,
        companyId,
        companyName: 'Owned test company',
        status: 'approved',
        draft: {
          create: {
            name: 'Owned test fish',
            species: 'Koi',
            price: 100000,
            quantity: 5,
          },
        },
      },
    });
    listingIds.push(listing.id);
    await prisma.favorite.create({
      data: { userId: target.id, listingId: listing.id },
    });
    await prisma.cartItem.create({
      data: { userId: target.id, listingId: listing.id, quantity: 2 },
    });
    const order = await prisma.order.create({
      data: {
        code: `${run}-order`,
        buyerId: target.id,
        companyId,
        status: 'completed',
        paymentStatus: 'paid',
        subtotal: 100000,
        total: 100000,
        recipientName: 'Owned Buyer',
        phone: '0900999888',
        address: 'Immutable delivery snapshot',
        paidAt: new Date('2025-01-01T00:00:00.000Z'),
        completedAt: new Date('2025-01-02T00:00:00.000Z'),
        items: {
          create: {
            listingId: listing.id,
            saleMode: 'in_stock',
            quantity: 1,
            unitPrice: 100000,
            lineTotal: 100000,
          },
        },
        payments: {
          create: {
            purpose: 'order_full',
            method: 'bank_transfer',
            amount: 100000,
            state: 'paid',
            idempotencyKey: `${run}-payment`,
          },
        },
        review: {
          create: {
            listingId: listing.id,
            buyerId: target.id,
            companyId,
            rating: 5,
            text: 'Immutable review',
          },
        },
      },
    });
    orderIds.push(order.id);
    await prisma.conversation.create({
      data: {
        buyerId: target.id,
        companyId,
        listingId: listing.id,
        messages: {
          create: { senderId: target.id, body: 'Immutable message' },
        },
      },
    });
    await prisma.upload.create({
      data: {
        ownerId: target.id,
        url: `/uploads/${run}-metadata-only.png`,
        mimeType: 'image/png',
        sizeBytes: 1,
        purpose: 'listing_image',
      },
    });
    await prisma.verificationCode.create({
      data: {
        userId: target.id,
        purpose: 'email_verify',
        codeHash: `${run}-code-hash`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  }

  async function immutableAccountData(target: Fixture) {
    const {
      status: _status,
      updatedAt: _updatedAt,
      ...data
    } = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      include: {
        favorites: true,
        cartItems: true,
        notifications: true,
        ordersAsBuyer: {
          include: { items: true, payments: true, review: true, dispute: true },
        },
        conversationsAsBuyer: { include: { messages: true } },
        reviewsWritten: true,
        uploads: true,
        verificationCodes: true,
        sponsorships: true,
        listings: true,
        batches: true,
      },
    });
    return data;
  }

  async function expectExpired(session: Pick<Fixture, 'token' | 'cookie'>) {
    await request(app.getHttpServer())
      .get('/v1/me')
      .set(auth(session.token))
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('auth.sessionExpired'));
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', session.cookie)
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('auth.sessionExpired'));
  }

  it('revokes every session, blocks suspended login and never resurrects old credentials or mutates customer data', async () => {
    // '+' and '@' are encoded in the route; case-normalization applies in both directions.
    const target = await register('lifecycle+encoded');
    await request(app.getHttpServer())
      .patch('/v1/me')
      .set(auth(target.token))
      .send({
        name: 'Preserved profile',
        phone: '0900999888',
        location: 'Preserved location',
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/v1/me/prefs')
      .set(auth(target.token))
      .send({ status: false, reminders: false })
      .expect(200);
    await createOwnedBusinessData(target);
    const second = await login(target);
    const third = await login(target);
    const loggedOut = await login(target);
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', loggedOut.cookie)
      .expect(204);
    const credentials = [target, second, third, loggedOut];
    const beforeSessions = await sessions(target);
    expect(beforeSessions).toHaveLength(4);
    expect(
      beforeSessions.filter((session) => session.revokedAt === null),
    ).toHaveLength(3);
    const immutableBefore = await immutableAccountData(target);

    const suspended = await patchStatus(target.email.toUpperCase(), {
      status: 'suspended',
      expectedStatus: 'active',
    }).expect(200);
    expect(suspended.body).toMatchObject({
      id: target.id,
      email: target.email,
      status: 'suspended',
      role: 'User',
    });
    expectProjection(suspended.body as DirectoryItem);
    const revoked = await sessions(target);
    expect(revoked.map((session) => session.id)).toEqual(
      beforeSessions.map((session) => session.id),
    );
    for (let index = 0; index < beforeSessions.length; index += 1) {
      const { revokedAt, ...unchanged } = revoked[index];
      const { revokedAt: previousRevocation, ...previous } =
        beforeSessions[index];
      expect(revokedAt).toBeInstanceOf(Date);
      expect(unchanged).toEqual(previous);
      if (previousRevocation) expect(revokedAt).toEqual(previousRevocation);
    }
    expect(await immutableAccountData(target)).toEqual(immutableBefore);
    const suspensionAudits = await audits(target.email);
    expect(suspensionAudits).toHaveLength(1);
    expect(suspensionAudits[0]).toMatchObject({
      actorId: admin.id,
      role: 'Admin',
      action: 'Suspended user',
      target: target.email,
      link: '#admin/users',
    });
    for (const credential of credentials) await expectExpired(credential);
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: target.email, password: PASSWORD })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('auth.accountSuspended'));
    expect(await sessions(target)).toEqual(revoked);

    const reactivated = await patchStatus(target.email.toUpperCase(), {
      status: 'active',
      expectedStatus: 'suspended',
    }).expect(200);
    expect(reactivated.body).toMatchObject({
      id: target.id,
      email: target.email,
      status: 'active',
    });
    expectProjection(reactivated.body as DirectoryItem);
    expect(await sessions(target)).toEqual(revoked);
    expect(await immutableAccountData(target)).toEqual(immutableBefore);
    const reactivationAudits = await audits(target.email);
    expect(reactivationAudits).toHaveLength(2);
    expect(
      reactivationAudits.filter((entry) => entry.action === 'Reactivated user'),
    ).toHaveLength(1);
    for (const credential of credentials) await expectExpired(credential);

    const fresh = await login(target);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set(auth(fresh.token))
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          email: target.email,
          status: 'active',
          name: 'Preserved profile',
        }),
      );
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', fresh.cookie)
      .expect(200);
    const finalSessions = await sessions(target);
    expect(finalSessions).toHaveLength(5);
    expect(
      finalSessions.filter((session) => session.revokedAt === null),
    ).toHaveLength(1);
    expect(
      finalSessions.filter((session) =>
        beforeSessions.some((old) => old.id === session.id),
      ),
    ).toEqual(revoked);
    expect(await immutableAccountData(target)).toEqual(immutableBefore);
  }, 30_000);

  it('rechecks status under the issuance lock when login read active before a completed suspension', async () => {
    const target = await register('session-issuance-race');
    const users = app.get(UsersService);
    const originalLookup = users.findByEmail.bind(users);
    const readActive = deferred();
    const releaseLogin = deferred();
    const spy = vi
      .spyOn(users, 'findByEmail')
      .mockImplementation(async (email) => {
        const snapshot = await originalLookup(email);
        if (email.toLowerCase() === target.email) {
          expect(snapshot?.status).toBe('active');
          readActive.resolve();
          await releaseLogin.promise;
        }
        return snapshot;
      });
    const pendingLogin = request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: target.email, password: PASSWORD })
      .then((response) => response);
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        readActive.promise,
        new Promise<never>((_resolve, reject) => {
          watchdog = setTimeout(
            () =>
              reject(new Error('login did not reach the active-read barrier')),
            5000,
          );
        }),
      ]);
      if (watchdog) clearTimeout(watchdog);
      await patchStatus(target.email, {
        status: 'suspended',
        expectedStatus: 'active',
      }).expect(200);
      const afterSuspension = await sessions(target);
      expect(
        afterSuspension.every((session) => session.revokedAt !== null),
      ).toBe(true);
      releaseLogin.resolve();
      const response = await pendingLogin;
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('auth.accountSuspended');
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await sessions(target)).toEqual(afterSuspension);
      expect(await audits(target.email)).toHaveLength(1);
    } finally {
      if (watchdog) clearTimeout(watchdog);
      releaseLogin.resolve();
      spy.mockRestore();
      await pendingLogin;
    }
  }, 15_000);
});
