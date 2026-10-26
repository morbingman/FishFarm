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

describe('Disputes (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let buyerToken: string;
  let otherToken: string;
  let adminToken: string;
  let buyerId: string;
  let otherId: string;
  let adminId: string;
  let listingId: string;
  const orderIds: string[] = [];
  const privateFiles: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.company.upsert({ where: { id: COMPANY_ID }, create: { id: COMPANY_ID, name: 'FishFarm' }, update: {} });
    ({ id: buyerId, token: buyerToken } = await register('dispute-buyer'));
    ({ id: otherId, token: otherToken } = await register('dispute-other'));
    ({ id: adminId } = await register('dispute-admin'));
    await prisma.user.update({ where: { id: adminId }, data: { role: 'Admin' } });
    adminToken = (await login(await prisma.user.findUniqueOrThrow({ where: { id: adminId }, select: { email: true } }))).accessToken;
    const listing = await prisma.listing.create({
      data: {
        code: `FM-D${String(Date.now()).slice(-7)}`, companyId: COMPANY_ID, companyName: 'FishFarm', status: 'approved',
        draft: { create: { name: 'Dispute Koi', species: 'Koi', price: 100000, quantity: 100 } },
      },
    });
    listingId = listing.id;
  });

  afterAll(async () => {
    const disputes = await prisma.dispute.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
    await prisma.notification.deleteMany({ where: { link: { in: disputes.map((dispute) => `#admin/disputes/${dispute.id}`) } } });
    await prisma.dispute.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: [buyerId, otherId, adminId] } } });
    await prisma.activity.deleteMany({ where: { actorId: { in: [buyerId, otherId, adminId] } } });
    await prisma.upload.deleteMany({ where: { ownerId: { in: [buyerId, otherId] } } });
    await prisma.listing.delete({ where: { id: listingId } });
    await prisma.user.deleteMany({ where: { id: { in: [buyerId, otherId, adminId] } } });
    await Promise.all(privateFiles.map((url) => unlink(join(resolvePrivateUploadDir(process.env.UPLOAD_DIR), basename(url))).catch(() => undefined)));
    await app.close();
  });

  async function register(label: string) {
    const address = email(label);
    const response = await request(app.getHttpServer()).post('/v1/auth/register').send({ email: address, password: PASSWORD, name: label }).expect(201);
    return { id: response.body.user.id as string, token: response.body.accessToken as string, email: address };
  }

  async function login(user: { email: string }) {
    const response = await request(app.getHttpServer()).post('/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    return response.body as { accessToken: string };
  }

  function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

  async function order(status: 'paid' | 'shipped' | 'delivered' | 'completed', ownerId = buyerId) {
    const created = await prisma.order.create({
      data: {
        code: `ORD-D${Date.now()}${orderIds.length}`, buyerId: ownerId, companyId: COMPANY_ID,
        status, paymentStatus: 'paid', saleMode: 'in_stock', subtotal: 100000, total: 100000,
        recipientName: 'Buyer', phone: '0900000000', address: 'Address',
        paidAt: new Date(), shippedAt: ['shipped', 'delivered', 'completed'].includes(status) ? new Date() : null,
        deliveredAt: ['delivered', 'completed'].includes(status) ? new Date() : null,
        completedAt: status === 'completed' ? new Date() : null,
        items: { create: { listingId, saleMode: 'in_stock', quantity: 1, unitPrice: 100000, lineTotal: 100000 } },
      },
    });
    orderIds.push(created.id);
    return created;
  }

  async function upload(token = buyerToken) {
    const response = await request(app.getHttpServer()).post('/v1/uploads').set(auth(token))
      .field('purpose', 'dispute_attachment').attach('file', PNG, { filename: 'evidence.png', contentType: 'image/png' }).expect(201);
    privateFiles.push(response.body.url);
    return response.body as { id: string; url: string };
  }

  it('enforces ownership, eligibility, description and one dispute per order', async () => {
    const early = await order('paid');
    await request(app.getHttpServer()).post(`/v1/me/orders/${early.code}/dispute`).set(auth(buyerToken))
      .send({ reason: 'not_received', description: 'The shipment has not arrived at all.' }).expect(409);
    await request(app.getHttpServer()).post(`/v1/me/orders/${early.code}/dispute`).set(auth(otherToken))
      .send({ reason: 'not_received', description: 'The shipment has not arrived at all.' }).expect(404);

    const shipped = await order('shipped');
    const created = await request(app.getHttpServer()).post(`/v1/me/orders/${shipped.code}/dispute`).set(auth(buyerToken))
      .send({ reason: 'not_received', description: '  The shipment has not arrived after dispatch.  ' }).expect(201);
    expect(created.body).toMatchObject({ order: { id: shipped.code }, reason: 'not_received', status: 'open' });
    expect(created.body.description).toBe('The shipment has not arrived after dispatch.');
    expect(JSON.stringify(created.body)).not.toContain('/uploads/private/');
    await request(app.getHttpServer()).post(`/v1/me/orders/${shipped.code}/dispute`).set(auth(buyerToken))
      .send({ reason: 'not_received', description: 'This duplicate report must be rejected.' }).expect(409);
  });

  it('links unique owned evidence, keeps it private, and authorizes content access', async () => {
    const delivered = await order('delivered');
    const evidence = await upload();
    const created = await request(app.getHttpServer()).post(`/v1/me/orders/${delivered.code}/dispute`).set(auth(buyerToken))
      .send({ reason: 'damaged_packaging', description: 'The insulated package arrived badly damaged.', uploadIds: [evidence.id] }).expect(201);
    const attachmentId = created.body.attachments[0].id as string;
    await request(app.getHttpServer()).get(evidence.url).expect(404);
    await request(app.getHttpServer()).get(`/v1/me/disputes/${created.body.id}/attachments/${attachmentId}/content`)
      .set(auth(buyerToken)).expect(200).expect('X-Content-Type-Options', 'nosniff').expect('Content-Type', /image\/png/);
    await request(app.getHttpServer()).get(`/v1/me/disputes/${created.body.id}/attachments/${attachmentId}/content`)
      .set(auth(otherToken)).expect(404);
    await request(app.getHttpServer()).get(`/v1/admin/disputes/${created.body.id}/attachments/${attachmentId}/content`)
      .set(auth(adminToken)).expect(200).expect('X-Content-Type-Options', 'nosniff');

    const another = await order('delivered');
    await request(app.getHttpServer()).post(`/v1/me/orders/${another.code}/dispute`).set(auth(buyerToken))
      .send({ reason: 'other', description: 'This attempts to reuse already linked evidence.', uploadIds: [evidence.id] }).expect(409);
    const foreign = await upload(otherToken);
    await request(app.getHttpServer()).post(`/v1/me/orders/${another.code}/dispute`).set(auth(buyerToken))
      .send({ reason: 'other', description: 'This attempts to attach another buyer evidence.', uploadIds: [foreign.id] }).expect(400);
  });

  it('serializes duplicate reports and competing evidence references', async () => {
    const delivered = await order('delivered');
    const duplicateBody = { reason: 'other', description: 'The delivered order needs customer support review.' };
    const duplicates = await Promise.all([
      request(app.getHttpServer()).post(`/v1/me/orders/${delivered.code}/dispute`).set(auth(buyerToken)).send(duplicateBody),
      request(app.getHttpServer()).post(`/v1/me/orders/${delivered.code}/dispute`).set(auth(buyerToken)).send(duplicateBody),
    ]);
    expect(duplicates.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await prisma.dispute.count({ where: { orderId: delivered.id } })).toBe(1);

    const first = await order('delivered');
    const second = await order('delivered');
    const evidence = await upload();
    const evidenceBody = { ...duplicateBody, uploadIds: [evidence.id] };
    const competing = await Promise.all([first, second].map((target) =>
      request(app.getHttpServer()).post(`/v1/me/orders/${target.code}/dispute`).set(auth(buyerToken)).send(evidenceBody),
    ));
    expect(competing.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(competing.find((response) => response.status === 409)?.body.code).toBe('uploads.alreadyUsed');
    expect(await prisma.disputeAttachment.count({ where: { uploadId: evidence.id } })).toBe(1);
  });

  it('supports admin review/finalization and blocks completion while active', async () => {
    const delivered = await order('delivered');
    const opened = await request(app.getHttpServer()).post(`/v1/me/orders/${delivered.code}/dispute`).set(auth(buyerToken))
      .send({ reason: 'fish_unwell', description: 'The fish show signs of illness after arrival.' }).expect(201);
    await request(app.getHttpServer()).post(`/v1/me/orders/${delivered.code}/confirm-delivery`).set(auth(buyerToken))
      .expect(409).expect(({ body }) => expect(body.code).toBe('order.openDispute'));
    await request(app.getHttpServer()).get('/v1/admin/disputes').set(auth(buyerToken)).expect(403);
    const reviewing = await request(app.getHttpServer()).post(`/v1/admin/disputes/${opened.body.id}/start-review`).set(auth(adminToken)).expect(200);
    expect(reviewing.body.status).toBe('reviewing');
    await request(app.getHttpServer()).post(`/v1/admin/disputes/${opened.body.id}/resolve`).set(auth(adminToken))
      .send({ resolution: '   ' }).expect(400);
    const resolved = await request(app.getHttpServer()).post(`/v1/admin/disputes/${opened.body.id}/resolve`).set(auth(adminToken))
      .send({ resolution: 'Customer contacted; replacement arranged.' }).expect(200);
    expect(resolved.body).toMatchObject({ status: 'resolved', resolution: 'Customer contacted; replacement arranged.' });
    expect(resolved.body.resolvedAt).toBeTruthy();
    await request(app.getHttpServer()).post(`/v1/me/orders/${delivered.code}/confirm-delivery`).set(auth(buyerToken)).expect(200)
      .expect(({ body }) => expect(body.status).toBe('completed'));
    await request(app.getHttpServer()).post(`/v1/admin/disputes/${opened.body.id}/reject`).set(auth(adminToken))
      .send({ resolution: 'Too late' }).expect(409);
  });
});
