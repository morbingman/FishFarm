import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import request, { type Response } from 'supertest';
import type { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';
const REFRESH_COOKIE = 'fishfarm_refresh';
const DEFAULT_PREFS = { status: true, system: true, reminders: true };
const PUBLIC_KEYS = [
  'email',
  'emailVerifiedAt',
  'id',
  'joinedAt',
  'location',
  'name',
  'phone',
  'prefs',
  'role',
  'status',
];
type Role = 'User' | 'Admin';
type Fixture = { id: string; email: string; token: string; cookie: string };

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

async function waitForBarrier(promise: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('prefs transaction did not reach barrier')),
          3000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function expectProjection(body: Record<string, unknown>) {
  expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
  expect(body).toMatchObject({
    id: expect.any(String),
    email: expect.any(String),
    name: expect.any(String),
    role: expect.stringMatching(/^(User|Admin)$/),
    status: 'active',
    joinedAt: expect.any(String),
  });
  const prefs = body.prefs as Record<string, unknown>;
  expect(Object.keys(prefs).sort()).toEqual(['reminders', 'status', 'system']);
  for (const value of Object.values(prefs))
    expect(typeof value).toBe('boolean');
}

const PROFILE_INVALID = (['name', 'phone', 'location'] as const).flatMap(
  (field) =>
    [null, true, false, 0, 123, ['value'], { value: 'value' }].map((value) => ({
      field,
      value,
    })),
);
const PREFS_INVALID = (['status', 'system', 'reminders'] as const).flatMap(
  (field) =>
    ['false', 'true', '', 0, 1, -1, null, [false], { value: false }].map(
      (value) => ({ field, value }),
    ),
);

describe('Own profile and preferences (e2e)', () => {
  const run = `profile-${randomUUID()}`;
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  const userIds: string[] = [];

  beforeAll(async () => {
    // vitest.config.e2e.ts rejects the development DB and selects a separate *_test DB.
    app = await createTestApp();
    const database = new URL(
      app.get(ConfigService).getOrThrow<string>('DATABASE_URL'),
    );
    if (!decodeURIComponent(database.pathname.slice(1)).endsWith('_test')) {
      throw new Error('Profile fixtures require the guarded *_test database');
    }
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    try {
      if (prisma && userIds.length > 0) {
        // Delete only this suite's registration activity; user relations cascade.
        await prisma.activity.deleteMany({
          where: { actorId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      if (app) await app.close();
    }
  });

  async function register(label: string, role: Role): Promise<Fixture> {
    const email = `${run}-${label}@example.com`.toLowerCase();
    const registered = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: PASSWORD, name: `Profile ${label}` })
      .expect(201);
    const id = registered.body.user.id as string;
    userIds.push(id);
    let response = registered;
    if (role === 'Admin') {
      await prisma.user.update({ where: { id }, data: { role } });
      response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
    }
    return {
      id,
      email,
      token: response.body.accessToken as string,
      cookie: refreshCookie(response),
    };
  }

  function patch(owner: Fixture, path: string, body: object) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(body);
  }

  function get(owner: Fixture, path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${owner.token}`);
  }

  function row(owner: Fixture) {
    return prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
  }

  async function sessionCredentials(owner: Fixture) {
    const sessions = await prisma.session.findMany({
      where: { userId: owner.id },
      orderBy: { id: 'asc' },
    });
    // The guard legitimately slides the idle window on each authenticated request.
    return sessions.map(
      ({ lastActiveAt: _lastActiveAt, ...credentials }) => credentials,
    );
  }

  it('requires authentication for profile and preferences reads and writes', async () => {
    const routes = [
      () => request(app.getHttpServer()).get('/v1/me'),
      () =>
        request(app.getHttpServer())
          .patch('/v1/me')
          .send({ name: 'Unauthorized' }),
      () => request(app.getHttpServer()).get('/v1/me/prefs'),
      () =>
        request(app.getHttpServer())
          .patch('/v1/me/prefs')
          .send({ status: false }),
    ];
    for (const route of routes) {
      await route()
        .expect(401)
        .expect(({ body }) => expect(body.code).toBe('auth.missingToken'));
      await route()
        .set('Authorization', 'Bearer invalid')
        .expect(401)
        .expect(({ body }) => expect(body.code).toBe('auth.invalidToken'));
    }
  });

  describe.each(['User', 'Admin'] as const)(
    '%s ownership and saves',
    (role) => {
      let owner: Fixture;
      let other: Fixture;

      beforeAll(async () => {
        owner = await register(`${role}-owner`, role);
        other = await register(
          `${role}-other`,
          role === 'User' ? 'Admin' : 'User',
        );
      }, 15_000);

      it('reads defaults and updates only the authenticated account, not a query-selected account', async () => {
        const otherBefore = await row(other);
        const initial = await get(owner, '/v1/me').expect(200);
        expectProjection(initial.body);
        expect(initial.body).toMatchObject({
          id: owner.id,
          email: owner.email,
          role,
          phone: null,
          location: null,
          emailVerifiedAt: null,
          prefs: DEFAULT_PREFS,
        });
        expect((await get(owner, '/v1/me/prefs').expect(200)).body).toEqual(
          DEFAULT_PREFS,
        );
        const query = `?id=${other.id}&userId=${other.id}&email=${encodeURIComponent(other.email)}`;
        const updated = await patch(owner, `/v1/me${query}`, {
          name: `Saved ${role}`,
          phone: '+84 90 123 4567',
          location: 'Can Tho',
        }).expect(200);
        expectProjection(updated.body);
        expect(updated.body).toMatchObject({
          id: owner.id,
          email: owner.email,
          role,
          name: `Saved ${role}`,
          phone: '+84 90 123 4567',
          location: 'Can Tho',
        });
        expect(
          (
            await patch(owner, `/v1/me/prefs${query}`, {
              status: false,
            }).expect(200)
          ).body,
        ).toEqual({ ...DEFAULT_PREFS, status: false });
        expect((await get(owner, `/v1/me${query}`).expect(200)).body.id).toBe(
          owner.id,
        );
        expect(
          (await get(owner, `/v1/me/prefs${query}`).expect(200)).body.status,
        ).toBe(false);
        expect(await row(other)).toEqual(otherBefore);
      });

      it('preserves omitted profile fields, accepts empty patches and clears phone/location with empty strings', async () => {
        const before = await get(owner, '/v1/me').expect(200);
        const empty = await patch(owner, '/v1/me', {}).expect(200);
        expect(empty.body).toEqual(before.body);
        const phoneOnly = await patch(owner, '/v1/me', { phone: '' }).expect(
          200,
        );
        expect(phoneOnly.body).toEqual({ ...before.body, phone: '' });
        const locationOnly = await patch(owner, '/v1/me', {
          location: '',
        }).expect(200);
        expect(locationOnly.body).toEqual({
          ...before.body,
          phone: '',
          location: '',
        });
        expect((await get(owner, '/v1/me').expect(200)).body).toEqual(
          locationOnly.body,
        );
      });

      it('accepts the existing 80/32/120 length boundaries and a one-character name', async () => {
        const values = {
          name: 'n'.repeat(80),
          phone: 'p'.repeat(32),
          location: 'l'.repeat(120),
        };
        const updated = await patch(owner, '/v1/me', values).expect(200);
        expectProjection(updated.body);
        expect(updated.body).toMatchObject(values);
        expect(
          (await patch(owner, '/v1/me', { name: 'N' }).expect(200)).body,
        ).toMatchObject({ ...values, name: 'N' });
      });

      it.each(PROFILE_INVALID)(
        'rejects raw profile $field = $value without coercion or mutation',
        async ({ field, value }) => {
          const before = await row(owner);
          await patch(owner, '/v1/me', {
            [field === 'name' ? 'phone' : 'name']: 'Must not be saved',
            [field]: value,
          })
            .expect(400)
            .expect(({ body }) => expect(body.code).toBe('validation.failed'));
          expect(await row(owner)).toEqual(before);
        },
      );

      it.each(['', ' ', '\t\r\n', '\u00a0\u2003'])(
        'rejects blank name %j',
        async (name) => {
          const before = await row(owner);
          await patch(owner, '/v1/me', { name })
            .expect(400)
            .expect(({ body }) => {
              expect(body.code).toBe('validation.failed');
              expect(body.details).toContain('validation.nameLength');
            });
          expect(await row(owner)).toEqual(before);
        },
      );

      it.each([
        { name: 'n'.repeat(81) },
        { phone: 'p'.repeat(33) },
        { location: 'l'.repeat(121) },
        // Whitespace is not trimmed to bypass the existing length limits.
        { name: ` ${'n'.repeat(80)}` },
      ])('rejects profile over the existing length limits %j', async (body) => {
        const before = await row(owner);
        await patch(owner, '/v1/me', body)
          .expect(400)
          .expect(({ body: error }) =>
            expect(error.code).toBe('validation.failed'),
          );
        expect(await row(owner)).toEqual(before);
      });

      it.each([
        'id',
        'userId',
        'email',
        'role',
        'status',
        'passwordHash',
        'prefs',
        'store',
      ])('rejects non-whitelisted profile field %s', async (field) => {
        const before = await row(owner);
        const otherBefore = await row(other);
        await patch(owner, '/v1/me', {
          name: 'Must not be saved',
          [field]: other.id,
        })
          .expect(400)
          .expect(({ body }) => {
            expect(body.code).toBe('validation.failed');
            expect(body.details).toEqual(
              expect.arrayContaining([expect.stringContaining(field)]),
            );
          });
        expect(await row(owner)).toEqual(before);
        expect(await row(other)).toEqual(otherBefore);
      });

      it.each(PREFS_INVALID)(
        'rejects raw prefs $field = $value without coercion or mutation',
        async ({ field, value }) => {
          const before = await row(owner);
          await patch(owner, '/v1/me/prefs', {
            [field === 'status' ? 'system' : 'status']: false,
            [field]: value,
          })
            .expect(400)
            .expect(({ body }) => {
              expect(body.code).toBe('validation.failed');
              expect(body.details).toContain('validation.boolean');
            });
          expect(await row(owner)).toEqual(before);
        },
      );

      it.each(['id', 'userId', 'email', 'name', 'extra'])(
        'rejects non-whitelisted prefs field %s',
        async (field) => {
          const before = await row(owner);
          await patch(owner, '/v1/me/prefs', {
            status: false,
            [field]: other.id,
          })
            .expect(400)
            .expect(({ body }) => expect(body.code).toBe('validation.failed'));
          expect(await row(owner)).toEqual(before);
        },
      );

      it('preserves independent prefs on partial/empty updates and stores actual true and false booleans', async () => {
        await patch(owner, '/v1/me/prefs', DEFAULT_PREFS).expect(200);
        const expected = { ...DEFAULT_PREFS };
        for (const field of ['status', 'system', 'reminders'] as const) {
          expected[field] = false;
          expect(
            (await patch(owner, '/v1/me/prefs', { [field]: false }).expect(200))
              .body,
          ).toEqual(expected);
          expect((await row(owner)).prefs).toEqual(expected);
          expect((await get(owner, '/v1/me/prefs').expect(200)).body).toEqual(
            expected,
          );
        }
        expect(
          (await patch(owner, '/v1/me/prefs', {}).expect(200)).body,
        ).toEqual(expected);
        for (const field of ['status', 'system', 'reminders'] as const) {
          expected[field] = true;
          expect(
            (await patch(owner, '/v1/me/prefs', { [field]: true }).expect(200))
              .body,
          ).toEqual(expected);
          expect((await row(owner)).prefs).toEqual(expected);
        }
      });

      it.each([
        { stored: {}, expected: DEFAULT_PREFS },
        {
          stored: { status: false, reminders: false },
          expected: { status: false, system: true, reminders: false },
        },
        {
          stored: { status: 'false', system: 0, reminders: null },
          expected: DEFAULT_PREFS,
        },
      ])(
        'keeps existing normalization/defaults for stored partial prefs %j',
        async ({ stored, expected }) => {
          // Owned legacy-shaped fixtures in the isolated database, never development data.
          await prisma.user.update({
            where: { id: owner.id },
            data: { prefs: stored },
          });
          expect((await get(owner, '/v1/me/prefs').expect(200)).body).toEqual(
            expected,
          );
          const me = await get(owner, '/v1/me').expect(200);
          expectProjection(me.body);
          expect(me.body.prefs).toEqual(expected);
          const saved = { ...expected, system: false };
          expect(
            (await patch(owner, '/v1/me/prefs', { system: false }).expect(200))
              .body,
          ).toEqual(saved);
          expect((await row(owner)).prefs).toEqual(saved);
        },
      );

      it('keeps public projection, immutable account data, and all sessions valid after saves', async () => {
        const before = await row(owner);
        const credentials = await sessionCredentials(owner);
        const saved = await patch(owner, '/v1/me', {
          name: `Session ${role}`,
          phone: '',
          location: '',
        }).expect(200);
        expectProjection(saved.body);
        expect(saved.headers['set-cookie']).toBeUndefined();
        const prefs = await patch(owner, '/v1/me/prefs', {
          reminders: false,
        }).expect(200);
        expect(prefs.headers['set-cookie']).toBeUndefined();
        expect(await row(owner)).toEqual({
          ...before,
          name: `Session ${role}`,
          phone: '',
          location: '',
          prefs: prefs.body,
          updatedAt: expect.any(Date),
        });
        expect(await sessionCredentials(owner)).toEqual(credentials);
        const me = await get(owner, '/v1/me').expect(200);
        expectProjection(me.body);
        expect(me.body).toEqual({ ...saved.body, prefs: prefs.body });
        const refreshed = await request(app.getHttpServer())
          .post('/v1/auth/refresh')
          .set('Cookie', owner.cookie)
          .expect(200);
        owner.cookie = refreshCookie(refreshed);
        expectProjection(refreshed.body.user);
        expect(refreshed.body.user).toEqual(me.body);
        expect((await get(owner, '/v1/me').expect(200)).body).toEqual(me.body);
        const refreshedMe = await request(app.getHttpServer())
          .get('/v1/me')
          .set(
            'Authorization',
            `Bearer ${refreshed.body.accessToken as string}`,
          )
          .expect(200);
        expect(refreshedMe.body).toEqual(me.body);
        const sessions = await prisma.session.findMany({
          where: { userId: owner.id },
        });
        expect(sessions).toHaveLength(credentials.length);
        expect(sessions.every((session) => session.revokedAt === null)).toBe(
          true,
        );
      });

      it('serializes concurrent disjoint prefs writes before reading, preserving false and true updates', async () => {
        for (const value of [false, true]) {
          const baseline = {
            status: !value,
            system: !value,
            reminders: !value,
          };
          await patch(owner, '/v1/me/prefs', baseline).expect(200);
          const firstRead = deferred();
          const secondLockAttempt = deferred();
          const releaseFirst = deferred();
          let reads = 0;
          let locks = 0;
          type Callback = (tx: Prisma.TransactionClient) => Promise<unknown>;
          type Options = { isolationLevel?: Prisma.TransactionIsolationLevel };
          const original = prisma.$transaction.bind(prisma) as (
            callback: Callback,
            options?: Options,
          ) => Promise<unknown>;
          const implementation = async (
            callback: Callback,
            options?: Options,
          ) =>
            original(async (tx) => {
              const users = new Proxy(tx.user, {
                get(target, property) {
                  if (property !== 'findUnique')
                    return Reflect.get(target, property);
                  return async (args: Prisma.UserFindUniqueArgs) => {
                    const result = await target.findUnique(args);
                    if (args.where.id === owner.id && args.select?.prefs) {
                      reads += 1;
                      if (reads === 1) {
                        firstRead.resolve();
                        await releaseFirst.promise;
                      }
                    }
                    return result;
                  };
                },
              });
              const queryRaw = tx.$queryRaw.bind(tx);
              return callback(
                new Proxy(tx, {
                  get(target, property) {
                    if (property === 'user') return users;
                    if (property === '$queryRaw') {
                      return (...args: Parameters<typeof tx.$queryRaw>) => {
                        locks += 1;
                        if (locks === 2) secondLockAttempt.resolve();
                        return queryRaw(...args);
                      };
                    }
                    return Reflect.get(target, property);
                  },
                }),
              );
            }, options);
          const spy = vi
            .spyOn(prisma, '$transaction')
            .mockImplementation(implementation as typeof prisma.$transaction);
          const first = patch(owner, '/v1/me/prefs', { status: value }).then(
            (response) => response,
          );
          let second: Promise<Response> | undefined;
          try {
            // Pause the first merge after its real locked read, then enter a second transaction.
            await waitForBarrier(firstRead.promise);
            second = patch(owner, '/v1/me/prefs', { system: value }).then(
              (response) => response,
            );
            await waitForBarrier(secondLockAttempt.promise);
            expect(reads).toBe(1);
            releaseFirst.resolve();
            const responses = await Promise.all([first, second]);
            expect(responses.map((response) => response.status)).toEqual([
              200, 200,
            ]);
            expect(responses[0].body).toEqual({ ...baseline, status: value });
            const expected = { ...baseline, status: value, system: value };
            expect(responses[1].body).toEqual(expected);
            expect(reads).toBe(2);
            expect((await row(owner)).prefs).toEqual(expected);
            expect((await get(owner, '/v1/me/prefs').expect(200)).body).toEqual(
              expected,
            );
          } finally {
            releaseFirst.resolve();
            await Promise.allSettled([first, ...(second ? [second] : [])]);
            spy.mockRestore();
          }
        }
      }, 15_000);
    },
  );
});
