import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { request as httpRequest, type Server } from 'node:http';
import request from 'supertest';
import { Prisma, type Notification } from '../src/generated/prisma/client.js';
import type {
  NotificationType,
  UserRole,
} from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './test-app.js';

type Fixture = { id: string; email: string; token: string; role: UserRole };
type Item = Omit<
  Notification,
  'recipientId' | 'recipientRole' | 'readAt' | 'createdAt'
> & {
  readAt: string | null;
  createdAt: string;
};
type Inbox = {
  items: Item[];
  total: number;
  unreadTotal: number;
  page: number;
  limit: number;
};
type ReadAll = { updated: number; readAt: string };
const TYPES: NotificationType[] = [
  'success',
  'error',
  'system',
  'status',
  'approval',
  'reminder',
];
const ITEM_KEYS = [
  'bodyKey',
  'bodyParams',
  'createdAt',
  'id',
  'link',
  'readAt',
  'titleKey',
  'titleParams',
  'type',
];
const PASSWORD = 'SecurePass123';
const OLD_READ_AT = new Date('2020-01-02T03:04:05.000Z');
const CREATED_AT = new Date('2020-01-01T00:00:00.000Z');

function projection(row: Notification): Item {
  return {
    id: row.id,
    type: row.type,
    titleKey: row.titleKey,
    titleParams: row.titleParams,
    bodyKey: row.bodyKey,
    bodyParams: row.bodyParams,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function expectItem(item: Item) {
  expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
  expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt);
  if (item.readAt !== null)
    expect(new Date(item.readAt).toISOString()).toBe(item.readAt);
}

function expectReadAll(result: ReadAll, start: number, end: number) {
  expect(Object.keys(result).sort()).toEqual(['readAt', 'updated']);
  expect(Number.isInteger(result.updated)).toBe(true);
  expect(result.updated).toBeGreaterThanOrEqual(0);
  expect(new Date(result.readAt).toISOString()).toBe(result.readAt);
  expect(Date.parse(result.readAt)).toBeGreaterThanOrEqual(start);
  expect(Date.parse(result.readAt)).toBeLessThanOrEqual(end);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitForBarrier(promise: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Notification barrier not reached')),
          5000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

describe('Notifications (e2e)', () => {
  const run = `notifications-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let user: Fixture;
  let otherUser: Fixture;
  let admin: Fixture;
  let otherAdmin: Fixture;
  let empty: Fixture;
  let history: Notification[];
  const userIds: string[] = [];
  const notificationIds: string[] = [];
  const legacyIds: string[] = [];
  let sequence = 0;

  beforeAll(async () => {
    app = await createTestApp();
    const url = new URL(
      app.get(ConfigService).getOrThrow<string>('DATABASE_URL'),
    );
    // Stronger than the shared harness: this suite writes fixtures only to fishfarm_test.
    if (decodeURIComponent(url.pathname.slice(1)) !== 'fishfarm_test') {
      throw new Error(
        'Notification fixtures require the isolated fishfarm_test database',
      );
    }
    prisma = app.get(PrismaService);
    user = await register('owner');
    otherUser = await register('other-user');
    admin = await register('admin', 'Admin');
    otherAdmin = await register('other-admin', 'Admin');
    empty = await register('empty');
    const data: Prisma.NotificationCreateManyInput[] = Array.from(
      { length: 237 },
      (_unused, index) => ({
        id: `${run}-history-${String(index).padStart(3, '0')}`,
        recipientId: user.id,
        // A legacy role tag on an owned row cannot broaden its ownership.
        recipientRole: index === 0 ? 'Admin' : null,
        type: TYPES[index % TYPES.length],
        titleKey: 'notifications.fixture.title',
        titleParams:
          index % 4 === 0
            ? Prisma.DbNull
            : index % 4 === 1
              ? { nested: [1, true, null, { fish: 'Koi' }] }
              : index % 4 === 2
                ? ['array', 2, false]
                : 'scalar',
        bodyKey: 'notifications.fixture.body',
        bodyParams:
          index % 4 === 0
            ? Prisma.JsonNull
            : index % 4 === 1
              ? 42
              : index % 4 === 2
                ? false
                : { nested: { array: [null, 'value'] } },
        link: index % 2 === 0 ? null : '#marketplace',
        readAt: index % 3 === 0 ? OLD_READ_AT : null,
        // Many ties, and history years older than the newest row, expose caps/cutoffs.
        createdAt: new Date(
          CREATED_AT.getTime() + Math.floor(index / 5) * 1000,
        ),
      }),
    );
    notificationIds.push(...data.map((row) => row.id!));
    await prisma.notification.createMany({ data: data.toReversed() });
    history = await ownedRows(user);
    for (const owner of [otherUser, admin, otherAdmin]) {
      await createNotification(owner, {
        recipientRole: owner.role,
        type: 'approval',
      });
      await createNotification(owner, { type: 'error', readAt: OLD_READ_AT });
    }
    for (const role of ['User', 'Admin', null] as const) {
      const row = await createNotification(null, { recipientRole: role });
      legacyIds.push(row.id);
    }
  }, 30_000);

  afterAll(async () => {
    if (!prisma) {
      if (app) await app.close();
      return;
    }
    try {
      // All deletes are limited to this suite's users or exact fixture IDs.
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { recipientId: { in: userIds } },
            { id: { in: notificationIds } },
          ],
        },
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
    role: UserRole = 'User',
  ): Promise<Fixture> {
    const email = `${run}-${label}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: PASSWORD, name: `${run}-${label}` })
      .expect(201);
    const id = response.body.user.id as string;
    userIds.push(id);
    let token = response.body.accessToken as string;
    if (role === 'Admin') {
      // Parallel suites broadcast status notifications to all active Admins.
      await prisma.user.update({
        where: { id },
        data: { role, prefs: { status: false, system: true, reminders: true } },
      });
      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      token = login.body.accessToken as string;
    }
    // Remove only this registration's welcome notification for precise fixture counts.
    await prisma.notification.deleteMany({ where: { recipientId: id } });
    return { id, email, token, role };
  }

  async function createNotification(
    owner: Fixture | null,
    extra: Partial<Prisma.NotificationCreateManyInput> = {},
  ) {
    const id = `${run}-row-${String(sequence++).padStart(4, '0')}`;
    notificationIds.push(id);
    return prisma.notification.create({
      data: {
        id,
        recipientId: owner?.id ?? null,
        type: 'system',
        titleKey: 'notifications.fixture.title',
        titleParams: { nested: [1, false, null] },
        bodyKey: 'notifications.fixture.body',
        bodyParams: ['body', { amount: 10 }],
        link: '#inbox',
        createdAt: CREATED_AT,
        ...extra,
      },
    });
  }

  function auth(owner: Fixture) {
    return { Authorization: `Bearer ${owner.token}` };
  }
  function listRequest(owner: Fixture, query = '') {
    return request(app.getHttpServer())
      .get(`/v1/me/notifications${query ? `?${query}` : ''}`)
      .set(auth(owner));
  }
  async function list(owner: Fixture, query = ''): Promise<Inbox> {
    const response = await listRequest(owner, query).expect(200);
    expect(Object.keys(response.body).sort()).toEqual([
      'items',
      'limit',
      'page',
      'total',
      'unreadTotal',
    ]);
    (response.body as Inbox).items.forEach(expectItem);
    return response.body as Inbox;
  }
  function mark(owner: Fixture, id: string, body: unknown = { read: true }) {
    return request(app.getHttpServer())
      .patch(`/v1/notifications/${id}`)
      .set(auth(owner))
      .send(body as object);
  }
  function readAll(owner: Fixture) {
    return request(app.getHttpServer())
      .post('/v1/notifications/read-all')
      .set(auth(owner));
  }
  function ownedRows(owner: Fixture) {
    return prisma.notification.findMany({
      where: { recipientId: owner.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  it('returns exact defaults and projection, preserving nullable and unrestricted existing JSON params', async () => {
    const result = await list(user);
    expect(result).toEqual({
      items: history.slice(0, 25).map(projection),
      total: 237,
      unreadTotal: 158,
      page: 1,
      limit: 25,
    });
    const all = await list(user, 'limit=100');
    expect(all.items).toEqual(history.slice(0, 100).map(projection));
    expect(
      all.items.some(
        (item) => item.titleParams === null && item.bodyParams === null,
      ),
    ).toBe(true);
    expect(all.items.some((item) => Array.isArray(item.titleParams))).toBe(
      true,
    );
    expect(all.items.some((item) => item.bodyParams === false)).toBe(true);
    expect(all.items.some((item) => item.titleParams === 'scalar')).toBe(true);
    expect(all.items.some((item) => item.bodyParams === 42)).toBe(true);
    expect(
      all.items.some(
        (item) =>
          typeof item.titleParams === 'object' &&
          item.titleParams !== null &&
          !Array.isArray(item.titleParams),
      ),
    ).toBe(true);
  });

  it('pages the full history beyond 200 with stable createdAt DESC/id ASC ties and bounded high pages', async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4].map((page) => list(user, `page=${page}&limit=100`)),
    );
    expect(pages.map((page) => page.items.length)).toEqual([100, 100, 37, 0]);
    expect(pages.flatMap((page) => page.items)).toEqual(
      history.map(projection),
    );
    expect(
      new Set(pages.flatMap((page) => page.items.map((item) => item.id))).size,
    ).toBe(237);
    for (const page of pages)
      expect(page).toMatchObject({ total: 237, unreadTotal: 158, limit: 100 });
    expect(await list(user, 'page=2&limit=100')).toEqual(pages[1]);
    expect(await list(user, 'page=1000000&limit=100')).toEqual({
      items: [],
      total: 237,
      unreadTotal: 158,
      page: 1000000,
      limit: 100,
    });
    expect((await list(user, 'page=0001&limit=001')).items).toEqual([
      projection(history[0]),
    ]);
  });

  it.each(['all', 'unread', 'read'] as const)(
    'filters %s and each existing category with owner-wide unreadTotal',
    async (read) => {
      for (const type of TYPES) {
        const filtered = history.filter(
          (row) =>
            row.type === type &&
            (read === 'all' ||
              (read === 'unread' ? row.readAt === null : row.readAt !== null)),
        );
        const result = await list(user, `read=${read}&type=${type}&limit=100`);
        expect(result).toEqual({
          items: filtered.map(projection),
          total: filtered.length,
          unreadTotal: 158,
          page: 1,
          limit: 100,
        });
        expect(
          await list(user, `read=${read}&type=${type}&page=999&limit=1`),
        ).toEqual({
          items: [],
          total: filtered.length,
          unreadTotal: 158,
          page: 999,
          limit: 1,
        });
      }
      const filtered = history.filter(
        (row) =>
          read === 'all' ||
          (read === 'unread' ? row.readAt === null : row.readAt !== null),
      );
      expect((await list(user, `read=${read}`)).total).toBe(filtered.length);
    },
  );

  it('isolates both User and separate Admin inboxes, excluding role-only and unassigned rows', async () => {
    for (const owner of [otherUser, admin, otherAdmin]) {
      const rows = await ownedRows(owner);
      expect(await list(owner)).toEqual({
        items: rows.map(projection),
        total: 2,
        unreadTotal: 1,
        page: 1,
        limit: 25,
      });
      expect(
        (await list(owner)).items.some((item) => legacyIds.includes(item.id)),
      ).toBe(false);
    }
    expect(await list(empty)).toEqual({
      items: [],
      total: 0,
      unreadTotal: 0,
      page: 1,
      limit: 25,
    });
  });

  it.each([
    'unknown=true',
    'recipientId=foreign',
    'recipientRole=Admin',
    'sort=id',
    'read=',
    'read=null',
    'read=All',
    'read=1',
    'read=true',
    'read=unread&read=read',
    'read[value]=read',
    'type=',
    'type=null',
    'type=warning',
    'type=System',
    'type=1',
    'type=system&type=error',
    'type[value]=system',
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
      'NaN',
      '1%20',
      '%201',
    ].map((value) => `page=${value}`),
    'page=1&page=2',
    'page=1&page=1',
    'page[value]=1',
    'page[]=1',
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
      'NaN',
      '1%20',
      '%201',
    ].map((value) => `limit=${value}`),
    'limit=1&limit=2',
    'limit=1&limit=1',
    'limit[value]=1',
    'limit[]=1',
  ])('strictly rejects query %s', async (query) => {
    await listRequest(user, query)
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('validation.failed'));
  });

  it.each(
    [
      {},
      { read: false },
      { read: 'true' },
      { read: 'false' },
      { read: null },
      { read: 1 },
      { read: 0 },
      { read: [] },
      { read: {} },
      { read: [true] },
      { read: true, unknown: 1 },
      { read: true, recipientId: 'foreign' },
      { read: true, readAt: '2020-01-01T00:00:00.000Z' },
      [],
      [{ read: true }],
    ].map((body) => [body]),
  )(
    'rejects malformed PATCH body %j without changing any field',
    async (body) => {
      const row = history.find((item) => item.readAt === null)!;
      await mark(user, row.id, body)
        .expect(400)
        .expect(({ body: error }) =>
          expect(error.code).toBe('validation.failed'),
        );
      expect(
        await prisma.notification.findUniqueOrThrow({ where: { id: row.id } }),
      ).toEqual(row);
    },
  );

  it.each(['false', 'true', 'null', '"true"', '"body"', '123'])(
    'rejects raw primitive JSON %s for both mutation routes',
    async (body) => {
      const row = history.find((item) => item.readAt === null)!;
      await request(app.getHttpServer())
        .patch(`/v1/notifications/${row.id}`)
        .set(auth(user))
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400);
      await readAll(user)
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400);
      expect(
        await prisma.notification.findUniqueOrThrow({ where: { id: row.id } }),
      ).toEqual(row);
    },
  );

  it('rejects absent PATCH body and malformed JSON without mutation', async () => {
    const row = history.find((item) => item.readAt === null)!;
    await request(app.getHttpServer())
      .patch(`/v1/notifications/${row.id}`)
      .set(auth(user))
      .expect(400);
    await mark(user, row.id, '{"read":')
      .set('Content-Type', 'application/json')
      .expect(400);
    await readAll(user)
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(
      await prisma.notification.findUniqueOrThrow({ where: { id: row.id } }),
    ).toEqual(row);
  });

  it.each(
    [
      { read: true },
      { page: 1 },
      { type: 'system' },
      { recipientId: 'foreign' },
      { cutoff: 'now' },
      [],
      ['body'],
      [{}],
    ].map((body) => [body]),
  )('rejects read-all payload %j without mutation', async (body) => {
    const before = await ownedRows(user);
    await readAll(user)
      .send(body)
      .expect(400)
      .expect(({ body: error }) =>
        expect(error.code).toBe('validation.failed'),
      );
    expect(await ownedRows(user)).toEqual(before);
  });

  it.each([
    ['text/plain', 'content-length'],
    ['application/octet-stream', 'content-length'],
    ['text/plain', 'chunked'],
    ['application/octet-stream', 'chunked'],
  ])('rejects ignored nonempty read-all stream %s with %s framing', async (contentType, framing) => {
    const owner = await register(`ignored-body-${sequence++}`);
    const row = await createNotification(owner, { readAt: OLD_READ_AT });
    let response: { status: number; body: Record<string, unknown> };
    if (framing === 'chunked') {
      // Superagent.send adds Content-Length even with Transfer-Encoding set.
      // Use native framing to exercise a valid chunked request, not Node's
      // pre-controller rejection of conflicting HTTP framing headers.
      const server = app.getHttpServer() as Server;
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      try {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Missing test server address');
        response = await new Promise((resolve, reject) => {
          const incoming = httpRequest({
            hostname: '127.0.0.1', port: address.port,
            path: '/v1/notifications/read-all', method: 'POST',
            headers: { ...auth(owner), 'Content-Type': contentType, 'Transfer-Encoding': 'chunked' },
          }, (result) => {
            const chunks: Buffer[] = [];
            result.on('data', (chunk: Buffer) => chunks.push(chunk));
            result.on('error', reject);
            result.on('end', () => {
              try {
                resolve({ status: result.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown> });
              } catch (error) { reject(error); }
            });
          });
          incoming.on('error', reject);
          incoming.write('unexpected-');
          incoming.end('payload');
        });
      } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
    } else {
      response = await readAll(owner).set('Content-Type', contentType).send('unexpected-payload');
    }
    expect(await ownedRows(owner)).toEqual([row]);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation.failed');
  });

  it('returns uniform notification.notFound for missing, foreign, role-only, and unassigned IDs for both roles', async () => {
    const before = await prisma.notification.findMany({
      where: { id: { in: notificationIds } },
      orderBy: { id: 'asc' },
    });
    for (const owner of [user, admin, otherAdmin]) {
      const foreign =
        history[0].recipientId === owner.id
          ? (await ownedRows(admin))[0]
          : history[0];
      const ids = [foreign.id, `${run}-missing`, ...legacyIds];
      if (owner.id === admin.id) ids.push((await ownedRows(otherAdmin))[0].id);
      for (const id of ids) {
        await mark(owner, id)
          .expect(404)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              code: 'notification.notFound',
              params: {},
              statusCode: 404,
            });
            expect(body).not.toHaveProperty('recipientId');
            expect(body).not.toHaveProperty('recipientRole');
          });
      }
    }
    expect(
      await prisma.notification.findMany({
        where: { id: { in: notificationIds } },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);
  });

  it('marks only owned notifications and preserves first timestamps and all other fields on repeats for both roles', async () => {
    for (const owner of [user, admin, otherAdmin]) {
      const row = await createNotification(owner);
      const beforeOthers = await prisma.notification.findMany({
        where: { id: { in: notificationIds, not: row.id } },
        orderBy: { id: 'asc' },
      });
      const start = Date.now();
      const first = await mark(owner, row.id).expect(200);
      expectItem(first.body as Item);
      expect(Date.parse(first.body.readAt as string)).toBeGreaterThanOrEqual(
        start,
      );
      expect(Date.parse(first.body.readAt as string)).toBeLessThanOrEqual(
        Date.now(),
      );
      expect(first.body).toEqual({
        ...projection(row),
        readAt: expect.any(String),
      });
      await new Promise((resolve) => setTimeout(resolve, 15));
      const repeated = await mark(owner, row.id).expect(200);
      expect(repeated.body).toEqual(first.body);
      const saved = await prisma.notification.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(saved).toEqual({
        ...row,
        readAt: new Date(first.body.readAt as string),
      });
      expect(
        await prisma.notification.findMany({
          where: { id: { in: notificationIds, not: row.id } },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(beforeOthers);
      const alreadyRead = await createNotification(owner, {
        readAt: OLD_READ_AT,
      });
      expect((await mark(owner, alreadyRead.id).expect(200)).body).toEqual(
        projection(alreadyRead),
      );
    }
  });

  it('read-all uses every owned unread row across categories/pages, preserves prior fields and timestamps, and repeats with a new operation timestamp', async () => {
    for (const owner of [user, admin, otherAdmin, empty]) {
      const before = await ownedRows(owner);
      const otherRows = await prisma.notification.findMany({
        where: { id: { in: notificationIds }, NOT: { recipientId: owner.id } },
        orderBy: { id: 'asc' },
      });
      // A previously viewed filtered page does not define the mutation's scope.
      await list(owner, 'read=unread&type=system&limit=1&page=2');
      const start = Date.now();
      const response = await readAll(owner).expect(200);
      const result = response.body as ReadAll;
      expectReadAll(result, start, Date.now());
      expect(result.updated).toBe(
        before.filter((row) => row.readAt === null).length,
      );
      expect(await ownedRows(owner)).toEqual(
        before.map((row) => ({
          ...row,
          readAt: row.readAt ?? new Date(result.readAt),
        })),
      );
      expect(
        await prisma.notification.findMany({
          where: {
            id: { in: notificationIds },
            NOT: { recipientId: owner.id },
          },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(otherRows);
      const after = await ownedRows(owner);
      await new Promise((resolve) => setTimeout(resolve, 15));
      const repeatStart = Date.now();
      const repeated = (await readAll(owner).send({}).expect(200))
        .body as ReadAll;
      expectReadAll(repeated, repeatStart, Date.now());
      expect(repeated.updated).toBe(0);
      expect(repeated.readAt).not.toBe(result.readAt);
      expect(await ownedRows(owner)).toEqual(after);
      expect((await list(owner, 'read=unread')).total).toBe(0);
      const arrived = await createNotification(owner);
      expect((await list(owner, 'read=unread')).items).toEqual([
        projection(arrived),
      ]);
      const next = (await readAll(owner).expect(200)).body as ReadAll;
      expect(next.updated).toBe(1);
      expect((await mark(owner, arrived.id).expect(200)).body.readAt).toBe(
        next.readAt,
      );
    }
    expect(
      await prisma.notification.findMany({ where: { id: { in: legacyIds } } }),
    ).toEqual(
      expect.arrayContaining(
        legacyIds.map((id) =>
          expect.objectContaining({ id, readAt: null, recipientId: null }),
        ),
      ),
    );
  });

  it('serializes simultaneous single reads to the identical first readAt for both roles', async () => {
    for (const owner of [user, admin]) {
      const row = await createNotification(owner);
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => mark(owner, row.id).expect(200)),
      );
      const saved = await prisma.notification.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(saved.readAt).not.toBeNull();
      for (const response of responses)
        expect(response.body).toEqual(projection(saved));
      expect(saved).toEqual({ ...row, readAt: saved.readAt });
    }
  });

  it('concurrent single reads and read-all preserve fields, count each transition once, and keep timestamps idempotent', async () => {
    for (const role of ['User', 'Admin'] as const) {
      const owner = await register(`race-${role}`, role);
      const unread = await Promise.all(
        TYPES.map((type) => createNotification(owner, { type })),
      );
      const prior = await createNotification(owner, { readAt: OLD_READ_AT });
      const start = Date.now();
      const [singleOne, singleTwo, allOne, allTwo] = await Promise.all([
        mark(owner, unread[0].id).expect(200),
        mark(owner, unread[0].id).expect(200),
        readAll(owner).expect(200),
        readAll(owner).expect(200),
      ]);
      const end = Date.now();
      const results = [allOne.body, allTwo.body] as ReadAll[];
      results.forEach((result) => expectReadAll(result, start, end));
      const bulkUpdated = results.reduce(
        (sum, result) => sum + result.updated,
        0,
      );
      expect([unread.length, unread.length - 1]).toContain(bulkUpdated);
      const after = await ownedRows(owner);
      const marked = after.find((row) => row.id === unread[0].id)!;
      expect(singleOne.body).toEqual(projection(marked));
      expect(singleTwo.body).toEqual(singleOne.body);
      const bulkTimestamps = results
        .filter((result) => result.updated > 0)
        .map((result) => result.readAt);
      for (const row of unread) {
        const saved = after.find((item) => item.id === row.id)!;
        expect(saved).toEqual({ ...row, readAt: expect.any(Date) });
        if (row.id !== unread[0].id)
          expect(bulkTimestamps).toContain(saved.readAt!.toISOString());
      }
      expect(after.find((row) => row.id === prior.id)).toEqual(prior);
      expect((await mark(owner, marked.id).expect(200)).body).toEqual(
        singleOne.body,
      );
      expect((await readAll(owner).expect(200)).body.updated).toBe(0);
      expect(await ownedRows(owner)).toEqual(after);
    }
  });

  it('page, filtered count, and owner-wide unread count share the same RepeatableRead snapshot during concurrent mutations and arrivals', async () => {
    const owner = await register('snapshot');
    const first = await createNotification(owner, { type: 'system' });
    const second = await createNotification(owner, { type: 'system' });
    await createNotification(owner, { type: 'error' });
    await createNotification(owner, { type: 'error', readAt: OLD_READ_AT });
    const pageRead = deferred();
    const releasePage = deferred();
    type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
    type Options = { isolationLevel?: Prisma.TransactionIsolationLevel };
    const original = prisma.$transaction.bind(prisma) as (
      callback: Callback,
      options?: Options,
    ) => Promise<unknown>;
    const implementation = async (callback: Callback, options?: Options) =>
      original(async (tx) => {
        const notifications = new Proxy(tx.notification, {
          get(target, property) {
            if (property !== 'findMany') return Reflect.get(target, property);
            return async (args: Prisma.NotificationFindManyArgs) => {
              const rows = await target.findMany(args);
              if (args.where?.recipientId === owner.id) {
                expect(options?.isolationLevel).toBe('RepeatableRead');
                pageRead.resolve();
                await releasePage.promise;
              }
              return rows;
            };
          },
        });
        return callback(
          new Proxy(tx, {
            get: (target, property) =>
              property === 'notification'
                ? notifications
                : Reflect.get(target, property),
          }),
        );
      }, options);
    const spy = vi
      .spyOn(prisma, '$transaction')
      .mockImplementation(implementation as typeof prisma.$transaction);
    const pending = listRequest(owner, 'read=unread&type=system').then(
      (response) => response,
    );
    try {
      await waitForBarrier(pageRead.promise);
      await readAll(owner).expect(200);
      const arrival = await createNotification(owner, { type: 'system' });
      releasePage.resolve();
      const result = await pending;
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        items: [projection(first), projection(second)],
        total: 2,
        unreadTotal: 3,
        page: 1,
        limit: 25,
      });
      spy.mockRestore();
      expect(await list(owner, 'read=unread&type=system')).toEqual({
        items: [projection(arrival)],
        total: 1,
        unreadTotal: 1,
        page: 1,
        limit: 25,
      });
    } finally {
      releasePage.resolve();
      spy.mockRestore();
      await pending;
    }
  }, 15_000);

  it('an arrival after the read-all UPDATE snapshot can remain unread without changing its updated count', async () => {
    const owner = await register('arrival');
    const prior = await createNotification(owner, { readAt: OLD_READ_AT });
    const first = await createNotification(owner);
    const updated = deferred();
    const release = deferred();
    const original = prisma.notification.updateMany.bind(prisma.notification);
    const implementation = async (args: Prisma.NotificationUpdateManyArgs) => {
      const result = await original(args);
      if (args.where?.recipientId === owner.id) {
        updated.resolve();
        await release.promise;
      }
      return result;
    };
    const spy = vi
      .spyOn(prisma.notification, 'updateMany')
      .mockImplementation(
        implementation as unknown as typeof prisma.notification.updateMany,
      );
    const start = Date.now();
    const pending = readAll(owner).then((response) => response);
    try {
      await waitForBarrier(updated.promise);
      const arrival = await createNotification(owner);
      release.resolve();
      const response = await pending;
      expect(response.status).toBe(200);
      const result = response.body as ReadAll;
      expectReadAll(result, start, Date.now());
      expect(result.updated).toBe(1);
      expect(
        await prisma.notification.findUniqueOrThrow({
          where: { id: first.id },
        }),
      ).toEqual({ ...first, readAt: new Date(result.readAt) });
      expect(
        await prisma.notification.findUniqueOrThrow({
          where: { id: prior.id },
        }),
      ).toEqual(prior);
      expect(await list(owner, 'read=unread')).toEqual({
        items: [projection(arrival)],
        total: 1,
        unreadTotal: 1,
        page: 1,
        limit: 25,
      });
    } finally {
      release.resolve();
      spy.mockRestore();
      await pending;
    }
  }, 15_000);

  it('protects all routes for missing/invalid auth, suspended accounts, and revoked sessions for both roles without mutation', async () => {
    for (const role of ['User', 'Admin'] as const) {
      const owner = await register(`guard-${role}`, role);
      const row = await createNotification(owner);
      const routes = () => [
        () => request(app.getHttpServer()).get('/v1/me/notifications'),
        () =>
          request(app.getHttpServer())
            .patch(`/v1/notifications/${row.id}`)
            .send({ read: true }),
        () => request(app.getHttpServer()).post('/v1/notifications/read-all'),
      ];
      for (const route of routes())
        await route()
          .expect(401)
          .expect(({ body }) => expect(body.code).toBe('auth.missingToken'));
      for (const route of routes())
        await route()
          .set('Authorization', 'Bearer invalid')
          .expect(401)
          .expect(({ body }) => expect(body.code).toBe('auth.invalidToken'));
      await prisma.user.update({
        where: { id: owner.id },
        data: { status: 'suspended' },
      });
      for (const route of routes())
        await route()
          .set(auth(owner))
          .expect(403)
          .expect(({ body }) =>
            expect(body.code).toBe('auth.accountSuspended'),
          );
      await prisma.user.update({
        where: { id: owner.id },
        data: { status: 'active' },
      });
      await prisma.session.updateMany({
        where: { userId: owner.id },
        data: { revokedAt: new Date() },
      });
      for (const route of routes())
        await route()
          .set(auth(owner))
          .expect(401)
          .expect(({ body }) => expect(body.code).toBe('auth.sessionExpired'));
      expect(
        await prisma.notification.findUniqueOrThrow({ where: { id: row.id } }),
      ).toEqual(row);
    }
  }, 30_000);
});
