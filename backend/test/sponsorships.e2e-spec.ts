import request from 'supertest';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resolvePrivateUploadDir } from '../src/uploads/upload.config.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';
const COMPANY_ID = 'fishfarm';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function email(label: string) {
  return `${label}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
}

describe('Batch sponsorship (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let secondUserToken: string;
  let adminId: string;
  let userId: string;
  let _secondUserId: string;
  let facilityId: string;
  let batchCode: string;

  const marker = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const userIds: string[] = [];
  const facilityIds: string[] = [];
  const batchCodes: string[] = [];
  const uploadIds: string[] = [];
  const privateFiles: string[] = [];

  const future = () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'FishFarm' },
      update: {},
    });

    ({ id: adminId } = await register('sponsor-admin'));
    ({ id: userId, token: userToken } = await register('sponsor-user'));
    ({ id: _secondUserId, token: secondUserToken } = await register('sponsor-second-user'));
    await prisma.user.update({ where: { id: adminId }, data: { role: 'Admin' } });
    adminToken = await login(adminId);

    const facility = await request(app.getHttpServer())
      .post('/v1/company/facilities')
      .set(auth(adminToken))
      .send({
        name: `Sponsor facility ${marker}`,
        location: 'Can Tho aquaculture zone',
        region: 'Mekong Delta',
      })
      .expect(201);
    facilityId = facility.body.id as string;
    facilityIds.push(facilityId);
    const upload = await request(app.getHttpServer())
      .post('/v1/uploads')
      .set(auth(adminToken))
      .field('purpose', 'farm_document')
      .attach('file', PNG, { filename: 'compliance.png', contentType: 'image/png' })
      .expect(201);
    uploadIds.push(upload.body.id as string);
    privateFiles.push(upload.body.url as string);
    await request(app.getHttpServer())
      .post(`/v1/company/facilities/${facilityId}/verification`)
      .set(auth(adminToken))
      .send({
        level: 'inspected',
        inspectedAt: new Date().toISOString(),
        inspector: 'Company compliance team',
        notes: 'Sponsorship e2e evidence.',
        documents: [{ type: 'business_registration', uploadId: upload.body.id }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/admin/facilities/${facilityId}/inspect`)
      .set(auth(adminToken))
      .send({
        status: 'approved',
        level: 'inspected',
        inspectedAt: new Date().toISOString(),
        inspector: 'Company compliance team',
        notes: 'Sponsorship e2e evidence.',
        validUntil: future(),
      })
      .expect(200);

    const batch = await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send({
        title: `Sponsor tilapia batch ${marker}`,
        species: 'Tilapia',
        breed: 'Nile tilapia',
        description: 'A fully managed grow-out batch with feed, care and delivery included.',
        location: 'Can Tho aquaculture zone',
        region: 'Mekong Delta',
        stockingDate: new Date().toISOString(),
        expectedHarvestDate: future(),
        stockCount: 100,
        shareUnitType: 'count',
        shareQuantity: 5,
        packagePricePerShare: 100000,
        contingencyPct: 10,
        riskDisclosure: 'Fish health and harvest timing may vary because aquaculture has biological risks.',
        termsVersion: '2026-10',
        facilityId,
        images: [{ url: `https://images.example.com/${marker}/sponsor.jpg` }],
        costs: [
          { category: 'equipment', label: 'Equipment allocation', amount: 1000000, allocation: 'batch_total' },
          { category: 'feed', label: 'Feed and care', amount: 50000, allocation: 'per_share' },
        ],
      })
      .expect(201);
    batchCode = batch.body.id as string;
    batchCodes.push(batchCode);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/publish`)
      .set(auth(adminToken))
      .expect(200);
  });

  afterAll(async () => {
    if (batchCodes.length) {
      // Disputes reference sponsorships (Restrict); attachments cascade with them.
      await prisma.dispute.deleteMany({ where: { sponsorship: { batch: { code: { in: batchCodes } } } } });
      await prisma.adjustment.deleteMany({ where: { sponsorship: { batch: { code: { in: batchCodes } } } } });
      await prisma.sponsorship.deleteMany({ where: { batch: { code: { in: batchCodes } } } });
      await prisma.growOutBatch.deleteMany({ where: { code: { in: batchCodes } } });
    }
    if (facilityIds.length) {
      await prisma.facility.deleteMany({ where: { id: { in: facilityIds } } });
    }
    if (uploadIds.length) {
      await prisma.upload.deleteMany({ where: { id: { in: uploadIds } } });
    }
    await prisma.activity.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await Promise.all(
      privateFiles.map((url) =>
        unlink(join(resolvePrivateUploadDir(process.env.UPLOAD_DIR), basename(url))).catch(
          () => undefined,
        ),
      ),
    );
    await app.close();
  });

  async function register(label: string) {
    const address = email(`${label}-${marker}`);
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: address, password: PASSWORD, name: label })
      .expect(201);
    const result = {
      id: response.body.user.id as string,
      token: response.body.accessToken as string,
    };
    userIds.push(result.id);
    return result;
  }

  async function login(id: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { email: true } });
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function reservation(overrides: Record<string, unknown> = {}) {
    return {
      shares: 2,
      recipientName: 'Sponsor User',
      phone: '0900000000',
      address: '12 Hai Ba Trung',
      city: 'Can Tho',
      province: 'Can Tho',
      deliveryMethod: 'cold_chain',
      ...overrides,
    };
  }

  it('forbids sponsorship for Admins, guests and non-open batches', async () => {
    await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(adminToken))
      .send(reservation())
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .send(reservation())
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/batches/BATCH-999999/sponsorships')
      .set(auth(userToken))
      .send(reservation())
      .expect(404);
  });

  it('rejects invalid reservations before touching shares', async () => {
    await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 0 }))
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ recipientName: '  ' }))
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 999 }))
      .expect(409);

    const batch = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(batch.sharesAvailable).toBe(batch.totalShares);
  });

  let sponsorshipId: string;

  it('reserves shares atomically, snapshots terms and notifies the company', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(userToken))
      .send(reservation())
      .expect(201);
    sponsorshipId = response.body.id as string;
    expect(response.body.status).toBe('pending_payment');
    expect(response.body.shares).toBe(2);
    expect(response.body.packageAmount).toBe(200000);
    expect(response.body.totalAmount).toBe(200000);
    expect(response.body.paidAt).toBeNull();
    expect(response.body.termsSnapshot.termsVersion).toBe('2026-10');
    expect(response.body.termsSnapshot.packagePricePerShare).toBe(100000);
    expect(Array.isArray(response.body.termsSnapshot.costs)).toBe(true);

    const batch = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(batch.sharesAvailable).toBe(batch.totalShares - 2);
    expect(batch.status).toBe('open');

    const activity = await prisma.activity.findFirst({
      where: { actorId: userId, target: batchCode },
    });
    expect(activity?.action).toContain('Reserved');

    const inbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(adminToken))
      .expect(200);
    expect(JSON.stringify(inbox.body)).toContain('sponsorshipReserved');
  });

  it('rejects payment by other users and pays the full package once with 30/40/30 escrow', async () => {
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay`)
      .set(auth(secondUserToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(403);

    const response = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet', idempotencyKey: `pay-${marker}` })
      .expect(200);
    expect(response.body.status).toBe('funded');
    expect(typeof response.body.paidAt).toBe('string');
    expect(response.body.payments).toHaveLength(1);
    expect(response.body.payments[0].amount).toBe(200000);
    expect(response.body.payments[0].purpose).toBe('sponsorship_package');

    const escrow = await request(app.getHttpServer())
      .get(`/v1/sponsorships/${sponsorshipId}/escrow`)
      .set(auth(userToken))
      .expect(200);
    const byMilestone = new Map(
      (escrow.body.tranches as Array<{ milestone: string; amount: number; state: string }>).map(
        (tranche) => [tranche.milestone, tranche],
      ),
    );
    expect(byMilestone.get('stocking')).toMatchObject({ amount: 60000, state: 'held' });
    expect(byMilestone.get('mid_growth')).toMatchObject({ amount: 80000, state: 'held' });
    expect(byMilestone.get('harvest')).toMatchObject({ amount: 60000, state: 'held' });
    expect(escrow.body.held).toBe(200000);
    expect(escrow.body.released).toBe(0);

    // Idempotent replay returns the same funded sponsorship without a second payment.
    const replay = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'bank_card', idempotencyKey: `pay-${marker}` })
      .expect(200);
    expect(replay.body.id).toBe(sponsorshipId);
    expect(replay.body.payments).toHaveLength(1);
    const record = await prisma.payment.count({ where: { sponsorshipId } });
    expect(record).toBe(1);

    const secondPay = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(409);
    expect(secondPay.body.code).toBe('sponsorship.invalidTransition');
  });

  it('hides other users’ sponsorships and company views from Users', async () => {
    await request(app.getHttpServer())
      .get(`/v1/sponsorships/${sponsorshipId}`)
      .set(auth(secondUserToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/v1/sponsorships/${sponsorshipId}/escrow`)
      .set(auth(secondUserToken))
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/company/sponsorships')
      .set(auth(userToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/v1/company/batches/${batchCode}/sponsors`)
      .set(auth(userToken))
      .expect(403);

    const mine = await request(app.getHttpServer())
      .get('/v1/me/sponsorships')
      .set(auth(userToken))
      .expect(200);
    expect(mine.body.total).toBe(1);
    expect(mine.body.items[0].id).toBe(sponsorshipId);

    const sponsors = await request(app.getHttpServer())
      .get(`/v1/company/batches/${batchCode}/sponsors`)
      .set(auth(adminToken))
      .expect(200);
    expect(sponsors.body.items).toHaveLength(1);
    expect(sponsors.body.items[0].sponsor.id).toBe(userId);
  });

  it('cancels a funded reservation with a full escrow reversal and share restore', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/cancel`)
      .set(auth(userToken))
      .send({ reason: 'Changed plans before stocking' })
      .expect(200);
    expect(response.body.status).toBe('refunded');
    expect(typeof response.body.cancelledAt).toBe('string');
    expect(typeof response.body.refundedAt).toBe('string');

    const payment = await prisma.payment.findFirstOrThrow({ where: { sponsorshipId } });
    expect(payment.state).toBe('refunded');
    const tranches = await prisma.escrowRelease.findMany({ where: { sponsorshipId } });
    expect(tranches.every((tranche) => tranche.state === 'reversed')).toBe(true);
    const adjustment = await prisma.adjustment.findFirstOrThrow({ where: { sponsorshipId } });
    expect(adjustment.kind).toBe('refund');
    expect(adjustment.amount).toBe(200000);

    const batch = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(batch.sharesAvailable).toBe(batch.totalShares);
    expect(batch.status).toBe('open');

    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/cancel`)
      .set(auth(userToken))
      .send({})
      .expect(409);
  });

  it('cancels an unpaid reservation as cancelled and re-opens a fully sponsored batch', async () => {
    // The published batch has 20 shares total (100 fish / 5 per share).
    const first = await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 20 }))
      .expect(201);

    const full = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(full.sharesAvailable).toBe(0);
    expect(full.status).toBe('fully_sponsored');
    await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(secondUserToken))
      .send(reservation())
      .expect(409);

    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${first.body.id}/cancel`)
      .set(auth(secondUserToken))
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${first.body.id}/cancel`)
      .set(auth(userToken))
      .send({})
      .expect(200);
    const restored = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(restored.status).toBe('open');
    expect(restored.sharesAvailable).toBe(20);

    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${first.body.id}/cancel`)
      .set(auth(userToken))
      .send({})
      .expect(409);
  });

  let growSponsorshipId: string;
  let secondGrowSponsorshipId: string;

  it('forbids growing and harvesting to non-Admins and invalid states', async () => {
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/grow`)
      .set(auth(userToken))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/grow`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/harvest`)
      .set(auth(adminToken))
      .send({ actualCount: 100 })
      .expect(409);
    await request(app.getHttpServer())
      .post('/v1/company/batches/BATCH-999999/grow')
      .set(auth(adminToken))
      .expect(404);
  });

  it('grows the batch, releases stocking escrow and moves funded sponsorships to growing', async () => {
    const first = await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 4 }))
      .expect(201);
    growSponsorshipId = first.body.id as string;
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${growSponsorshipId}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'bank_card' })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post(`/v1/batches/${batchCode}/sponsorships`)
      .set(auth(secondUserToken))
      .send(reservation({ shares: 2 }))
      .expect(201);
    secondGrowSponsorshipId = second.body.id as string;
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${secondGrowSponsorshipId}/pay`)
      .set(auth(secondUserToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/grow`)
      .set(auth(adminToken))
      .expect(200);
    expect(response.body.status).toBe('growing');

    const batch = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(batch.status).toBe('growing');
    for (const id of [growSponsorshipId, secondGrowSponsorshipId]) {
      const record = await prisma.sponsorship.findUniqueOrThrow({ where: { id } });
      expect(record.status).toBe('growing');
      expect(record.growingAt).not.toBeNull();
      const stocking = await prisma.escrowRelease.findFirstOrThrow({
        where: { sponsorshipId: id, milestone: 'stocking' },
      });
      expect(stocking.state).toBe('released');
      expect(stocking.releasedAt).not.toBeNull();
    }

    const escrow = await request(app.getHttpServer())
      .get(`/v1/sponsorships/${growSponsorshipId}/escrow`)
      .set(auth(userToken))
      .expect(200);
    expect(escrow.body.released).toBe(120000); // 30% of 400000
    expect(escrow.body.held).toBe(280000);

    const repeat = await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/grow`)
      .set(auth(adminToken))
      .expect(409);
    expect(repeat.body.code).toBe('sponsorship.invalidTransition');
  });

  it('publishes the harvest, releases mid-growth escrow and refunds shortfall pro-rata', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/harvest`)
      .set(auth(adminToken))
      .send({ actualCount: 90 })
      .expect(200);
    expect(response.body.batch.status).toBe('harvested');
    expect(response.body.harvest.actualCount).toBe(90);
    expect(response.body.harvest.mortalityRateBps).toBe(1000);
    expect(response.body.harvest.yieldPerShare).toBe('4.50 fish');
    expect(response.body.harvest.status).toBe('published');

    const batch = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(batch.status).toBe('harvested');

    for (const [id, packageAmount] of [
      [growSponsorshipId, 400000],
      [secondGrowSponsorshipId, 200000],
    ] as const) {
      const record = await prisma.sponsorship.findUniqueOrThrow({ where: { id } });
      expect(record.status).toBe('ready_for_delivery');
      expect(record.readyAt).not.toBeNull();
      const midGrowth = await prisma.escrowRelease.findFirstOrThrow({
        where: { sponsorshipId: id, milestone: 'mid_growth' },
      });
      expect(midGrowth.state).toBe('released');
      const harvestTranche = await prisma.escrowRelease.findFirstOrThrow({
        where: { sponsorshipId: id, milestone: 'harvest' },
      });
      // 10% shortfall (90 of 100 fish), capped at the held harvest tranche.
      const refund = Math.floor(packageAmount * 0.1);
      expect(harvestTranche.amount).toBe(packageAmount * 0.3 - refund);
      expect(harvestTranche.state).toBe('released');
      const refundPayment = await prisma.payment.findFirstOrThrow({
        where: { sponsorshipId: id, purpose: 'refund' },
      });
      expect(refundPayment.amount).toBe(refund);
      expect(refundPayment.state).toBe('refunded');
      const adjustment = await prisma.adjustment.findFirstOrThrow({
        where: { sponsorshipId: id, kind: 'shortfall_refund' },
      });
      expect(adjustment.amount).toBe(refund);
      expect(adjustment.status).toBe('applied');
    }

    const escrow = await request(app.getHttpServer())
      .get(`/v1/sponsorships/${secondGrowSponsorshipId}/escrow`)
      .set(auth(secondUserToken))
      .expect(200);
    expect(escrow.body.released).toBe(180000); // 60k stocking + 80k mid + 40k harvest remainder
    expect(escrow.body.held).toBe(0);

    const repeat = await request(app.getHttpServer())
      .post(`/v1/company/batches/${batchCode}/harvest`)
      .set(auth(adminToken))
      .send({ actualCount: 90 })
      .expect(409);
    expect(repeat.body.code).toBe('sponsorship.invalidTransition');

    const inbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(userToken))
      .expect(200);
    expect(JSON.stringify(inbox.body)).toContain('batchHarvested');
    expect(JSON.stringify(inbox.body)).toContain('shortfallRefund');
  });

  it('confirms delivery per sponsor and settles the batch when nothing is in flight', async () => {
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${growSponsorshipId}/confirm-delivery`)
      .set(auth(secondUserToken))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${growSponsorshipId}/confirm-delivery`)
      .set(auth(userToken))
      .expect(200);

    let batch = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(batch.status).toBe('harvested'); // the second sponsorship is still in flight

    const second = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${secondGrowSponsorshipId}/confirm-delivery`)
      .set(auth(secondUserToken))
      .expect(200);
    expect(second.body.status).toBe('settled');
    expect(typeof second.body.deliveredAt).toBe('string');
    expect(typeof second.body.settledAt).toBe('string');

    batch = await prisma.growOutBatch.findUniqueOrThrow({ where: { code: batchCode } });
    expect(batch.status).toBe('settled');
    const settledRecords = await prisma.sponsorship.findMany({
      where: { batch: { code: batchCode }, id: { in: [growSponsorshipId, secondGrowSponsorshipId] } },
    });
    expect(settledRecords).toHaveLength(2);
    expect(settledRecords.every((record) => record.status === 'settled')).toBe(true);

    const repeat = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${secondGrowSponsorshipId}/confirm-delivery`)
      .set(auth(secondUserToken))
      .expect(409);
    expect(repeat.body.code).toBe('sponsorship.invalidTransition');

    const adminInbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(adminToken))
      .expect(200);
    expect(JSON.stringify(adminInbox.body)).toContain('batchSettled');
  });

  it('pays a reservation of an already-growing batch straight into growing with released stocking escrow', async () => {
    const batch = await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send({
        title: `Growing payment batch ${marker}`,
        species: 'Tilapia',
        breed: 'Nile tilapia',
        description: 'A fully managed grow-out batch with feed, care and delivery included.',
        location: 'Can Tho aquaculture zone',
        region: 'Mekong Delta',
        stockingDate: new Date().toISOString(),
        expectedHarvestDate: future(),
        stockCount: 100,
        shareUnitType: 'count',
        shareQuantity: 10,
        packagePricePerShare: 50000,
        contingencyPct: 10,
        riskDisclosure: 'Fish health and harvest timing may vary because aquaculture has biological risks.',
        termsVersion: '2026-10',
        facilityId,
        images: [{ url: `https://images.example.com/${marker}/growing.jpg` }],
        costs: [
          { category: 'equipment', label: 'Equipment allocation', amount: 250000, allocation: 'batch_total' },
          { category: 'feed', label: 'Feed and care', amount: 25000, allocation: 'per_share' },
        ],
      })
      .expect(201);
    const code = batch.body.id as string;
    batchCodes.push(code);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/publish`)
      .set(auth(adminToken))
      .expect(200);

    const reserved = await request(app.getHttpServer())
      .post(`/v1/batches/${code}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 2 }))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/grow`)
      .set(auth(adminToken))
      .expect(200);

    const paid = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${reserved.body.id}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(200);
    expect(paid.body.status).toBe('growing');
    expect(typeof paid.body.growingAt).toBe('string');

    const stocking = await prisma.escrowRelease.findFirstOrThrow({
      where: { sponsorshipId: reserved.body.id, milestone: 'stocking' },
    });
    expect(stocking.state).toBe('released');
    const escrow = await request(app.getHttpServer())
      .get(`/v1/sponsorships/${reserved.body.id}/escrow`)
      .set(auth(userToken))
      .expect(200);
    expect(escrow.body.released).toBe(30000);
    expect(escrow.body.held).toBe(70000);
  });

  async function growingSponsorship(label: string, shares: number, unpaidShares = 0) {
    const batch = await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send({
        title: `Dispute ${label} batch ${marker}`,
        species: 'Tilapia',
        breed: 'Nile tilapia',
        description: 'A fully managed grow-out batch with feed, care and delivery included.',
        location: 'Can Tho aquaculture zone',
        region: 'Mekong Delta',
        stockingDate: new Date().toISOString(),
        expectedHarvestDate: future(),
        stockCount: 100,
        shareUnitType: 'count',
        shareQuantity: 10,
        packagePricePerShare: 50000,
        contingencyPct: 10,
        riskDisclosure: 'Fish health and harvest timing may vary because aquaculture has biological risks.',
        termsVersion: '2026-10',
        facilityId,
        images: [{ url: `https://images.example.com/${marker}/${label}.jpg` }],
        costs: [
          { category: 'equipment', label: 'Equipment allocation', amount: 250000, allocation: 'batch_total' },
          { category: 'feed', label: 'Feed and care', amount: 25000, allocation: 'per_share' },
        ],
      })
      .expect(201);
    const code = batch.body.id as string;
    batchCodes.push(code);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/publish`)
      .set(auth(adminToken))
      .expect(200);
    const reserved = await request(app.getHttpServer())
      .post(`/v1/batches/${code}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares }))
      .expect(201);
    let unpaidId: string | null = null;
    if (unpaidShares > 0) {
      const unpaid = await request(app.getHttpServer())
        .post(`/v1/batches/${code}/sponsorships`)
        .set(auth(userToken))
        .send(reservation({ shares: unpaidShares }))
        .expect(201);
      unpaidId = unpaid.body.id as string;
    }
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/grow`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${reserved.body.id}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(200);
    return { sponsorshipId: reserved.body.id as string, unpaidId };
  }

  /** Grows, pays and publishes the harvest (optionally charging a per-share delivery fee). */
  async function harvestedSponsorship(label: string, shares: number, deliveryFeePerShare?: number) {
    const batch = await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send({
        title: `Delivery fee ${label} batch ${marker}`,
        species: 'Tilapia',
        breed: 'Nile tilapia',
        description: 'A fully managed grow-out batch with feed, care and delivery included.',
        location: 'Can Tho aquaculture zone',
        region: 'Mekong Delta',
        stockingDate: new Date().toISOString(),
        expectedHarvestDate: future(),
        stockCount: 100,
        shareUnitType: 'count',
        shareQuantity: 10,
        packagePricePerShare: 50000,
        contingencyPct: 10,
        riskDisclosure: 'Fish health and harvest timing may vary because aquaculture has biological risks.',
        termsVersion: '2026-10',
        facilityId,
        images: [{ url: `https://images.example.com/${marker}/fee-${label}.jpg` }],
        costs: [
          { category: 'equipment', label: 'Equipment allocation', amount: 250000, allocation: 'batch_total' },
          { category: 'feed', label: 'Feed and care', amount: 25000, allocation: 'per_share' },
        ],
      })
      .expect(201);
    const code = batch.body.id as string;
    batchCodes.push(code);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/publish`)
      .set(auth(adminToken))
      .expect(200);
    const reserved = await request(app.getHttpServer())
      .post(`/v1/batches/${code}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares }))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/grow`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${reserved.body.id}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/harvest`)
      .set(auth(adminToken))
      .send({ actualCount: 100, ...(deliveryFeePerShare ? { deliveryFeePerShare } : {}) })
      .expect(200);
    return { sponsorshipId: reserved.body.id as string, batchCode: code };
  }

  it('charges the optional delivery fee at harvest and requires it before handover', async () => {
    const { sponsorshipId } = await harvestedSponsorship('required', 2, 20000);
    const detail = await request(app.getHttpServer())
      .get(`/v1/sponsorships/${sponsorshipId}`)
      .set(auth(userToken))
      .expect(200);
    expect(detail.body.status).toBe('ready_for_delivery');
    expect(detail.body.deliveryFee).toBe(40000);
    expect(detail.body.totalAmount).toBe(140000);

    // The fee blocks delivery confirmation with a dedicated conflict code.
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/confirm-delivery`)
      .set(auth(userToken))
      .expect(409)
      .expect((response) => expect(response.body.code).toBe('sponsorship.deliveryFeeDue'));

    // Only the sponsor may pay the fee.
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay-delivery-fee`)
      .send({ paymentMethod: 'e_wallet' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay-delivery-fee`)
      .set(auth(adminToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay-delivery-fee`)
      .set(auth(secondUserToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(403);

    const paid = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay-delivery-fee`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(200);
    expect(paid.body.deliveryFee).toBe(40000);
    const feePayments = (paid.body.payments as Array<Record<string, unknown>>).filter(
      (row) => row.purpose === 'delivery_fee',
    );
    expect(feePayments).toHaveLength(1);
    expect(feePayments[0]).toMatchObject({ amount: 40000, state: 'paid' });

    // Replays return the same record without a second fee payment.
    const replay = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay-delivery-fee`)
      .set(auth(userToken))
      .send({ paymentMethod: 'bank_card' })
      .expect(200);
    expect(replay.body.id).toBe(sponsorshipId);
    expect((replay.body.payments as Array<Record<string, unknown>>).filter((row) => row.purpose === 'delivery_fee')).toHaveLength(1);

    // Delivery confirmation now succeeds and settles the single-sponsorship batch.
    const delivered = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/confirm-delivery`)
      .set(auth(userToken))
      .expect(200);
    expect(delivered.body.status).toBe('settled');

    const buyerInbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(userToken))
      .expect(200);
    expect(JSON.stringify(buyerInbox.body)).toContain('sponsorshipDeliveryFeePaid');
    const feeActivity = await prisma.activity.findFirst({ where: { action: 'Paid sponsorship delivery fee' } });
    expect(feeActivity).toBeTruthy();
  });

  it('rejects delivery-fee payments when nothing is due or the record is not ready', async () => {
    const { sponsorshipId } = await harvestedSponsorship('free', 1);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay-delivery-fee`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(409)
      .expect((response) => expect(response.body.code).toBe('sponsorship.deliveryFeeNothingDue'));
    // With no fee charged, confirmation works unchanged.
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/confirm-delivery`)
      .set(auth(userToken))
      .expect(200);
    // A delivered/settled record is no longer in the paying state either.
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/pay-delivery-fee`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(409);
  });

  it('restricts sponsorship disputes to eligible owned paid records', async () => {
    const { sponsorshipId, unpaidId } = await growingSponsorship('eligible', 1, 1);

    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/dispute`)
      .send({ reason: 'other', description: 'A guest cannot file sponsorship disputes.' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/dispute`)
      .set(auth(secondUserToken))
      .send({ reason: 'other', description: 'A foreign user cannot see or dispute this record.' })
      .expect(404);
    // Admins do not hold dispute.create, so the guard rejects before ownership.
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/dispute`)
      .set(auth(adminToken))
      .send({ reason: 'other', description: 'Admins are not sponsors and cannot dispute.' })
      .expect(403);

    // Reserving after growing is impossible, so the unpaid record was reserved
    // before the grow transition inside the helper.
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${unpaidId}/dispute`)
      .set(auth(userToken))
      .send({ reason: 'other', description: 'Unpaid reservations use the cancellation flow instead.' })
      .expect(409);

    const filed = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/dispute`)
      .set(auth(userToken))
      .send({
        reason: 'fish_unwell',
        description: 'The growth updates stopped matching the promised stocking plan.',
      })
      .expect(201);
    expect(filed.body.kind).toBe('sponsorship');
    expect(filed.body.order).toBeNull();
    expect(filed.body.sponsorship.id).toBe(sponsorshipId);
    expect(filed.body.sponsorship.status).toBe('growing');
    expect(filed.body.status).toBe('open');
    expect(filed.body.resolution).toBeNull();

    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${sponsorshipId}/dispute`)
      .set(auth(userToken))
      .send({ reason: 'other', description: 'One dispute per sponsorship, like orders.' })
      .expect(409);

    const mine = await request(app.getHttpServer())
      .get('/v1/me/disputes')
      .set(auth(userToken))
      .expect(200);
    const record = (mine.body as Array<Record<string, unknown>>).find(
      (entry) => entry.id === filed.body.id,
    );
    expect(record).toBeTruthy();
    expect(record?.kind).toBe('sponsorship');
    const foreign = await request(app.getHttpServer())
      .get(`/v1/me/disputes/${filed.body.id}`)
      .set(auth(secondUserToken))
      .expect(404);
    expect(foreign.body.code ?? foreign.body.message).toBeDefined();
  });

  it('moves sponsorship disputes through review, resolution and rejection with notifications', async () => {
    const { sponsorshipId: resolved } = await growingSponsorship('resolve', 1);
    const { sponsorshipId: rejected } = await growingSponsorship('reject', 1);

    const attachment = await request(app.getHttpServer())
      .post('/v1/uploads')
      .set(auth(userToken))
      .field('purpose', 'dispute_attachment')
      .attach('file', PNG, { filename: 'evidence.png', contentType: 'image/png' })
      .expect(201);
    uploadIds.push(attachment.body.id as string);
    privateFiles.push(attachment.body.url as string);

    const first = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${resolved}/dispute`)
      .set(auth(userToken))
      .send({
        reason: 'not_as_described',
        description: 'The delivered fish do not match the promised species mix.',
        uploadIds: [attachment.body.id as string],
      })
      .expect(201);
    expect(first.body.attachments).toHaveLength(1);

    const second = await request(app.getHttpServer())
      .post(`/v1/sponsorships/${rejected}/dispute`)
      .set(auth(userToken))
      .send({ reason: 'other', description: 'Second dispute to exercise the rejection path.' })
      .expect(201);

    const queued = await request(app.getHttpServer())
      .get('/v1/admin/disputes?status=open')
      .set(auth(adminToken))
      .expect(200);
    const ids = (queued.body as Array<Record<string, unknown>>).map((entry) => entry.id);
    expect(ids).toContain(first.body.id);
    expect(ids).toContain(second.body.id);
    const detail = (queued.body as Array<Record<string, unknown>>).find(
      (entry) => entry.id === first.body.id,
    );
    expect(detail && (detail.sponsorship as Record<string, unknown>).batch).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/v1/admin/disputes/${first.body.id}/start-review`)
      .set(auth(adminToken))
      .expect(200);
    expect(
      (await request(app.getHttpServer()).get(`/v1/me/disputes/${first.body.id}`).set(auth(userToken)).expect(200))
        .body.status,
    ).toBe('reviewing');

    const adminContent = await request(app.getHttpServer())
      .get(`/v1/admin/disputes/${first.body.id}/attachments/${first.body.attachments[0].id}/content`)
      .set(auth(adminToken))
      .expect(200);
    expect(Buffer.isBuffer(adminContent.body) || adminContent.body.length > 0).toBe(true);
    await request(app.getHttpServer())
      .get(`/v1/me/disputes/${first.body.id}/attachments/${first.body.attachments[0].id}/content`)
      .set(auth(secondUserToken))
      .expect(404);

    const resolvedResponse = await request(app.getHttpServer())
      .post(`/v1/admin/disputes/${first.body.id}/resolve`)
      .set(auth(adminToken))
      .send({ resolution: 'Company will replace the affected fish at the next delivery.' })
      .expect(200);
    expect(resolvedResponse.body.status).toBe('resolved');
    expect(typeof resolvedResponse.body.resolvedAt).toBe('string');
    await request(app.getHttpServer())
      .post(`/v1/admin/disputes/${first.body.id}/resolve`)
      .set(auth(adminToken))
      .send({ resolution: 'Re-resolving a closed dispute must conflict.' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/v1/admin/disputes/${second.body.id}/start-review`)
      .set(auth(adminToken))
      .expect(200);
    const rejectedResponse = await request(app.getHttpServer())
      .post(`/v1/admin/disputes/${second.body.id}/reject`)
      .set(auth(adminToken))
      .send({ resolution: 'Growth updates match the recorded observations.' })
      .expect(200);
    expect(rejectedResponse.body.status).toBe('rejected');
    expect(rejectedResponse.body.sponsorship.batch.code).toBeTruthy();

    const inbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(userToken))
      .expect(200);
    const rendered = JSON.stringify(inbox.body);
    expect(rendered).toContain('disputeReviewing');
    expect(rendered).toContain('disputeResolved');
    expect(rendered).toContain('disputeRejected');
    const adminInbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(adminToken))
      .expect(200);
    expect(JSON.stringify(adminInbox.body)).toContain('disputeOpened');
  });

  async function publishedBatch(label: string, shareQuantity: number) {
    const batch = await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send({
        title: `Expiry ${label} batch ${marker}`,
        species: 'Tilapia',
        breed: 'Nile tilapia',
        description: 'A fully managed grow-out batch with feed, care and delivery included.',
        location: 'Can Tho aquaculture zone',
        region: 'Mekong Delta',
        stockingDate: new Date().toISOString(),
        expectedHarvestDate: future(),
        stockCount: 100,
        shareUnitType: 'count',
        shareQuantity,
        packagePricePerShare: 50000,
        contingencyPct: 10,
        riskDisclosure: 'Fish health and harvest timing may vary because aquaculture has biological risks.',
        termsVersion: '2026-10',
        facilityId,
        images: [{ url: `https://images.example.com/${marker}/expiry-${label}.jpg` }],
        costs: [
          { category: 'equipment', label: 'Equipment allocation', amount: 250000, allocation: 'batch_total' },
          { category: 'feed', label: 'Feed and care', amount: 25000, allocation: 'per_share' },
        ],
      })
      .expect(201);
    const code = batch.body.id as string;
    batchCodes.push(code);
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/publish`)
      .set(auth(adminToken))
      .expect(200);
    return code;
  }

  it('expires due unpaid reservations on read, restores shares and blocks late payment', async () => {
    // Two shares total: both reservations fill the batch (fully_sponsored).
    const code = await publishedBatch('pay', 10);
    const stale = await request(app.getHttpServer())
      .post(`/v1/batches/${code}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 1 }))
      .expect(201);
    const fresh = await request(app.getHttpServer())
      .post(`/v1/batches/${code}/sponsorships`)
      .set(auth(secondUserToken))
      .send(reservation({ shares: 1 }))
      .expect(201);
    await prisma.growOutBatch.update({
      where: { code },
      data: { status: 'fully_sponsored', sharesAvailable: 0 },
    });
    // Backdate the stale reservation past the 24h expiry window.
    await prisma.sponsorship.update({
      where: { id: stale.body.id as string },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    // Paying an expired reservation conflicts with the dedicated error code...
    await request(app.getHttpServer())
      .post(`/v1/sponsorships/${stale.body.id}/pay`)
      .set(auth(userToken))
      .send({ paymentMethod: 'e_wallet' })
      .expect(409)
      .expect((response) => expect(response.body.code).toBe('sponsorship.expired'));

    // ...and the owner's next read lazily expires it, restoring the shares.
    const mine = await request(app.getHttpServer())
      .get('/v1/me/sponsorships')
      .set(auth(userToken))
      .expect(200);
    const expiredRow = mine.body.items.find((row: { id: string }) => row.id === stale.body.id);
    expect(expiredRow.status).toBe('cancelled');
    expect(typeof expiredRow.cancelledAt).toBe('string');
    const batchRow = await prisma.growOutBatch.findUniqueOrThrow({ where: { code } });
    expect(batchRow.sharesAvailable).toBe(1);
    expect(batchRow.status).toBe('open');

    // The fresh (non-due) reservation of the other user is untouched.
    const other = await request(app.getHttpServer())
      .get('/v1/me/sponsorships')
      .set(auth(secondUserToken))
      .expect(200);
    expect(other.body.items.find((row: { id: string }) => row.id === fresh.body.id).status).toBe('pending_payment');

    // The company view expires due reservations too and notifies both sides.
    const adminInbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(adminToken))
      .expect(200);
    expect(JSON.stringify(adminInbox.body)).toContain('reservationExpired');
    const buyerInbox = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set(auth(userToken))
      .expect(200);
    expect(JSON.stringify(buyerInbox.body)).toContain('reservationExpired');
    const activity = await prisma.activity.findFirst({
      where: { action: 'Unpaid reservation expired', target: code },
    });
    expect(activity).toBeTruthy();

    // The restored share can be reserved again.
    await request(app.getHttpServer())
      .post(`/v1/batches/${code}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 1 }))
      .expect(201);
  });

  it('expires due unpaid reservations when the batch starts growing', async () => {
    const code = await publishedBatch('grow', 10);
    const stale = await request(app.getHttpServer())
      .post(`/v1/batches/${code}/sponsorships`)
      .set(auth(userToken))
      .send(reservation({ shares: 1 }))
      .expect(201);
    await prisma.sponsorship.update({
      where: { id: stale.body.id as string },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const grown = await request(app.getHttpServer())
      .post(`/v1/company/batches/${code}/grow`)
      .set(auth(adminToken))
      .expect(200);
    expect(grown.body.status).toBe('growing');
    const expiredRow = await prisma.sponsorship.findUniqueOrThrow({ where: { id: stale.body.id as string } });
    expect(expiredRow.status).toBe('cancelled');
    expect(expiredRow.cancelledAt).toBeTruthy();
    const batchRow = await prisma.growOutBatch.findUniqueOrThrow({ where: { code } });
    expect(batchRow.sharesAvailable).toBe(10);
    expect(batchRow.status).toBe('growing');
  });
});
