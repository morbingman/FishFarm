import request from 'supertest';
import { createTestApp } from './test-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Public catalogue', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  const ids: string[] = [];
  beforeAll(async () => { app = await createTestApp(); prisma = app.get(PrismaService); });
  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { action: 'Created listing', target: { startsWith: 'PUBLIC-E2E-' } } });
    await prisma.listing.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });
  it('shows newly published Admin fish without a token and hides paused listings', async () => {
    const login = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'admin@fish.com', password: '12345' }).expect(200);
    const body = {
      name: `PUBLIC-E2E-${Date.now()}`, species: 'Koi', breed: 'Kohaku', description: 'Healthy koi fish for the public catalogue test.',
      ageMonths: 6, sizeCm: 20, gender: 'Unknown', origin: 'Japan', health: 'Healthy', price: 350000, quantity: 3,
      location: 'Da Nang', region: 'Da Nang', shipping: ['Delivery'], images: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isMain: true }], publish: true,
    };
    const created = await request(app.getHttpServer()).post('/v1/admin/listings').set('Authorization', `Bearer ${login.body.accessToken}`).send(body).expect(201);
    ids.push(created.body.id);
    const code = created.body.code;
    const home = await request(app.getHttpServer()).get('/v1/marketplace/home').expect(200);
    expect(home.body.featured.some((x: any) => x.id === code)).toBe(true);
    const list = await request(app.getHttpServer()).get('/v1/marketplace/listings').expect(200);
    expect(list.body.items.some((x: any) => x.id === code)).toBe(true);
    const detail = await request(app.getHttpServer()).get(`/v1/marketplace/listings/${code}`).expect(200);
    expect(detail.body.name).toBe(body.name);
    expect(JSON.stringify(detail.body)).not.toContain('passwordHash');
    expect(JSON.stringify(detail.body)).not.toContain('admin@fish.com');
    await prisma.listing.update({ where: { id: created.body.id }, data: { status: 'paused' } });
    await request(app.getHttpServer()).get(`/v1/marketplace/listings/${code}`).expect(404);
    const paused = await request(app.getHttpServer()).get('/v1/marketplace/listings').expect(200);
    expect(paused.body.items.some((x: any) => x.id === code)).toBe(false);
  });
  it('keeps personal and Admin operations protected', async () => {
    for (const path of ['/v1/admin/listings', '/v1/admin/users', '/v1/me/cart', '/v1/me/favorites']) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
    await request(app.getHttpServer()).post('/v1/orders').send({}).expect(401);
  });
});
