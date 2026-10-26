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

describe('Facilities and batches (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let adminToken: string;
  let secondAdminToken: string;
  let userToken: string;
  let adminId: string;
  let secondAdminId: string;
  let userId: string;
  let mainFacilityId: string;
  let mainDocumentId: string;
  let mainDocumentUrl: string;
  let mainOpenBatchCode: string;

  const marker = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const userIds: string[] = [];
  const facilityIds: string[] = [];
  const batchCodes: string[] = [];
  const uploadIds: string[] = [];
  const privateFiles: string[] = [];

  const future = () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const past = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'FishFarm' },
      update: {},
    });

    ({ id: adminId } = await register('batch-admin'));
    ({ id: secondAdminId } = await register('batch-second-admin'));
    ({ id: userId, token: userToken } = await register('batch-user'));
    await prisma.user.updateMany({
      where: { id: { in: [adminId, secondAdminId] } },
      data: { role: 'Admin' },
    });
    adminToken = await login(adminId);
    secondAdminToken = await login(secondAdminId);

    const facility = await createFacility(adminToken, 'Primary facility');
    mainFacilityId = facility.id;
    const document = await uploadFarmDocument(adminToken);
    mainDocumentUrl = document.url;
    const verification = await saveVerification(secondAdminToken, mainFacilityId, document.id);
    mainDocumentId = verification.documents[0].id;
    await inspect(mainFacilityId, {
      status: 'approved',
      level: 'inspected',
      inspectedAt: new Date().toISOString(),
      inspector: 'Company compliance team',
      validUntil: future(),
    });
  });

  afterAll(async () => {
    if (batchCodes.length) {
      await prisma.notification.deleteMany({
        where: {
          link: { in: batchCodes.map((code) => `#admin/batches/${code}`) },
        },
      });
      await prisma.sponsorship.deleteMany({
        where: { batch: { code: { in: batchCodes } } },
      });
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
    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { email: true },
    });
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createFacility(token: string, label: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/company/facilities')
      .set(auth(token))
      .send({
        name: `${label} ${marker}`,
        location: 'Can Tho aquaculture zone',
        region: 'Mekong Delta',
      })
      .expect(201);
    facilityIds.push(response.body.id as string);
    return response.body as { id: string; name: string; verification: unknown };
  }

  async function uploadFarmDocument(token: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/uploads')
      .set(auth(token))
      .field('purpose', 'farm_document')
      .attach('file', PNG, { filename: 'compliance.png', contentType: 'image/png' })
      .expect(201);
    uploadIds.push(response.body.id as string);
    privateFiles.push(response.body.url as string);
    return response.body as { id: string; url: string };
  }

  async function saveVerification(token: string, facilityId: string, uploadId: string) {
    const response = await request(app.getHttpServer())
      .post(`/v1/company/facilities/${facilityId}/verification`)
      .set(auth(token))
      .send({
        level: 'inspected',
        inspectedAt: new Date().toISOString(),
        inspector: 'Company compliance team',
        notes: 'Controlled compliance evidence is on file.',
        documents: [{ type: 'business_registration', uploadId }],
      })
      .expect(201);
    return response.body as {
      status: string;
      documents: Array<{ id: string; controlled: boolean }>;
    };
  }

  function inspect(facilityId: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post(`/v1/admin/facilities/${facilityId}/inspect`)
      .set(auth(adminToken))
      .send(body);
  }

  function countBatch(
    facilityId = mainFacilityId,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      title: `Tilapia sponsor batch ${marker}-${batchCodes.length}`,
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
      images: [{ url: `https://images.example.com/${marker}/batch.jpg` }],
      costs: [
        { category: 'equipment', label: 'Equipment allocation', amount: 1000000, allocation: 'batch_total' },
        { category: 'feed', label: 'Feed and care', amount: 50000, allocation: 'per_share' },
      ],
      ...overrides,
    };
  }

  function weightBatch(overrides: Record<string, unknown> = {}) {
    return countBatch(mainFacilityId, {
      title: `Catfish weight batch ${marker}-${batchCodes.length}`,
      species: 'Catfish',
      stockCount: 1000,
      shareUnitType: 'weight',
      shareQuantity: 5000,
      expectedHarvestWeightG: 200000,
      costs: [
        { category: 'equipment', label: 'Equipment allocation', amount: 2000000, allocation: 'batch_total' },
        { category: 'feed', label: 'Feed and care', amount: 50000, allocation: 'per_share' },
      ],
      ...overrides,
    });
  }

  async function createBatch(body: Record<string, unknown>, token = adminToken) {
    const response = await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(token))
      .send(body)
      .expect(201);
    batchCodes.push(response.body.id as string);
    return response.body as Record<string, any>;
  }

  it('manages controlled facility evidence without exposing private files', async () => {
    await request(app.getHttpServer())
      .get('/v1/company/facilities')
      .set(auth(userToken))
      .expect(403);
    await request(app.getHttpServer())
      .post('/v1/company/facilities')
      .set(auth(userToken))
      .send({ name: 'Forbidden', location: 'Forbidden' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/v1/uploads')
      .set(auth(userToken))
      .field('purpose', 'farm_document')
      .attach('file', PNG, { filename: 'forbidden.png', contentType: 'image/png' })
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/v1/company/facilities')
      .set(auth(secondAdminToken))
      .expect(200);
    expect(list.body.some((facility: { id: string }) => facility.id === mainFacilityId)).toBe(true);

    await request(app.getHttpServer()).get(mainDocumentUrl).expect(404);
    await request(app.getHttpServer())
      .get(
        `/v1/company/facilities/${mainFacilityId}/verification/documents/${mainDocumentId}/content`,
      )
      .set(auth(userToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(
        `/v1/admin/facilities/${mainFacilityId}/verification/documents/${mainDocumentId}/content`,
      )
      .set(auth(secondAdminToken))
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('Content-Type', /image\/png/);

    const detail = await request(app.getHttpServer())
      .get(`/v1/company/facilities/${mainFacilityId}/verification`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.documents[0]).toMatchObject({ controlled: true, mimeType: 'image/png' });
    expect(JSON.stringify(detail.body)).not.toContain('/uploads/private/');
    expect(detail.body.documents[0]).not.toHaveProperty('url');

    await request(app.getHttpServer())
      .post(`/v1/company/facilities/${mainFacilityId}/verification`)
      .set(auth(adminToken))
      .send({ level: 'inspected', documents: [{ type: '', uploadId: '' }] })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('validation.failed'));

    const replacement = await saveVerification(secondAdminToken, mainFacilityId, uploadIds[0]);
    expect(replacement.status).toBe('pending');
    mainDocumentId = replacement.documents[0].id;

    await inspect(mainFacilityId, { status: 'approved', level: 'inspected' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('facility.approvalIncomplete'));
    await inspect(mainFacilityId, {
      status: 'approved',
      level: 'inspected',
      validUntil: past(),
    })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('facility.approvalIncomplete'));
    await inspect(mainFacilityId, {
      status: 'approved',
      level: 'inspected',
      inspectedAt: new Date().toISOString(),
      inspector: 'Company compliance team',
      validUntil: future(),
    })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('approved'));

    const otherFacility = await createFacility(adminToken, 'Other facility');
    await request(app.getHttpServer())
      .post(`/v1/company/facilities/${otherFacility.id}/verification`)
      .set(auth(adminToken))
      .send({
        level: 'registered',
        documents: [{ type: 'business_registration', uploadId: uploadIds[0] }],
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('uploads.alreadyUsed'));
  });

  it('derives shares and rejects invalid publish contracts', async () => {
    await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(userToken))
      .send(countBatch())
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send(countBatch('missing-facility'))
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('facility.notFound'));

    await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send(weightBatch({ expectedHarvestWeightG: undefined }))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('batch.expectedHarvestWeightRequired'));
    await request(app.getHttpServer())
      .post('/v1/company/batches')
      .set(auth(adminToken))
      .send(countBatch(mainFacilityId, { stockCount: 3, shareQuantity: 4 }))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('batch.invalidShares'));

    const mismatch = await createBatch(
      countBatch(mainFacilityId, {
        costs: [{ category: 'equipment', label: 'Incomplete budget', amount: 1, allocation: 'batch_total' }],
      }),
    );
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${mismatch.id}/publish`)
      .set(auth(adminToken))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('batch.costMismatch'));

    const noImages = await createBatch(countBatch(mainFacilityId, { images: [] }));
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${noImages.id}/publish`)
      .set(auth(adminToken))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('batch.imagesRequired'));

    const inconsistent = await createBatch(countBatch());
    await prisma.growOutBatch.update({
      where: { code: inconsistent.id as string },
      data: { totalShares: 19, sharesAvailable: 19 },
    });
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${inconsistent.id}/publish`)
      .set(auth(adminToken))
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('batch.invalidShares'));

    const unverified = await createFacility(adminToken, 'Unverified facility');
    const unverifiedBatch = await createBatch(countBatch(unverified.id));
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${unverifiedBatch.id}/publish`)
      .set(auth(adminToken))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('batch.complianceRequired'));

    const legacy = await prisma.facility.create({
      data: {
        companyId: COMPANY_ID,
        name: `Legacy facility ${marker}`,
        location: 'Legacy location',
        region: 'Mekong Delta',
        verification: {
          create: {
            level: 'inspected',
            status: 'approved',
            inspectedAt: new Date(),
            validUntil: new Date(future()),
            documents: {
              create: { type: 'legacy_document', url: 'https://legacy.example.com/document.pdf' },
            },
          },
        },
      },
    });
    facilityIds.push(legacy.id);
    const legacyBatch = await createBatch(countBatch(legacy.id));
    await request(app.getHttpServer())
      .post(`/v1/company/batches/${legacyBatch.id}/publish`)
      .set(auth(adminToken))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('batch.controlledDocumentsRequired'));
  });

  it('publishes a count batch with safe public filtering and growth updates', async () => {
    const draft = await createBatch(countBatch());
    expect(draft).toMatchObject({
      status: 'draft',
      shareUnitType: 'count',
      shareQuantity: 5,
      totalShares: 20,
      sharesAvailable: 20,
    });
    await request(app.getHttpServer()).get(`/v1/batches/${draft.id}`).expect(404);

    const edited = await request(app.getHttpServer())
      .patch(`/v1/company/batches/${draft.id}`)
      .set(auth(secondAdminToken))
      .send({ title: `Public tilapia ${marker}` })
      .expect(200);
    expect(edited.body).toMatchObject({
      title: `Public tilapia ${marker}`,
      totalShares: 20,
      packagePricePerShare: 100000,
    });
    expect(edited.body.images).toHaveLength(1);
    expect(edited.body.costs).toHaveLength(2);

    const published = await request(app.getHttpServer())
      .post(`/v1/company/batches/${draft.id}/publish`)
      .set(auth(adminToken))
      .expect(200);
    expect(published.body.status).toBe('open');
    mainOpenBatchCode = draft.id as string;

    await request(app.getHttpServer())
      .patch(`/v1/company/batches/${draft.id}`)
      .set(auth(adminToken))
      .send({ packagePricePerShare: 110000 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('batch.draftOnly'));

    const detail = await request(app.getHttpServer())
      .get(`/v1/batches/${draft.id}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      id: draft.id,
      title: `Public tilapia ${marker}`,
      totalShares: 20,
      compliance: { level: 'inspected' },
    });
    const publicJson = JSON.stringify(detail.body);
    expect(publicJson).not.toContain('/uploads/private/');
    expect(detail.body).not.toHaveProperty('reviewNote');
    expect(detail.body).not.toHaveProperty('reviewedBy');
    expect(detail.body).not.toHaveProperty('createdBy');
    expect(detail.body.compliance).not.toHaveProperty('inspector');
    expect(detail.body.facility).not.toHaveProperty('verification');

    const query = new URLSearchParams({
      q: `Public tilapia ${marker}`,
      species: 'tilapia',
      region: 'mekong delta',
      harvestBefore: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(),
      priceMax: '100000',
      page: '1',
      limit: '1',
    });
    const list = await request(app.getHttpServer())
      .get(`/v1/batches?${query.toString()}`)
      .expect(200);
    expect(list.body).toMatchObject({ page: 1, limit: 1, total: 1, pages: 1 });
    expect(list.body.items[0].id).toBe(draft.id);

    const update = await request(app.getHttpServer())
      .post(`/v1/company/batches/${draft.id}/updates`)
      .set(auth(secondAdminToken))
      .send({
        stage: 'juvenile',
        averageWeightG: 220,
        countAlive: 96,
        note: 'Growth remains on schedule after the latest health check.',
        photoUrls: [`https://images.example.com/${marker}/growth.jpg`],
      })
      .expect(201);
    expect(update.body).toMatchObject({ stage: 'juvenile', averageWeightG: 220, countAlive: 96 });

    const updates = await request(app.getHttpServer())
      .get(`/v1/batches/${draft.id}/updates`)
      .expect(200);
    expect(updates.body[0]).toMatchObject({
      stage: 'juvenile',
      note: 'Growth remains on schedule after the latest health check.',
    });
  });

  it('supports weight shares and the optional internal review lifecycle', async () => {
    const draft = await createBatch(weightBatch());
    expect(draft).toMatchObject({
      shareUnitType: 'weight',
      shareQuantity: 5000,
      expectedHarvestWeightG: 200000,
      totalShares: 40,
      sharesAvailable: 40,
    });

    await request(app.getHttpServer())
      .post(`/v1/company/batches/${draft.id}/submit`)
      .set(auth(adminToken))
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('pending_review'));
    await request(app.getHttpServer()).get('/v1/admin/batches').set(auth(userToken)).expect(403);
    const queue = await request(app.getHttpServer())
      .get('/v1/admin/batches')
      .set(auth(secondAdminToken))
      .expect(200);
    expect(queue.body.some((batch: { id: string }) => batch.id === draft.id)).toBe(true);

    const rejected = await request(app.getHttpServer())
      .post(`/v1/admin/batches/${draft.id}/reject`)
      .set(auth(secondAdminToken))
      .send({ note: 'Update the package budget before publication.' })
      .expect(200);
    expect(rejected.body).toMatchObject({
      status: 'draft',
      reviewNote: 'Update the package budget before publication.',
    });

    const revised = await request(app.getHttpServer())
      .patch(`/v1/company/batches/${draft.id}`)
      .set(auth(adminToken))
      .send({
        packagePricePerShare: 110000,
        costs: [
          { category: 'equipment', label: 'Equipment allocation', amount: 2400000, allocation: 'batch_total' },
          { category: 'feed', label: 'Feed and care', amount: 50000, allocation: 'per_share' },
        ],
      })
      .expect(200);
    expect(revised.body).toMatchObject({ packagePricePerShare: 110000, totalShares: 40 });

    await request(app.getHttpServer())
      .post(`/v1/company/batches/${draft.id}/submit`)
      .set(auth(adminToken))
      .expect(200);
    const approved = await request(app.getHttpServer())
      .post(`/v1/admin/batches/${draft.id}/approve`)
      .set(auth(secondAdminToken))
      .expect(200);
    expect(approved.body).toMatchObject({ status: 'open', reviewNote: null });

    const publicDetail = await request(app.getHttpServer())
      .get(`/v1/batches/${draft.id}`)
      .expect(200);
    expect(publicDetail.body).toMatchObject({
      shareUnitType: 'weight',
      shareQuantity: 5000,
      expectedHarvestWeightG: 200000,
      totalShares: 40,
    });
    expect(publicDetail.body).not.toHaveProperty('reviewNote');
    expect(publicDetail.body).not.toHaveProperty('reviewedBy');

    await request(app.getHttpServer())
      .post(`/v1/admin/batches/${draft.id}/approve`)
      .set(auth(secondAdminToken))
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/v1/company/batches/${draft.id}`)
      .set(auth(adminToken))
      .send({ packagePricePerShare: 120000 })
      .expect(409);
  });

  it('enforces draft deletion and cancellation restrictions atomically', async () => {
    const removable = await createBatch(countBatch());
    await request(app.getHttpServer())
      .delete(`/v1/company/batches/${removable.id}`)
      .set(auth(secondAdminToken))
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: removable.id, deleted: true }));

    const withHarvest = await createBatch(countBatch());
    const harvestBatch = await prisma.growOutBatch.findUniqueOrThrow({
      where: { code: withHarvest.id as string },
      select: { id: true },
    });
    await prisma.harvest.create({
      data: { batchId: harvestBatch.id, harvestedAt: new Date(), status: 'draft' },
    });
    await request(app.getHttpServer())
      .delete(`/v1/company/batches/${withHarvest.id}`)
      .set(auth(adminToken))
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('batch.deleteForbidden'));

    const sponsored = await createBatch(countBatch());
    const sponsoredRecord = await prisma.growOutBatch.findUniqueOrThrow({
      where: { code: sponsored.id as string },
      select: { id: true },
    });
    await prisma.sponsorship.create({
      data: {
        batchId: sponsoredRecord.id,
        sponsorId: userId,
        shares: 1,
        packageAmount: 100000,
        totalAmount: 100000,
        recipientName: 'Test sponsor',
        phone: '0900000000',
        address: 'Test address',
        termsSnapshot: { version: '2026-10' },
      },
    });
    await request(app.getHttpServer())
      .post(`/v1/admin/batches/${sponsored.id}/cancel`)
      .set(auth(adminToken))
      .send({ note: 'Cancellation must not bypass an existing sponsorship.' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('batch.cancelForbidden'));

    const cancellable = await createBatch(countBatch());
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/admin/batches/${cancellable.id}/cancel`)
        .set(auth(adminToken))
        .send({ note: 'The batch will not proceed.' }),
      request(app.getHttpServer())
        .post(`/v1/admin/batches/${cancellable.id}/cancel`)
        .set(auth(secondAdminToken))
        .send({ note: 'Concurrent duplicate cancellation.' }),
    ]);
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
    const cancelled = await request(app.getHttpServer())
      .get(`/v1/company/batches/${cancellable.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });

  it('serializes partial edits and competing compliance references', async () => {
    const draft = await createBatch(countBatch());
    const edits = await Promise.all([
      request(app.getHttpServer()).patch(`/v1/company/batches/${draft.id}`).set(auth(adminToken))
        .send({ title: `Concurrent batch ${marker}` }),
      request(app.getHttpServer()).patch(`/v1/company/batches/${draft.id}`).set(auth(secondAdminToken))
        .send({ description: 'An independently updated description must survive the concurrent title edit.' }),
    ]);
    expect(edits.map((response) => response.status)).toEqual([200, 200]);
    const current = await request(app.getHttpServer()).get(`/v1/company/batches/${draft.id}`)
      .set(auth(adminToken)).expect(200);
    expect(current.body).toMatchObject({
      title: `Concurrent batch ${marker}`,
      description: 'An independently updated description must survive the concurrent title edit.',
    });

    const first = await createFacility(adminToken, 'Competing first facility');
    const second = await createFacility(secondAdminToken, 'Competing second facility');
    const document = await uploadFarmDocument(adminToken);
    const body = { level: 'registered', documents: [{ type: 'registration', uploadId: document.id }] };
    const saves = await Promise.all([first, second].map((facility) =>
      request(app.getHttpServer()).post(`/v1/company/facilities/${facility.id}/verification`)
        .set(auth(secondAdminToken)).send(body),
    ));
    expect(saves.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(saves.find((response) => response.status === 409)?.body.code).toBe('uploads.alreadyUsed');
  });

  it('hides open batches immediately when compliance expires or is revoked', async () => {
    await prisma.farmVerification.update({
      where: { facilityId: mainFacilityId },
      data: { validUntil: new Date(past()) },
    });
    await request(app.getHttpServer()).get(`/v1/batches/${mainOpenBatchCode}`).expect(404);
    const hidden = await request(app.getHttpServer())
      .get(`/v1/batches?q=${encodeURIComponent(`Public tilapia ${marker}`)}`)
      .expect(200);
    expect(hidden.body.total).toBe(0);

    await prisma.farmVerification.update({
      where: { facilityId: mainFacilityId },
      data: { validUntil: new Date(future()) },
    });
    await request(app.getHttpServer()).get(`/v1/batches/${mainOpenBatchCode}`).expect(200);

    await inspect(mainFacilityId, {
      status: 'revoked',
      notes: 'Compliance was revoked for a policy review.',
    })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('revoked'));
    await request(app.getHttpServer()).get(`/v1/batches/${mainOpenBatchCode}`).expect(404);
  });
});
