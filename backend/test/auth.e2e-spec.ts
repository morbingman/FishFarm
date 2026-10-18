import request from 'supertest';
import type { Response } from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './test-app.js';

const REFRESH_COOKIE = 'fishfarm_refresh';
const PASSWORD = 'SecurePass123';

function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.floor(Math.random() * 10_000)}@example.com`;
}

function refreshCookieValue(response: Response): string {
  const header = response.headers['set-cookie'] as unknown as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = cookies.find((value) => value.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('refresh cookie was not set');
  return cookie.split(';', 1)[0];
}

describe('Auth and users (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  async function register(
    overrides: Partial<{ email: string; role: 'Buyer' | 'Seller'; store: string }> = {},
  ) {
    const email = overrides.email ?? uniqueEmail('buyer');
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: PASSWORD,
        name: 'E2E Buyer',
        role: overrides.role ?? 'Buyer',
        ...(overrides.store ? { store: overrides.store } : {}),
      });
    if (response.status === 201) createdEmails.push(email);
    return { email, response };
  }

  describe('registration and session', () => {
    let email: string;
    let accessToken: string;
    let firstCookie: string;

    beforeAll(async () => {
      const result = await register();
      email = result.email;
      const response = result.response;
      expect(response.status).toBe(201);
      accessToken = response.body.accessToken as string;
      firstCookie = refreshCookieValue(response);
    });

    it('registers a buyer and starts a session', async () => {
      expect(accessToken).toBeTruthy();
      expect(firstCookie).toMatch(new RegExp(`^${REFRESH_COOKIE}=`));

      const me = await request(app.getHttpServer())
        .get('/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(me.body).toMatchObject({
        email,
        role: 'Buyer',
        status: 'active',
        prefs: { status: true, system: true, reminders: true },
      });
      expect(me.body).not.toHaveProperty('passwordHash');
    });

    it('rejects a duplicate email', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password: PASSWORD, name: 'Duplicate', role: 'Buyer' })
        .expect(409);

      expect(response.body).toMatchObject({ code: 'auth.emailTaken' });
    });

    it('rejects a store on a buyer account', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: uniqueEmail('store'),
          password: PASSWORD,
          name: 'Store Buyer',
          role: 'Buyer',
          store: 'Not allowed',
        })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'profile.storeRequiresSeller' });
    });

    it('rejects malformed registration input with i18n keys', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', name: '', role: 'Admin' })
        .expect(400);

      expect(response.body.code).toBe('validation.failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'validation.email',
          'validation.passwordLength',
          'validation.nameLength',
          'validation.role',
        ]),
      );
    });

    it('updates profile fields', async () => {
      const response = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Buyer', phone: '+84 90 000 0000', location: 'Can Tho' })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Updated Buyer',
        phone: '+84 90 000 0000',
        location: 'Can Tho',
      });
    });

    it('rejects a store update on a buyer profile', async () => {
      const response = await request(app.getHttpServer())
        .patch('/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ store: 'Buyer Store' })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'profile.storeRequiresSeller' });
    });

    it('partially updates notification prefs', async () => {
      const updated = await request(app.getHttpServer())
        .patch('/v1/me/prefs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: false })
        .expect(200);

      expect(updated.body).toEqual({ status: false, system: true, reminders: true });

      const fetched = await request(app.getHttpServer())
        .get('/v1/me/prefs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(fetched.body).toEqual({ status: false, system: true, reminders: true });
    });

    it('rotates the refresh token and invalidates the old one', async () => {
      const rotated = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(200);

      const nextCookie = refreshCookieValue(rotated);
      expect(nextCookie).not.toBe(firstCookie);
      expect(rotated.body.accessToken).toBeTruthy();

      const me = await request(app.getHttpServer())
        .get('/v1/me')
        .set('Authorization', `Bearer ${rotated.body.accessToken as string}`)
        .expect(200);
      expect(me.body.email).toBe(email);

      const replay = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(401);
      expect(replay.body).toMatchObject({ code: 'auth.sessionExpired' });

      // The rotated token is now the only live one; use it for logout.
      firstCookie = nextCookie;
    });

    it('logs out and rejects the revoked refresh token', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Cookie', firstCookie)
        .expect(204);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(401);

      expect(response.body).toMatchObject({ code: 'auth.sessionExpired' });
    });
  });

  describe('authentication guards', () => {
    it('requires a bearer token for protected routes', async () => {
      const response = await request(app.getHttpServer()).get('/v1/me').expect(401);
      expect(response.body).toMatchObject({ code: 'auth.missingToken' });
    });

    it('rejects a malformed bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
      expect(response.body).toMatchObject({ code: 'auth.invalidToken' });
    });

    it('rejects a wrong password without revealing which part failed', async () => {
      const { email } = await register();
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: 'WrongPass123' })
        .expect(401);

      expect(response.body).toMatchObject({ code: 'auth.invalidCredentials' });
    });

    it('rejects suspended accounts at login and refresh', async () => {
      const { email, response } = await register();
      const cookie = refreshCookieValue(response);

      await prisma.user.update({ where: { email }, data: { status: 'suspended' } });

      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(403);
      expect(login.body).toMatchObject({ code: 'auth.accountSuspended' });

      const refresh = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(403);
      expect(refresh.body).toMatchObject({ code: 'auth.accountSuspended' });
    });

    it('rejects an access token whose session was revoked by a password reset', async () => {
      const { email, response } = await register();
      const accessToken = response.body.accessToken as string;

      const requestReset = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email })
        .expect(202);
      const code = requestReset.body.devCode as string;
      expect(code).toMatch(/^\d{6}$/);

      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ email, code, newPassword: 'AnotherPass456' })
        .expect(204);

      const me = await request(app.getHttpServer())
        .get('/v1/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
      expect(me.body).toMatchObject({ code: 'auth.sessionExpired' });

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: 'AnotherPass456' })
        .expect(200);
    });
  });

  describe('one-time codes', () => {
    it('verifies an email address with a 6-digit code', async () => {
      const { email } = await register();

      const requested = await request(app.getHttpServer())
        .post('/v1/auth/verify-email')
        .send({ email })
        .expect(200);
      expect(requested.body.devCode).toMatch(/^\d{6}$/);

      const confirmed = await request(app.getHttpServer())
        .post('/v1/auth/verify-email')
        .send({ email, code: requested.body.devCode })
        .expect(200);
      expect(confirmed.body).toMatchObject({ sent: true });

      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      expect(login.body.user.emailVerifiedAt).toBeTruthy();

      const replay = await request(app.getHttpServer())
        .post('/v1/auth/verify-email')
        .send({ email, code: requested.body.devCode as string })
        .expect(400);
      expect(replay.body).toMatchObject({ code: 'auth.invalidCode' });
    });

    it('returns no code for an unknown email and does not leak account existence', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: uniqueEmail('nobody') })
        .expect(202);

      expect(response.body).toEqual({ sent: true });
    });

    it('rejects an expired code', async () => {
      const { email } = await register();

      const requested = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email })
        .expect(202);

      await prisma.verificationCode.updateMany({
        where: { user: { email }, purpose: 'password_reset' },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const response = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ email, code: requested.body.devCode as string, newPassword: 'AnotherPass456' })
        .expect(400);
      expect(response.body).toMatchObject({ code: 'auth.codeExpired' });
    });

    it('limits wrong attempts and blocks code reuse', async () => {
      const { email } = await register();

      const requested = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email })
        .expect(202);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.getHttpServer())
          .post('/v1/auth/reset-password')
          .send({ email, code: '000000', newPassword: 'AnotherPass456' })
          .expect(400);
      }

      const blocked = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({ email, code: requested.body.devCode as string, newPassword: 'AnotherPass456' })
        .expect(429);
      expect(blocked.body).toMatchObject({ code: 'auth.tooManyAttempts' });
    });

    it('enforces the resend cooldown', async () => {
      const { email } = await register();

      await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email })
        .expect(202);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email })
        .expect(429);
      expect(response.body).toMatchObject({
        code: 'auth.codeCooldown',
        params: { retryAfterSeconds: expect.any(Number) },
      });
    });
  });
});
