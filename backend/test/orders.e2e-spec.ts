import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';
const COMPANY_ID = 'fishfarm';

const DAY = 24 * 60 * 60 * 1000;

function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.floor(Math.random() * 10_000)}@example.com`;
}

describe('Cart and orders (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let buyerToken: string;
  let otherBuyerToken: string;
  let adminToken: string;
  let buyerEmail: string;
  let otherBuyerEmail: string;
  let adminEmail: string;
  let inStockCode: string;
  let preOrderCode: string;
  const createdCodes: string[] = [];
  const createdListingCodes: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: 'FishFarm' },
      update: {},
    });

    buyerEmail = uniqueEmail('orders-buyer');
    otherBuyerEmail = uniqueEmail('orders-other-buyer');
    adminEmail = uniqueEmail('orders-admin');

    buyerToken = (await register(buyerEmail)).accessToken;
    otherBuyerToken = (await register(otherBuyerEmail)).accessToken;
    await register(adminEmail);
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'Admin' } });
    adminToken = (await login(adminEmail)).accessToken;

    inStockCode = await createListing({
      name: 'E2E In-stock Koi',
      price: 1_000_000,
      quantity: 500,
      saleMode: 'in_stock',
    });
    preOrderCode = await createListing({
      name: 'E2E Pre-order Koi',
      price: 2_000_000,
      quantity: 2,
      saleMode: 'pre_order',
      depositPct: 25,
      expectedReadyDate: new Date(Date.now() + 30 * DAY),
    });
  });

  afterAll(async () => {
    const buyers = await prisma.user.findMany({
      where: { email: { in: [buyerEmail, otherBuyerEmail, adminEmail] } },
      select: { id: true },
    });
    const ids = buyers.map((user) => user.id);

    if (createdCodes.length > 0) {
      await prisma.payment.deleteMany({ where: { order: { code: { in: createdCodes } } } });
      await prisma.order.deleteMany({ where: { code: { in: createdCodes } } });
    }
    await prisma.cartItem.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: ids } } });
    await prisma.listing.deleteMany({ where: { code: { in: createdListingCodes } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  async function register(email: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: PASSWORD, name: `E2E ${email.split('@')[0]}` });
    expect(response.status).toBe(201);
    return response.body as { accessToken: string; user: { id: string } };
  }

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return response.body as { accessToken: string };
  }

  async function createListing(input: {
    name: string;
    price: number;
    quantity: number;
    saleMode: 'in_stock' | 'pre_order';
    depositPct?: number;
    expectedReadyDate?: Date;
  }): Promise<string> {
    const code = `FM-9${String(Date.now()).slice(-6)}${createdListingCodes.length}`;
    createdListingCodes.push(code);

    await prisma.listing.create({
      data: {
        code,
        companyId: COMPANY_ID,
        companyName: 'FishFarm',
        status: 'approved',
        submittedAt: new Date(),
        draft: {
          create: {
            name: input.name,
            species: 'Koi',
            breed: 'Kohaku',
            description: 'Healthy koi raised in clean water and fed a premium diet.',
            ageMonths: 12,
            sizeCm: 30,
            gender: 'Unsexed',
            origin: 'Vietnam — farm bred',
            health: 'Good — quarantined 14 days',
            price: input.price,
            quantity: input.quantity,
            location: 'Farm gate',
            region: 'Ho Chi Minh City',
            shipping: ['Local pickup'],
            saleMode: input.saleMode,
            depositPct: input.depositPct,
            expectedReadyDate: input.expectedReadyDate,
            images: {
              create: [{ url: 'https://images.example.com/e2e-orders.jpg', isMain: true }],
            },
          },
        },
      },
    });

    return code;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function placeOrder(
    token: string,
    body: Record<string, unknown> = {},
  ): Promise<{ id: string; status: string; paymentStatus: string }> {
    const response = await request(app.getHttpServer())
      .post('/v1/orders')
      .set(auth(token))
      .send({
        recipientName: 'E2E Buyer',
        phone: '+84 90 000 0000',
        address: '128 Nguyen Van Huong, Thao Dien',
        city: 'Ho Chi Minh City',
        deliveryMethod: 'Domestic overnight',
        paymentMethod: 'bank_card',
        ...body,
      });
    expect(response.status).toBe(201);
    const order = response.body as { id: string; status: string; paymentStatus: string };
    createdCodes.push(order.id);
    return order;
  }

  // ---------------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------------

  it('adds, updates and removes cart lines with live pricing', async () => {
    const empty = await request(app.getHttpServer())
      .get('/v1/me/cart')
      .set(auth(buyerToken))
      .expect(200);
    expect(empty.body).toMatchObject({ items: [], itemCount: 0, subtotal: 0, saleMode: null });

    const added = await request(app.getHttpServer())
      .post('/v1/me/cart/items')
      .set(auth(buyerToken))
      .send({ listingId: inStockCode, quantity: 2 })
      .expect(201);
    expect(added.body).toMatchObject({ itemCount: 2, subtotal: 2_000_000, saleMode: 'in_stock' });
    expect(added.body.items[0]).toMatchObject({
      code: inStockCode,
      price: 1_000_000,
      quantity: 2,
      lineTotal: 2_000_000,
      available: 500,
    });

    const updated = await request(app.getHttpServer())
      .patch(`/v1/me/cart/items/${inStockCode}`)
      .set(auth(buyerToken))
      .send({ quantity: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({ itemCount: 1, subtotal: 1_000_000 });

    const removed = await request(app.getHttpServer())
      .delete(`/v1/me/cart/items/${inStockCode}`)
      .set(auth(buyerToken))
      .expect(200);
    expect(removed.body).toMatchObject({ items: [], itemCount: 0 });
  });

  it('rejects quantities beyond available stock and non-catalog listings', async () => {
    const tooMany = await request(app.getHttpServer())
      .post('/v1/me/cart/items')
      .set(auth(buyerToken))
      .send({ listingId: inStockCode, quantity: 9_999 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body).toMatchObject({ code: 'cart.quantityExceedsStock' });

    const unknown = await request(app.getHttpServer())
      .post('/v1/me/cart/items')
      .set(auth(buyerToken))
      .send({ listingId: 'FM-00000' })
      .expect(404);
    expect(unknown.body.code).toBe('listing.notAvailable');
  });

  it('rejects checkout of an empty cart', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/orders')
      .set(auth(buyerToken))
      .send({
        recipientName: 'E2E Buyer',
        phone: '+84 90 000 0000',
        address: '128 Nguyen Van Huong',
        paymentMethod: 'bank_card',
      })
      .expect(400);
    expect(response.body.code).toBe('cart.empty');
  });

  // ---------------------------------------------------------------------------
  // In-stock orders
  // ---------------------------------------------------------------------------

  it('checks out the cart for full payment and clears it', async () => {
    await request(app.getHttpServer())
      .post('/v1/me/cart/items')
      .set(auth(buyerToken))
      .send({ listingId: inStockCode, quantity: 2 })
      .expect(201);

    const order = await placeOrder(buyerToken);
    expect(order).toMatchObject({ status: 'paid', paymentStatus: 'paid' });
    expect(order.id).toMatch(/^ORD-\d+$/);

    const detail = await request(app.getHttpServer())
      .get(`/v1/me/orders/${order.id}`)
      .set(auth(buyerToken))
      .expect(200);
    expect(detail.body).toMatchObject({
      id: order.id,
      subtotal: 2_000_000,
      shippingFee: 0,
      total: 2_000_000,
      depositAmount: null,
      balanceAmount: null,
      items: [{ code: inStockCode, quantity: 2, unitPrice: 1_000_000 }],
      payments: [{ purpose: 'order_full', state: 'paid', amount: 2_000_000 }],
      company: { id: COMPANY_ID },
    });

    const cart = await request(app.getHttpServer())
      .get('/v1/me/cart')
      .set(auth(buyerToken))
      .expect(200);
    expect(cart.body.itemCount).toBe(0);

    const draft = await prisma.listingDraft.findFirstOrThrow({
      where: { listing: { code: inStockCode } },
    });
    expect(draft.quantity).toBe(498);
  });

  it('shows orders only to their owner', async () => {
    const order = await placeOrder(buyerToken, {
      items: [{ listingId: inStockCode, quantity: 1 }],
    });

    await request(app.getHttpServer())
      .get(`/v1/me/orders/${order.id}`)
      .set(auth(otherBuyerToken))
      .expect(404);

    const mine = await request(app.getHttpServer())
      .get('/v1/me/orders')
      .set(auth(otherBuyerToken))
      .expect(200);
    expect(mine.body).toEqual([]);
  });

  it('moves an order through the company fulfilment steps', async () => {
    const order = await placeOrder(buyerToken, {
      items: [{ listingId: inStockCode, quantity: 1 }],
      idempotencyKey: `e2e-fulfil-${Date.now()}`,
    });

    const ready = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/mark-ready`)
      .set(auth(adminToken))
      .expect(200);
    expect(ready.body).toMatchObject({ status: 'ready', paymentStatus: 'paid' });

    const shipped = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/ship`)
      .set(auth(adminToken))
      .expect(200);
    expect(shipped.body.status).toBe('shipped');

    const delivered = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/deliver`)
      .set(auth(adminToken))
      .expect(200);
    expect(delivered.body.status).toBe('delivered');

    const completed = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/complete`)
      .set(auth(adminToken))
      .expect(200);
    expect(completed.body.status).toBe('completed');
  });

  it('cancels an order, refunds the payment and returns stock', async () => {
    const before = await prisma.listingDraft.findFirstOrThrow({
      where: { listing: { code: inStockCode } },
    });
    const order = await placeOrder(buyerToken, {
      items: [{ listingId: inStockCode, quantity: 2 }],
    });

    const cancelled = await request(app.getHttpServer())
      .post(`/v1/me/orders/${order.id}/cancel`)
      .set(auth(buyerToken))
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });

    const after = await prisma.listingDraft.findFirstOrThrow({
      where: { listing: { code: inStockCode } },
    });
    expect(after.quantity).toBe(before.quantity);

    const cancelledAgain = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/cancel`)
      .set(auth(adminToken))
      .send({ reason: 'Already refunded' });
    expect(cancelledAgain.status).toBe(409);
    expect(cancelledAgain.body.code).toBe('order.invalidTransition');
  });

  // ---------------------------------------------------------------------------
  // Pre-order orders
  // ---------------------------------------------------------------------------

  it('takes a deposit and opens the balance window when marked ready', async () => {
    const order = await placeOrder(buyerToken, {
      items: [{ listingId: preOrderCode, quantity: 1 }],
    });
    expect(order).toMatchObject({ status: 'paid', paymentStatus: 'deposit_paid' });

    const detail = await request(app.getHttpServer())
      .get(`/v1/me/orders/${order.id}`)
      .set(auth(buyerToken))
      .expect(200);
    expect(detail.body).toMatchObject({
      saleMode: 'pre_order',
      total: 2_000_000,
      depositAmount: 500_000,
      balanceAmount: 1_500_000,
      payments: [{ purpose: 'order_deposit', amount: 500_000 }],
    });

    const ready = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/mark-ready`)
      .set(auth(adminToken))
      .expect(200);
    expect(ready.body).toMatchObject({ status: 'ready', paymentStatus: 'balance_due' });
    expect(ready.body.balanceDueAt).toBeTruthy();

    const shippedEarly = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/ship`)
      .set(auth(adminToken));
    expect(shippedEarly.status).toBe(409);
    expect(shippedEarly.body.code).toBe('order.balanceOutstanding');

    const paid = await request(app.getHttpServer())
      .post(`/v1/me/orders/${order.id}/pay-balance`)
      .set(auth(buyerToken))
      .send({ paymentMethod: 'bank_transfer' })
      .expect(200);
    expect(paid.body).toMatchObject({ paymentStatus: 'paid', balanceDueAt: null });
    expect(paid.body.payments).toHaveLength(2);

    const shipped = await request(app.getHttpServer())
      .post(`/v1/company/orders/${order.id}/ship`)
      .set(auth(adminToken))
      .expect(200);
    expect(shipped.body.status).toBe('shipped');
  });

  it('rejects a balance payment on a non-pre-order', async () => {
    const order = await placeOrder(buyerToken, {
      items: [{ listingId: inStockCode, quantity: 1 }],
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/me/orders/${order.id}/pay-balance`)
      .set(auth(buyerToken))
      .send({ paymentMethod: 'bank_card' })
      .expect(409);
    expect(response.body.code).toBe('order.notPreOrder');
  });

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  it('keeps ordering User-only and company order management Admin-only', async () => {
    const adminOrder = await request(app.getHttpServer())
      .post('/v1/orders')
      .set(auth(adminToken))
      .send({
        recipientName: 'Company Admin',
        phone: '+84 90 000 0000',
        address: 'HQ',
        paymentMethod: 'bank_card',
        items: [{ listingId: inStockCode, quantity: 1 }],
      })
      .expect(403);
    expect(adminOrder.body.code).toBe('auth.forbidden');

    const userCompany = await request(app.getHttpServer())
      .get('/v1/company/orders')
      .set(auth(buyerToken))
      .expect(403);
    expect(userCompany.body.code).toBe('auth.forbidden');

    const company = await request(app.getHttpServer())
      .get('/v1/company/orders')
      .set(auth(adminToken))
      .expect(200);
    expect(Array.isArray(company.body)).toBe(true);
    expect(company.body.length).toBeGreaterThan(0);
    expect(company.body[0]).toHaveProperty('buyer');
  });

  it('filters company orders by status', async () => {
    const paid = await request(app.getHttpServer())
      .get('/v1/company/orders?status=paid')
      .set(auth(adminToken))
      .expect(200);
    expect(paid.body.every((order: { status: string }) => order.status === 'paid')).toBe(true);

    await request(app.getHttpServer())
      .get('/v1/company/orders?status=not-a-status')
      .set(auth(adminToken))
      .expect(400);
  });
});
