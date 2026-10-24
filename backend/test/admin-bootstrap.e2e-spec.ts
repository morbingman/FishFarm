import request from 'supertest';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  ensureDefaultAdmin,
} from '../src/auth/default-admin.js';
import { createTestApp } from './test-app.js';

describe('Server-only default administrator', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  const testEmail = `bootstrap-${Date.now()}@example.com`;
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });
  it('creates one hashed Admin during startup and authenticates through the normal API', async () => {
    const saved = await prisma.user.findUniqueOrThrow({
      where: { email: DEFAULT_ADMIN_EMAIL },
    });
    expect(saved.role).toBe('Admin');
    expect(saved.passwordHash).not.toBe(DEFAULT_ADMIN_PASSWORD);
    expect(
      await argon2.verify(saved.passwordHash, DEFAULT_ADMIN_PASSWORD),
    ).toBe(true);
    await ensureDefaultAdmin(prisma);
    expect(
      await prisma.user.count({ where: { email: DEFAULT_ADMIN_EMAIL } }),
    ).toBe(1);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD })
      .expect(200);
    expect(login.body.user.role).toBe('Admin');
    expect(login.body.user).not.toHaveProperty('passwordHash');
    expect(login.body.user).not.toHaveProperty('password');
    const cookies = login.headers['set-cookie'] as unknown as string[];
    expect(
      cookies.some(
        (c) =>
          c.startsWith('fishfarm_refresh=') &&
          c.includes('Path=/;') &&
          c.includes('HttpOnly') &&
          !c.includes('Max-Age=0'),
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });
  it('preserves a changed password and existing user data on repeated bootstrap', async () => {
    await ensureDefaultAdmin(prisma, { email: testEmail });
    const changedHash = await argon2.hash('ChangedPassword456');
    await prisma.user.update({
      where: { email: testEmail },
      data: {
        passwordHash: changedHash,
        name: 'Keep this name',
        role: 'Buyer',
      },
    });
    await ensureDefaultAdmin(prisma, { email: testEmail });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: testEmail },
    });
    expect(user).toMatchObject({
      role: 'Admin',
      name: 'Keep this name',
      passwordHash: changedHash,
    });
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: testEmail, password: 'ChangedPassword456' })
      .expect(200);
    await ensureDefaultAdmin(prisma, { email: testEmail, resetPassword: true });
    const reset = await prisma.user.findUniqueOrThrow({
      where: { email: testEmail },
    });
    expect(
      await argon2.verify(reset.passwordHash, DEFAULT_ADMIN_PASSWORD),
    ).toBe(true);
    expect(
      await prisma.session.count({
        where: { userId: reset.id, revokedAt: null },
      }),
    ).toBe(0);
  });
  it('does not permit public registration of an Admin', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `public-admin-${Date.now()}@example.com`,
        password: 'SecurePass123',
        name: 'Public',
        role: 'Admin',
      })
      .expect(400);
  });
});
