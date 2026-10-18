import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';

function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.floor(Math.random() * 10_000)}@example.com`;
}

const COMPLETE_DRAFT = {
  name: 'E2E Kohaku Koi',
  species: 'Koi',
  breed: 'Kohaku',
  description: 'Healthy koi raised in clean water and fed a premium diet every day.',
  ageMonths: 14,
  sizeCm: 38,
  gender: 'Female',
  origin: 'Niigata, Japan',
  health: 'Excellent — vet certified',
  price: 1_250_000,
  quantity: 2,
  negotiable: true,
  location: '128 Nguyen Van Huong, Thao Dien',
  region: 'Ho Chi Minh City',
  shipping: ['Local pickup', 'Domestic overnight'],
  images: [{ url: 'https://images.example.com/koi.jpg', isMain: true }],
};

describe('Listing lifecycle (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let sellerToken: string;
  let otherSellerToken: string;
  let adminToken: string;
  let buyerToken: string;
  let sellerEmail: string;
  let otherSellerEmail: string;
  let adminEmail: string;
  let buyerEmail: string;
  const startedAt = new Date();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    sellerEmail = uniqueEmail('listing-seller');
    otherSellerEmail = uniqueEmail('listing-other-seller');
    adminEmail = uniqueEmail('listing-admin');
    buyerEmail = uniqueEmail('listing-buyer');

    const seller = await register(sellerEmail, 'Seller');
    sellerToken = seller.accessToken;
    const otherSeller = await register(otherSellerEmail, 'Seller');
    otherSellerToken = otherSeller.accessToken;
    const buyer = await register(buyerEmail, 'Buyer');
    buyerToken = buyer.accessToken;

    const admin = await register(adminEmail, 'Seller');
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'Admin' } });
    adminToken = await login(adminEmail).then((result) => result.accessToken);
    void admin;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [sellerEmail, otherSellerEmail, adminEmail, buyerEmail] } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);

    await prisma.listing.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.activity.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { recipientId: { in: ids } },
          { recipientRole: 'Admin', createdAt: { gte: startedAt } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  async function register(email: string, role: 'Buyer' | 'Seller') {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: PASSWORD,
        name: `E2E ${role}`,
        role,
        ...(role === 'Seller' ? { store: 'E2E Aquatic Farm' } : {}),
      });
    expect(response.status).toBe(201);
    return response.body as { accessToken: string; user: { id: string; email: string } };
  }

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response.body as { accessToken: string };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createListing(token = sellerToken, body: Record<string, unknown> = COMPLETE_DRAFT) {
    const response = await request(app.getHttpServer())
      .post('/v1/seller/listings')
      .set(auth(token))
      .send(body);
    expect(response.status).toBe(201);
    return response.body as { id: string; status: string; draft: { images: unknown[] } };
  }

  it('creates a draft and assigns a human-readable code', async () => {
    const listing = await createListing();
    expect(listing.id).toMatch(/^FM-\d+$/);
    expect(listing.status).toBe('draft');
    expect(listing.draft.images).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/v1/seller/listings')
      .set(auth(sellerToken))
      .expect(200);
    expect(list.body.some((item: { id: string }) => item.id === listing.id)).toBe(true);
  });

  it('rejects submitting an incomplete draft', async () => {
    const listing = await createListing(sellerToken, { name: 'Only a name' });
    const response = await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'listing.incomplete',
      params: { field: 'species' },
    });
  });

  it('enforces pre-order deposit and ready-date rules', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/v1/seller/listings')
      .set(auth(sellerToken))
      .send({ ...COMPLETE_DRAFT, saleMode: 'pre_order', depositPct: 10 });

    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('listing.depositPct');

    const valid = await createListing(sellerToken, {
      ...COMPLETE_DRAFT,
      saleMode: 'pre_order',
      depositPct: 25,
      expectedReadyDate: '2027-01-15T00:00:00.000Z',
      preorderPolicy: 'Deposit refunded if the balance is missed.',
    });
    expect(valid).toMatchObject({
      draft: {
        saleMode: 'pre_order',
        depositPct: 25,
      },
    });
  });

  it('runs the full submit → changes → resubmit → approve lifecycle', async () => {
    const listing = await createListing();

    const submitted = await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken))
      .expect(200);
    expect(submitted.body.status).toBe('pending');
    expect(submitted.body.history.at(-1).action).toBe('Submitted for review');

    const queue = await request(app.getHttpServer())
      .get('/v1/admin/listings?tab=pending')
      .set(auth(adminToken))
      .expect(200);
    expect(queue.body.some((item: { id: string }) => item.id === listing.id)).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/v1/admin/listings/${listing.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.checks.every((check: { ok: boolean }) => check.ok)).toBe(true);

    const tooShort = await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/request-changes`)
      .set(auth(adminToken))
      .send({ reason: 'Pricing concern', feedback: 'short' })
      .expect(400);
    expect(tooShort.body.code).toBe('validation.failed');

    const changes = await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/request-changes`)
      .set(auth(adminToken))
      .send({ reason: 'Pricing concern', feedback: 'Please explain the price in the description.' })
      .expect(200);
    expect(changes.body).toMatchObject({
      status: 'changes',
      decision: { kind: 'changes', reason: 'Pricing concern', step: 1 },
    });

    const edited = await request(app.getHttpServer())
      .patch(`/v1/seller/listings/${listing.id}`)
      .set(auth(sellerToken))
      .send({ price: 1_150_000 })
      .expect(200);
    expect(edited.body.draft.price).toBe(1_150_000);

    const resubmitted = await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken))
      .expect(200);
    expect(resubmitted.body.status).toBe('pending');
    expect(resubmitted.body.decision).toBeNull();
    expect(resubmitted.body.history.at(-1).action).toBe('Resubmitted for review');

    const approved = await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/approve`)
      .set(auth(adminToken))
      .expect(200);
    expect(approved.body.status).toBe('approved');
    expect(approved.body.decision).toBeNull();
  });

  it('sends an edited live listing back to review', async () => {
    const listing = await createListing();
    await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/approve`)
      .set(auth(adminToken))
      .expect(200);

    const edited = await request(app.getHttpServer())
      .patch(`/v1/seller/listings/${listing.id}`)
      .set(auth(sellerToken))
      .send({ price: 1_300_000 })
      .expect(200);

    expect(edited.body.status).toBe('pending');
    expect(edited.body.submittedAt).toBeTruthy();
    expect(edited.body.history.at(-1).action).toBe('Edited — resubmitted for review');
  });

  it('supports pause, resume and admin takedown', async () => {
    const listing = await createListing();
    await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/approve`)
      .set(auth(adminToken))
      .expect(200);

    const paused = await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/pause`)
      .set(auth(sellerToken))
      .expect(200);
    expect(paused.body.status).toBe('paused');

    const resumed = await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/resume`)
      .set(auth(sellerToken))
      .expect(200);
    expect(resumed.body.status).toBe('approved');

    const takenDown = await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/takedown`)
      .set(auth(adminToken))
      .send({ reason: 'Policy violation: prohibited species.' })
      .expect(200);
    expect(takenDown.body).toMatchObject({
      status: 'rejected',
      decision: { kind: 'rejected', reason: 'Policy violation' },
    });
  });

  it('restricts deletes and withdraws pending listings', async () => {
    const listing = await createListing();
    await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken))
      .expect(200);

    const forbidden = await request(app.getHttpServer())
      .delete(`/v1/seller/listings/${listing.id}`)
      .set(auth(sellerToken));
    expect(forbidden.status).toBe(409);
    expect(forbidden.body.code).toBe('listing.deleteForbidden');

    const withdrawn = await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/withdraw`)
      .set(auth(sellerToken))
      .expect(200);
    expect(withdrawn.body.status).toBe('draft');

    const deleted = await request(app.getHttpServer())
      .delete(`/v1/seller/listings/${listing.id}`)
      .set(auth(sellerToken))
      .expect(200);
    expect(deleted.body).toEqual({ id: listing.id, deleted: true });

    await request(app.getHttpServer())
      .get(`/v1/seller/listings/${listing.id}`)
      .set(auth(sellerToken))
      .expect(404);
  });

  it('scopes seller access and permissions', async () => {
    const listing = await createListing();

    await request(app.getHttpServer())
      .get(`/v1/seller/listings/${listing.id}`)
      .set(auth(otherSellerToken))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/v1/seller/listings/${listing.id}`)
      .set(auth(sellerToken))
      .send({ price: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken))
      .expect(200);

    const pendingEdit = await request(app.getHttpServer())
      .patch(`/v1/seller/listings/${listing.id}`)
      .set(auth(sellerToken))
      .send({ price: 2 });
    expect(pendingEdit.status).toBe(409);
    expect(pendingEdit.body.code).toBe('listing.underReview');

    await request(app.getHttpServer())
      .get('/v1/seller/listings')
      .set(auth(buyerToken))
      .expect(403);

    await request(app.getHttpServer())
      .get('/v1/admin/listings')
      .set(auth(sellerToken))
      .expect(403);
  });

  it('records activity and notifications for lifecycle events', async () => {
    const listing = await createListing();
    await request(app.getHttpServer())
      .post(`/v1/seller/listings/${listing.id}/submit`)
      .set(auth(sellerToken))
      .expect(200);

    const activity = await request(app.getHttpServer())
      .get('/v1/admin/activity?limit=50')
      .set(auth(adminToken))
      .expect(200);
    expect(
      activity.body.some(
        (entry: { action: string; target: string }) =>
          entry.action === 'Submitted listing for review' && entry.target === COMPLETE_DRAFT.name,
      ),
    ).toBe(true);

    const seller = await prisma.user.findUniqueOrThrow({ where: { email: sellerEmail } });
    const sellerNotification = await prisma.notification.findFirst({
      where: { recipientId: seller.id, titleKey: 'notifications.listing.submitted.title' },
    });
    expect(sellerNotification).toBeTruthy();

    const adminNotification = await prisma.notification.findFirst({
      where: {
        recipientRole: 'Admin',
        titleKey: 'notifications.admin.listingSubmitted.title',
        createdAt: { gte: startedAt },
      },
    });
    expect(adminNotification).toBeTruthy();
  });
});
