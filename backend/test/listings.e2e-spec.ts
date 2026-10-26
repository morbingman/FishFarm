import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';
const COMPANY_ID = 'fishfarm';
const COMPANY_NAME = 'FishFarm';

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

describe('Company listing lifecycle (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let adminToken: string;
  let secondAdminToken: string;
  let userToken: string;
  let adminEmail: string;
  let secondAdminEmail: string;
  let userEmail: string;
  const createdCodes: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: COMPANY_NAME },
      update: {},
    });

    adminEmail = uniqueEmail('listing-admin');
    secondAdminEmail = uniqueEmail('listing-ops-admin');
    userEmail = uniqueEmail('listing-user');

    const user = await register(userEmail);
    userToken = user.accessToken;

    // Registration always creates a User; Admins are provisioned out of band.
    await register(adminEmail);
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'Admin' } });
    adminToken = (await login(adminEmail)).accessToken;

    await register(secondAdminEmail);
    await prisma.user.update({ where: { email: secondAdminEmail }, data: { role: 'Admin' } });
    secondAdminToken = (await login(secondAdminEmail)).accessToken;
  });

  afterAll(async () => {
    if (createdCodes.length > 0) {
      await prisma.listing.deleteMany({ where: { code: { in: createdCodes } } });
    }
    const users = await prisma.user.findMany({
      where: { email: { in: [adminEmail, secondAdminEmail, userEmail] } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);

    await prisma.activity.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({
      where: { OR: [
        { recipientId: { in: ids } },
        { link: { in: createdCodes.map((code) => `#admin/review/${code}`) } },
      ] },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  async function register(email: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: PASSWORD,
        name: `E2E ${email.split('@')[0]}`,
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

  async function createListing(
    token = adminToken,
    body: Record<string, unknown> = COMPLETE_DRAFT,
  ) {
    const response = await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set(auth(token))
      .send(body);
    expect(response.status).toBe(201);
    const listing = response.body as {
      id: string;
      status: string;
      company: { id: string; name: string };
      createdBy: string | null;
      draft: { images: unknown[] };
    };
    createdCodes.push(listing.id);
    return listing;
  }

  it('creates a draft in the shared company catalog', async () => {
    const listing = await createListing();
    expect(listing.id).toMatch(/^FM-\d+$/);
    expect(listing.status).toBe('draft');
    expect(listing.company).toMatchObject({ id: COMPANY_ID, name: COMPANY_NAME });
    expect(listing.createdBy).toBe(adminEmail);
    expect(listing.draft.images).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/v1/company/listings')
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.some((item: { id: string }) => item.id === listing.id)).toBe(true);
  });

  it('rejects publishing an incomplete draft', async () => {
    const listing = await createListing(adminToken, { name: 'Only a name' });
    const response = await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/publish`)
      .set(auth(adminToken));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'listing.incomplete',
      params: { field: 'species' },
    });
  });

  it('enforces pre-order deposit and ready-date rules', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set(auth(adminToken))
      .send({ ...COMPLETE_DRAFT, saleMode: 'pre_order', depositPct: 10 });

    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('listing.depositPct');

    const valid = await createListing(adminToken, {
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

  it('runs the optional internal review lifecycle', async () => {
    const listing = await createListing();
    expect(listing.status).toBe('draft');

    const submitted = await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/submit`)
      .set(auth(adminToken))
      .expect(200);
    expect(submitted.body.status).toBe('pending');
    expect(submitted.body.history.at(-1).action).toBe('Submitted for internal review');

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
      .set(auth(secondAdminToken))
      .send({ reason: 'Pricing concern', feedback: 'Please explain the price in the description.' })
      .expect(200);
    expect(changes.body).toMatchObject({
      status: 'changes',
      decision: { kind: 'changes', reason: 'Pricing concern', step: 1 },
    });

    const edited = await request(app.getHttpServer())
      .patch(`/v1/company/listings/${listing.id}`)
      .set(auth(adminToken))
      .send({ price: 1_150_000 })
      .expect(200);
    expect(edited.body.draft.price).toBe(1_150_000);

    const resubmitted = await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/submit`)
      .set(auth(adminToken))
      .expect(200);
    expect(resubmitted.body.status).toBe('pending');
    expect(resubmitted.body.decision).toBeNull();
    expect(resubmitted.body.history.at(-1).action).toBe('Resubmitted for internal review');

    const approved = await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/approve`)
      .set(auth(secondAdminToken))
      .expect(200);
    expect(approved.body.status).toBe('approved');
    expect(approved.body.decision).toBeNull();
  });

  it('publishes a draft directly to the catalog', async () => {
    const listing = await createListing();

    const published = await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/publish`)
      .set(auth(adminToken))
      .expect(200);

    expect(published.body.status).toBe('approved');
    expect(published.body.decision).toBeNull();
    expect(published.body.history.at(-1).action).toBe('Published');
  });

  it('keeps a live listing live when it is edited', async () => {
    const listing = await createListing();
    await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/publish`)
      .set(auth(adminToken))
      .expect(200);

    const edited = await request(app.getHttpServer())
      .patch(`/v1/company/listings/${listing.id}`)
      .set(auth(adminToken))
      .send({ price: 1_300_000 })
      .expect(200);

    expect(edited.body.status).toBe('approved');
    expect(edited.body.history.at(-1).action).toBe('Edited live listing');
  });

  it('supports pause, resume and takedown', async () => {
    const listing = await createListing();
    await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/publish`)
      .set(auth(adminToken))
      .expect(200);

    const paused = await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/pause`)
      .set(auth(adminToken))
      .expect(200);
    expect(paused.body.status).toBe('paused');

    const resumed = await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/resume`)
      .set(auth(adminToken))
      .expect(200);
    expect(resumed.body.status).toBe('approved');

    const takenDown = await request(app.getHttpServer())
      .post(`/v1/admin/listings/${listing.id}/takedown`)
      .set(auth(secondAdminToken))
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
      .post(`/v1/company/listings/${listing.id}/submit`)
      .set(auth(adminToken))
      .expect(200);

    const forbidden = await request(app.getHttpServer())
      .delete(`/v1/company/listings/${listing.id}`)
      .set(auth(adminToken));
    expect(forbidden.status).toBe(409);
    expect(forbidden.body.code).toBe('listing.deleteForbidden');

    const withdrawn = await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/withdraw`)
      .set(auth(adminToken))
      .expect(200);
    expect(withdrawn.body.status).toBe('draft');

    const deleted = await request(app.getHttpServer())
      .delete(`/v1/company/listings/${listing.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(deleted.body).toEqual({ id: listing.id, deleted: true });

    await request(app.getHttpServer())
      .get(`/v1/company/listings/${listing.id}`)
      .set(auth(adminToken))
      .expect(404);
  });

  it('shares company inventory across Admins and denies regular users', async () => {
    const listing = await createListing(adminToken);

    const visible = await request(app.getHttpServer())
      .get(`/v1/company/listings/${listing.id}`)
      .set(auth(secondAdminToken))
      .expect(200);
    expect(visible.body.createdBy).toBe(adminEmail);

    const edited = await request(app.getHttpServer())
      .patch(`/v1/company/listings/${listing.id}`)
      .set(auth(secondAdminToken))
      .send({ price: 1 })
      .expect(200);
    expect(edited.body.draft.price).toBe(1);

    await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/submit`)
      .set(auth(secondAdminToken))
      .expect(200);

    const pendingEdit = await request(app.getHttpServer())
      .patch(`/v1/company/listings/${listing.id}`)
      .set(auth(adminToken))
      .send({ price: 2 });
    expect(pendingEdit.status).toBe(409);
    expect(pendingEdit.body.code).toBe('listing.underReview');

    await request(app.getHttpServer())
      .get('/v1/company/listings')
      .set(auth(userToken))
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set(auth(userToken))
      .send(COMPLETE_DRAFT)
      .expect(403);

    await request(app.getHttpServer())
      .get('/v1/admin/listings')
      .set(auth(userToken))
      .expect(403);
  });

  it('records Admin activity and a review notification', async () => {
    const listing = await createListing();
    await request(app.getHttpServer())
      .post(`/v1/company/listings/${listing.id}/submit`)
      .set(auth(adminToken))
      .expect(200);

    const activity = await request(app.getHttpServer())
      .get('/v1/admin/activity?limit=50')
      .set(auth(adminToken))
      .expect(200);
    const entry = activity.body.find(
      (item: { action: string; target: string }) =>
        item.action === 'Submitted listing for review' && item.target === COMPLETE_DRAFT.name,
    );
    expect(entry).toMatchObject({ role: 'Admin' });

    const admins = await prisma.user.findMany({
      where: { email: { in: [adminEmail, secondAdminEmail] } },
      select: { id: true },
    });
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: { in: admins.map((admin) => admin.id) },
        titleKey: 'notifications.admin.listingSubmitted.title',
        link: `#admin/review/${listing.id}`,
      },
    });
    expect(notifications).toHaveLength(2);
    expect(notifications.every((notification) => notification.recipientRole === null)).toBe(true);
    await prisma.notification.update({ where: { id: notifications[0].id }, data: { readAt: new Date() } });
    const other = await prisma.notification.findUniqueOrThrow({ where: { id: notifications[1].id } });
    expect(other.readAt).toBeNull();
  });
});
