import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';
const STORE = `E2E Market Farm ${Date.now()}`;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

describe('Marketplace read (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let sellerId: string;
  let sellerEmail: string;
  let sequence = 0;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    sellerEmail = `market.seller.${Date.now()}@example.com`;
    const registration = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: sellerEmail,
        password: PASSWORD,
        name: 'E2E Market Seller',
        role: 'Seller',
        store: STORE,
      });
    expect(registration.status).toBe(201);
    sellerId = registration.body.user.id as string;

    await createListing('Kohaku Koi', {
      species: 'Koi',
      breed: 'Kohaku',
      sizeCm: 38,
      price: 1_250_000,
      region: 'Ho Chi Minh City',
      quantity: 2,
      views: 10,
      createdAt: daysAgo(2),
    });
    await createListing('Halfmoon Betta', {
      species: 'Betta',
      breed: 'Halfmoon',
      sizeCm: 6,
      price: 380_000,
      region: 'Hanoi',
      quantity: 5,
      views: 50,
      createdAt: daysAgo(10),
    });
    await createListing('Ogon Koi', {
      species: 'Koi',
      breed: 'Ogon',
      sizeCm: 20,
      price: 2_000_000,
      region: 'Ho Chi Minh City',
      quantity: 1,
      views: 5,
      createdAt: daysAgo(1),
    });
    await createListing('Oranda Goldfish', {
      species: 'Goldfish',
      breed: 'Oranda',
      sizeCm: 12,
      price: 950_000,
      region: 'Da Nang',
      quantity: 0,
      createdAt: daysAgo(20),
    });
    await createListing('Pending Fish', {
      species: 'Koi',
      breed: 'Show',
      sizeCm: 30,
      price: 500_000,
      region: 'Hanoi',
      createdAt: daysAgo(0),
      status: 'pending',
    });
    const deleted = await createListing('Deleted Fish', {
      species: 'Koi',
      breed: 'Kohaku',
      sizeCm: 25,
      price: 700_000,
      region: 'Hanoi',
      createdAt: daysAgo(0),
    });
    await prisma.listing.update({
      where: { id: deleted.id },
      data: { deletedAt: new Date() },
    });
  });

  afterAll(async () => {
    if (sellerId) {
      await prisma.listing.deleteMany({ where: { ownerId: sellerId } });
      await prisma.user.deleteMany({ where: { id: sellerId } });
    }
    await app.close();
  });

  async function createListing(
    name: string,
    overrides: {
      species: string;
      breed: string;
      sizeCm: number;
      price: number;
      region: string;
      quantity?: number;
      views?: number;
      createdAt?: Date;
      status?: 'approved' | 'pending';
    },
  ) {
    sequence += 1;
    return prisma.listing.create({
      data: {
        code: `FM-9${String(Date.now()).slice(-6)}${sequence}`,
        ownerId: sellerId,
        sellerName: STORE,
        status: overrides.status ?? 'approved',
        views: overrides.views ?? 0,
        createdAt: overrides.createdAt,
        submittedAt: daysAgo(1),
        draft: {
          create: {
            name,
            species: overrides.species,
            breed: overrides.breed,
            description: 'Healthy fish raised in clean water and fed a premium diet.',
            ageMonths: 12,
            sizeCm: overrides.sizeCm,
            gender: 'Unsexed',
            origin: 'Vietnam — farm bred',
            health: 'Good — quarantined 14 days',
            price: overrides.price,
            quantity: overrides.quantity ?? 1,
            location: 'Farm gate',
            region: overrides.region,
            shipping: ['Local pickup'],
            images: {
              create: [
                {
                  url: `https://images.example.com/${name.replace(/\s+/g, '-').toLowerCase()}.jpg`,
                  position: 0,
                  isMain: true,
                },
              ],
            },
          },
        },
      },
    });
  }

  function path(query: string) {
    return `/v1/marketplace/listings?q=${encodeURIComponent(STORE)}&${query}`;
  }

  it('lists approved listings publicly and hides pending/deleted ones', async () => {
    const response = await request(app.getHttpServer()).get(path('available=false')).expect(200);

    expect(response.body).toMatchObject({ page: 1, pageSize: 20 });
    expect(response.body.total).toBe(4);
    const names = response.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(
      expect.arrayContaining(['Kohaku Koi', 'Halfmoon Betta', 'Ogon Koi', 'Oranda Goldfish']),
    );
    expect(names).not.toContain('Pending Fish');
    expect(names).not.toContain('Deleted Fish');

    const first = response.body.items[0];
    expect(first).toMatchObject({
      species: expect.any(String),
      price: expect.any(Number),
      seller: { name: STORE },
    });
    expect(first.name).toBeTruthy();
    expect(first.image).toContain('https://images.example.com/');
  });

  it('filters by search text, species, breed, price, size and location', async () => {
    const species = await request(app.getHttpServer())
      .get(`/v1/marketplace/listings?q=${encodeURIComponent(STORE)}&species=Koi,Betta&available=false`)
      .expect(200);
    expect(species.body.total).toBe(3);

    const breed = await request(app.getHttpServer()).get(path('breed=Ogon')).expect(200);
    expect(breed.body.items.map((item: { name: string }) => item.name)).toEqual(['Ogon Koi']);

    const price = await request(app.getHttpServer()).get(path('priceMax=500000')).expect(200);
    expect(price.body.items.map((item: { name: string }) => item.name)).toEqual(['Halfmoon Betta']);

    const under = await request(app.getHttpServer()).get(path('size=under15')).expect(200);
    expect(under.body.items.map((item: { name: string }) => item.name)).toEqual(['Halfmoon Betta']);

    const above = await request(app.getHttpServer()).get(path('size=15plus')).expect(200);
    expect(above.body.total).toBe(2);

    const location = await request(app.getHttpServer()).get(path('location=Hanoi')).expect(200);
    expect(location.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Halfmoon Betta',
    ]);
  });

  it('respects the availability filter', async () => {
    const inStock = await request(app.getHttpServer()).get(path('')).expect(200);
    expect(inStock.body.total).toBe(3);
    expect(inStock.body.items.map((item: { name: string }) => item.name)).not.toContain(
      'Oranda Goldfish',
    );

    const all = await request(app.getHttpServer()).get(path('available=false')).expect(200);
    expect(all.body.total).toBe(4);
    expect(all.body.items.map((item: { name: string }) => item.name)).toContain(
      'Oranda Goldfish',
    );
  });

  it('sorts and paginates', async () => {
    const asc = await request(app.getHttpServer())
      .get(path('available=false&sort=price_asc'))
      .expect(200);
    expect(asc.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Halfmoon Betta',
      'Oranda Goldfish',
      'Kohaku Koi',
      'Ogon Koi',
    ]);

    const desc = await request(app.getHttpServer())
      .get(path('available=false&sort=price_desc'))
      .expect(200);
    expect(desc.body.items[0].name).toBe('Ogon Koi');

    const newest = await request(app.getHttpServer())
      .get(path('available=false&sort=newest'))
      .expect(200);
    expect(newest.body.items[0].name).toBe('Ogon Koi');

    const secondPage = await request(app.getHttpServer())
      .get(path('available=false&sort=price_asc&page=2&pageSize=2'))
      .expect(200);
    expect(secondPage.body).toMatchObject({ page: 2, pageSize: 2, total: 4, totalPages: 2 });
    expect(secondPage.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Kohaku Koi',
      'Ogon Koi',
    ]);
  });

  it('returns one approved listing with the product projection, and 404 otherwise', async () => {
    const list = await request(app.getHttpServer()).get(path('breed=Ogon')).expect(200);
    const id = list.body.items[0].id as string;

    const detail = await request(app.getHttpServer())
      .get(`/v1/marketplace/listings/${id}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      id,
      name: 'Ogon Koi',
      species: 'Koi',
      breed: 'Ogon',
      sizeCm: 20,
      price: 2_000_000,
      region: 'Ho Chi Minh City',
      saleMode: 'in_stock',
      label: expect.any(String),
      seller: { name: STORE, rating: null, reviewCount: 0 },
    });
    expect(detail.body.images).toHaveLength(1);

    const pending = await prisma.listing.findFirstOrThrow({
      where: { ownerId: sellerId, status: 'pending' },
    });
    await request(app.getHttpServer())
      .get(`/v1/marketplace/listings/${pending.code}`)
      .expect(404);

    await request(app.getHttpServer()).get('/v1/marketplace/listings/FM-00000').expect(404);
  });

  it('returns a public seller page with only approved listings', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/marketplace/sellers/${encodeURIComponent(STORE)}`)
      .expect(200);

    expect(response.body.seller).toMatchObject({
      name: STORE,
      ownerName: 'E2E Market Seller',
      rating: null,
      reviewCount: 0,
    });
    expect(response.body.listings.total).toBe(4);
    expect(
      response.body.listings.items.map((item: { name: string }) => item.name),
    ).not.toContain('Pending Fish');
    expect(
      response.body.listings.items.map((item: { name: string }) => item.name),
    ).not.toContain('Deleted Fish');

    await request(app.getHttpServer())
      .get(`/v1/marketplace/sellers/${encodeURIComponent('No Such Farm')}`)
      .expect(404);
  });

  it('validates marketplace query parameters', async () => {
    await request(app.getHttpServer())
      .get('/v1/marketplace/listings?sellerRating=9')
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/marketplace/listings?sort=not-a-sort')
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/marketplace/listings?pageSize=500')
      .expect(400);
  });
});
