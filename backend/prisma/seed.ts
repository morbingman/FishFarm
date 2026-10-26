import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

const COMPANY_ID = 'fishfarm';
const FACILITY_ID = 'fishfarm-main';
const COMPANY_NAME = 'FishFarm';

const PHOTO = (id: string) =>
  `https://images.unsplash.com/${id}?w=1000&h=750&fit=crop&auto=format`;

const PHOTOS = [
  'photo-1516408388733-2f8364f2e00b',
  'photo-1522720833375-9c27ffb02a5e',
  'photo-1572438131134-ec29490abfba',
  'photo-1640529837996-b81a91eaf7a5',
  'photo-1663892318998-d4b1a5acde66',
  'photo-1668349009169-93e19d2eba7a',
].map(PHOTO);

async function hash(password: string) {
  return argon2.hash(password);
}

async function resetDemoData() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
    throw new Error('Refusing to reset demo data in production. Set ALLOW_DEMO_SEED=1 to override.');
  }

  // Children first — mirrors the FK graph.
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.escrowRelease.deleteMany(),
    prisma.adjustment.deleteMany(),
    prisma.sponsorship.deleteMany(),
    prisma.harvest.deleteMany(),
    prisma.batchUpdatePhoto.deleteMany(),
    prisma.batchUpdate.deleteMany(),
    prisma.batchCostItem.deleteMany(),
    prisma.batchImage.deleteMany(),
    prisma.growOutBatch.deleteMany(),
    prisma.verificationDocument.deleteMany(),
    prisma.farmVerification.deleteMany(),
    prisma.disputeAttachment.deleteMany(),
    prisma.dispute.deleteMany(),
    prisma.review.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.listingHistory.deleteMany(),
    prisma.listingImage.deleteMany(),
    prisma.listingDraft.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verificationCode.deleteMany(),
    prisma.upload.deleteMany(),
    prisma.sequence.deleteMany(),
    prisma.user.deleteMany(),
    prisma.facility.deleteMany(),
    prisma.company.deleteMany(),
  ]);
}

type SeedUser = {
  email: string;
  password: string;
  name: string;
  role: 'User' | 'Admin';
  status?: 'active' | 'suspended';
};

type SeededUser = { id: string; name: string };

async function seedCompany() {
  const company = await prisma.company.create({
    data: {
      id: COMPANY_ID,
      name: COMPANY_NAME,
      about:
        'FishFarm breeds, grows out and delivers aquatic livestock from our own facilities. Every fish in the catalog is raised and sold by our team.',
      location: 'Ho Chi Minh City',
      phone: '+84 28 3822 1234',
      email: 'hello@fishfarm.vn',
      joinedAt: new Date('2024-03-12T00:00:00.000Z'),
    },
  });

  await prisma.facility.create({
    data: {
      id: FACILITY_ID,
      companyId: company.id,
      name: 'Long An grow-out facility',
      location: 'Long An',
      region: 'Long An',
    },
  });
}

async function seedUsers() {
  const users: SeedUser[] = [
    { email: 'buyer@fishmarket.demo', password: 'Buyer123', name: 'Alex Nguyen', role: 'User' },
    { email: 'admin@fishmarket.demo', password: 'Admin123', name: 'Company Admin', role: 'Admin' },
    { email: 'ops@fishmarket.demo', password: 'Ops12345', name: 'Operations Admin', role: 'Admin' },
    { email: 'linh@fishmarket.demo', password: 'Demo1234', name: 'Linh Tran', role: 'User' },
    {
      email: 'minh@fishmarket.demo',
      password: 'Demo1234',
      name: 'Minh Pham',
      role: 'User',
      status: 'suspended',
    },
  ];

  const byEmail = new Map<string, SeededUser>();
  for (const user of users) {
    const created = await prisma.user.create({
      data: {
        email: user.email,
        passwordHash: await hash(user.password),
        name: user.name,
        role: user.role,
        status: user.status ?? 'active',
        phone: '+84 90 123 4567',
        location: 'Ho Chi Minh City',
        joinedAt: new Date('2024-03-12T00:00:00.000Z'),
        emailVerifiedAt: new Date('2024-03-12T00:00:00.000Z'),
      },
    });
    byEmail.set(user.email, { id: created.id, name: created.name });
  }
  return byEmail;
}

type SeedListing = {
  code: string;
  status: 'draft' | 'pending' | 'approved';
  name: string;
  species: string;
  breed: string;
  price: number;
  sizeCm: number;
  images: string[];
  mainIndex: number;
  hoursAgo: number;
  views?: number;
  saleMode?: 'in_stock' | 'pre_order';
  depositPct?: number;
  expectedReadyDate?: Date;
  preorderPolicy?: string;
};

type SeededListing = { id: string; price: number; saleMode: 'in_stock' | 'pre_order'; depositPct: number | null };

async function seedListings(admins: SeededUser[]) {
  const author = admins[0];
  const created = new Map<string, SeededListing>();

  const listings: SeedListing[] = [
    {
      code: 'FM-20817',
      status: 'pending',
      name: 'Betta Halfmoon Blue',
      species: 'Betta',
      breed: 'Halfmoon',
      price: 38,
      sizeCm: 6,
      images: [PHOTOS[3]],
      mainIndex: 0,
      hoursAgo: 20,
    },
    {
      code: 'FM-20803',
      status: 'pending',
      name: 'Arowana Silver 28 cm',
      species: 'Arowana',
      breed: 'Silver',
      price: 260,
      sizeCm: 28,
      images: [PHOTOS[4]],
      mainIndex: 0,
      hoursAgo: 30,
    },
    {
      code: 'FM-19544',
      status: 'approved',
      name: 'Kohaku Koi, 40 cm',
      species: 'Koi',
      breed: 'Kohaku',
      price: 720,
      sizeCm: 40,
      images: [PHOTOS[0], PHOTOS[1]],
      mainIndex: 0,
      hoursAgo: 48,
      views: 1204,
    },
    {
      code: 'FM-19102',
      status: 'approved',
      name: 'Ginrin Chagoi',
      species: 'Koi',
      breed: 'Chagoi',
      price: 310,
      sizeCm: 35,
      images: [PHOTOS[2]],
      mainIndex: 0,
      hoursAgo: 120,
      views: 846,
    },
    {
      code: 'FM-18877',
      status: 'approved',
      name: 'Oranda Goldfish Pair',
      species: 'Goldfish',
      breed: 'Oranda',
      price: 95,
      sizeCm: 12,
      images: [PHOTOS[4]],
      mainIndex: 0,
      hoursAgo: 170,
      views: 512,
    },
    {
      code: 'FM-18420',
      status: 'approved',
      name: 'Discus Pigeon Blood',
      species: 'Discus',
      breed: 'Pigeon Blood',
      price: 120,
      sizeCm: 14,
      images: [PHOTOS[5]],
      mainIndex: 0,
      hoursAgo: 300,
      views: 233,
    },
    {
      // §3.8 pre-order example: 25% deposit, balance on mark-ready.
      code: 'FM-20761',
      status: 'approved',
      name: 'Kohaku Grow-out Reservation, 25–30 cm',
      species: 'Koi',
      breed: 'Kohaku',
      price: 450,
      sizeCm: 25,
      images: [PHOTOS[1], PHOTOS[2]],
      mainIndex: 0,
      hoursAgo: 96,
      views: 388,
      saleMode: 'pre_order',
      depositPct: 25,
      expectedReadyDate: daysFromNow(45),
      preorderPolicy:
        '25% deposit reserves your fish. The balance is due within 7 days of the company marking the order ready. If the balance is missed, the order is cancelled and the deposit refunded in full.',
    },
  ];

  for (const item of listings) {
    const createdAt = ago(item.hoursAgo + 5);
    const updatedAt = ago(item.hoursAgo);
    const submittedAt = ago(item.hoursAgo + 1);

    const listing = await prisma.listing.create({
      data: {
        code: item.code,
        companyId: COMPANY_ID,
        companyName: COMPANY_NAME,
        createdById: author.id,
        status: item.status,
        views: item.views ?? 0,
        createdAt,
        updatedAt,
        submittedAt,
        draft: {
          create: {
            name: item.name,
            species: item.species,
            breed: item.breed,
            description:
              'Healthy, well-conditioned stock raised in clean water and fed a premium diet. Photographed in natural light.',
            ageMonths: 12,
            sizeCm: item.sizeCm,
            gender: 'Female',
            origin: 'Vietnam — farm bred',
            health: 'Excellent — vet certified',
            price: item.price,
            quantity: 2,
            negotiable: false,
            location: '128 Nguyen Van Huong, Thao Dien',
            region: 'Ho Chi Minh City',
            shipping: ['Local pickup', 'Domestic overnight'],
            saleMode: item.saleMode ?? 'in_stock',
            depositPct: item.depositPct,
            expectedReadyDate: item.expectedReadyDate,
            preorderPolicy: item.preorderPolicy,
            images: {
              create: item.images.map((url, index) => ({
                url,
                position: index,
                isMain: index === item.mainIndex,
              })),
            },
          },
        },
        history: {
          create: [
            { at: createdAt, actorId: author.id, actorLabel: author.name, action: 'Created draft' },
            {
              at: submittedAt,
              actorId: author.id,
              actorLabel: author.name,
              action: 'Submitted for internal review',
            },
            ...(item.status === 'approved'
              ? [{ at: updatedAt, actorLabel: 'Company Admin', action: 'Approved' }]
              : []),
          ],
        },
      },
    });
    created.set(item.code, {
      id: listing.id,
      price: item.price,
      saleMode: item.saleMode ?? 'in_stock',
      depositPct: item.depositPct ?? null,
    });
    console.log(`  listing ${listing.code} — ${item.name}`);
  }

  return created;
}

async function seedNotifications(users: Map<string, SeededUser>) {
  await prisma.notification.createMany({
    data: [
      {
        recipientRole: 'Admin',
        type: 'reminder',
        titleKey: 'notifications.admin.pendingQueue.title',
        titleParams: { count: 2 },
        bodyKey: 'notifications.admin.pendingQueue.body',
        bodyParams: { names: 'Betta Halfmoon Blue, Arowana Silver 28 cm', hours: 20 },
        link: '#admin/queue?tab=pending',
        createdAt: ago(1),
      },
      {
        recipientId: users.get('admin@fishmarket.demo')!.id,
        type: 'system',
        titleKey: 'notifications.company.welcome.title',
        bodyKey: 'notifications.company.welcome.body',
        link: '#company',
        createdAt: ago(72),
      },
      {
        recipientId: users.get('buyer@fishmarket.demo')!.id,
        type: 'system',
        titleKey: 'notifications.buyer.welcome.title',
        bodyKey: 'notifications.buyer.welcome.body',
        link: '#marketplace',
        createdAt: ago(72),
      },
    ],
  });
}

async function seedActivity(users: Map<string, SeededUser>) {
  await prisma.activity.createMany({
    data: [
      {
        actorId: users.get('admin@fishmarket.demo')!.id,
        actorLabel: 'Company Admin',
        role: 'Admin',
        action: 'Approved listing',
        target: 'Kohaku Koi, 40 cm',
        link: '#admin/review/FM-19544',
        createdAt: ago(48),
      },
      {
        actorId: users.get('ops@fishmarket.demo')!.id,
        actorLabel: 'Operations Admin',
        role: 'Admin',
        action: 'Submitted listing for review',
        target: 'Betta Halfmoon Blue',
        link: '#admin/review/FM-20817',
        createdAt: ago(20),
      },
    ],
  });
}

async function seedBatch(users: Map<string, SeededUser>, author: SeededUser) {
  const buyerId = users.get('buyer@fishmarket.demo')!.id;

  const batch = await prisma.growOutBatch.create({
    data: {
      code: 'BATCH-1024',
      companyId: COMPANY_ID,
      facilityId: FACILITY_ID,
      createdById: author.id,
      title: 'Kohaku Grow-out — Autumn 2026',
      species: 'Koi',
      breed: 'Kohaku',
      description:
        'A 400-fish Kohaku grow-out in recirculating ponds in Long An. The package covers equipment, feed, daily care, health checks and transport to the delivery hub. Sponsors receive 5 kg of harvested koi per share.',
      status: 'open',
      location: 'Long An',
      region: 'Long An',
      stockingDate: new Date('2026-10-20T00:00:00.000Z'),
      expectedHarvestDate: new Date('2027-04-15T00:00:00.000Z'),
      stockCount: 400,
      shareUnitType: 'weight',
      shareUnit: '5 kg',
      shareQuantity: 5000,
      expectedHarvestWeightG: 200000,
      totalShares: 40,
      sharesAvailable: 38,
      packagePricePerShare: 2_400_000,
      contingencyPct: 10,
      riskDisclosure:
        'Fish farming carries mortality and weather risk. A 10% contingency is built into the package. If the harvest falls short, undelivered value is refunded pro rata from escrow, or the sponsor may choose partial delivery plus a refund. Total loss is refunded in full.',
      termsVersion: '2026-10-18',
      farmVerified: true,
      inspectedAt: new Date('2026-09-20T00:00:00.000Z'),
      inspector: 'Company Admin',
      submittedAt: ago(220),
      reviewedAt: ago(200),
      reviewedBy: 'Company Admin',
      images: {
        create: [
          { url: PHOTOS[0], position: 0, isMain: true },
          { url: PHOTOS[1], position: 1, isMain: false },
        ],
      },
      costBreakdown: {
        create: [
          {
            category: 'equipment',
            label: 'Aerators, pumps and nets (amortised over 40 shares)',
            amount: 8_000_000,
            allocation: 'batch_total',
            note: 'Company-owned and reusable across batches.',
          },
          { category: 'feed', label: 'Premium koi feed', amount: 1_250_000, allocation: 'per_share' },
          {
            category: 'labour',
            label: 'Daily care and monitoring',
            amount: 380_000,
            allocation: 'per_share',
          },
          {
            category: 'health',
            label: 'Quarantine and vet checks',
            amount: 130_000,
            allocation: 'per_share',
          },
          {
            category: 'transport',
            label: 'Farm to delivery hub',
            amount: 140_000,
            allocation: 'per_share',
          },
          { category: 'platform_fee', label: 'Platform fee', amount: 100_000, allocation: 'per_share' },
          {
            category: 'contingency',
            label: '10% contingency buffer',
            amount: 200_000,
            allocation: 'per_share',
            note: 'Covers feed and energy swings. The company bears overruns beyond this.',
          },
        ],
      },
    },
  });

  const packageAmount = 2 * 2_400_000;
  const deliveryFee = 50_000;
  const sponsorship = await prisma.sponsorship.create({
    data: {
      batchId: batch.id,
      sponsorId: buyerId,
      shares: 2,
      packageAmount,
      deliveryFee,
      totalAmount: packageAmount + deliveryFee,
      status: 'funded',
      recipientName: 'Alex Nguyen',
      phone: '+84 90 123 4567',
      address: '12 Le Loi, District 1',
      city: 'Ho Chi Minh City',
      province: 'Ho Chi Minh City',
      deliveryMethod: 'Domestic overnight',
      termsSnapshot: {
        termsVersion: '2026-10-18',
        shareUnit: '5 kg',
        shareUnitType: 'weight',
        packagePricePerShare: 2_400_000,
        contingencyPct: 10,
        harvestWindow: { from: '2027-04-15', to: '2027-05-15' },
        shortfallPolicy: 'pro_rata_refund',
        totalLossPolicy: 'full_refund',
        deliveryFeeDueAtHarvest: true,
      },
      paidAt: ago(30),
      escrowReleases: {
        create: [
          { milestone: 'stocking', amount: 1_440_000, state: 'held' },
          { milestone: 'mid_growth', amount: 1_920_000, state: 'held' },
          { milestone: 'harvest', amount: 1_440_000, state: 'held' },
        ],
      },
      payments: {
        create: {
          purpose: 'sponsorship_package',
          method: 'bank_transfer',
          provider: 'simulated',
          providerRef: 'SIM-SPONSORSHIP-1024',
          idempotencyKey: 'seed-sponsorship-BATCH-1024-buyer',
          amount: packageAmount,
          state: 'paid',
          paidAt: ago(30),
        },
      },
    },
  });

  console.log(`  batch ${batch.code} — ${batch.title}`);
  console.log(`  sponsorship ${sponsorship.id} — ${sponsorship.shares} shares`);
}

async function seedFarmVerification() {
  await prisma.farmVerification.create({
    data: {
      facilityId: FACILITY_ID,
      level: 'inspected',
      status: 'approved',
      inspectedAt: new Date('2026-09-20T00:00:00.000Z'),
      inspector: 'Company Admin',
      notes: 'Pond capacity, water source and biosecurity verified on site.',
      validUntil: new Date('2027-09-20T00:00:00.000Z'),
      submittedAt: new Date('2026-09-01T00:00:00.000Z'),
      reviewedAt: new Date('2026-09-20T00:00:00.000Z'),
      reviewedBy: 'Company Admin',
      documents: {
        create: [
          {
            type: 'business_registration',
            url: 'https://storage.fishfarm.local/demo/fishfarm/business.pdf',
          },
          {
            type: 'owner_identity',
            url: 'https://storage.fishfarm.local/demo/fishfarm/identity.pdf',
          },
          {
            type: 'land_use_rights',
            url: 'https://storage.fishfarm.local/demo/fishfarm/lease.pdf',
          },
          {
            type: 'environmental_permit',
            url: 'https://storage.fishfarm.local/demo/fishfarm/water-permit.pdf',
          },
          {
            type: 'veterinary_records',
            url: 'https://storage.fishfarm.local/demo/fishfarm/quarantine.pdf',
          },
          {
            type: 'site_photos',
            url: 'https://storage.fishfarm.local/demo/fishfarm/site.zip',
          },
          {
            type: 'bank_account',
            url: 'https://storage.fishfarm.local/demo/fishfarm/bank.pdf',
          },
        ],
      },
    },
  });
}

async function seedOrders(
  users: Map<string, SeededUser>,
  listings: Map<string, SeededListing>,
) {
  const buyer = users.get('buyer@fishmarket.demo')!;
  const linh = users.get('linh@fishmarket.demo')!;

  // Dates are relative so the demo always shows a fresh-looking history.
  const demo = [
    {
      buyer,
      code: 'ORD-10021',
      listingCode: 'FM-19544',
      quantity: 1,
      shippingFee: 18,
      status: 'completed',
      paymentStatus: 'paid',
      deliveryMethod: 'Domestic overnight',
      placedAt: ago(720),
      paidAt: ago(720),
      readyAt: ago(700),
      deliveredAt: ago(672),
      completedAt: ago(660),
    },
    {
      buyer,
      code: 'ORD-10022',
      listingCode: 'FM-18877',
      quantity: 2,
      shippingFee: 12,
      status: 'shipped',
      paymentStatus: 'paid',
      deliveryMethod: 'Domestic overnight',
      placedAt: ago(52),
      paidAt: ago(52),
      readyAt: ago(30),
    },
    {
      buyer,
      code: 'ORD-10023',
      listingCode: 'FM-20761',
      quantity: 1,
      shippingFee: 0,
      status: 'ready',
      paymentStatus: 'balance_due',
      deliveryMethod: 'Local pickup',
      placedAt: ago(96),
      paidAt: ago(96),
      readyAt: ago(4),
    },
    {
      buyer: linh,
      code: 'ORD-10024',
      listingCode: 'FM-19102',
      quantity: 1,
      shippingFee: 15,
      status: 'paid',
      paymentStatus: 'paid',
      deliveryMethod: 'Domestic overnight',
      placedAt: ago(20),
      paidAt: ago(20),
    },
    {
      buyer: linh,
      code: 'ORD-10025',
      listingCode: 'FM-18420',
      quantity: 3,
      shippingFee: 10,
      status: 'cancelled',
      paymentStatus: 'refunded',
      deliveryMethod: 'Domestic overnight',
      placedAt: ago(200),
      paidAt: ago(200),
      cancelledAt: ago(190),
      refundedAt: ago(190),
    },
  ] as const;

  for (const [index, order] of demo.entries()) {
    const listing = listings.get(order.listingCode)!;
    const subtotal = listing.price * order.quantity;
    const total = subtotal + order.shippingFee;
    const isPreOrder = listing.saleMode === 'pre_order';
    const depositAmount =
      isPreOrder && listing.depositPct !== null
        ? Math.round((total * listing.depositPct) / 100)
        : null;
    const balanceAmount = depositAmount === null ? null : total - depositAmount;

    await prisma.order.create({
      data: {
        code: order.code,
        buyerId: order.buyer.id,
        companyId: COMPANY_ID,
        status: order.status,
        saleMode: isPreOrder ? 'pre_order' : 'in_stock',
        paymentStatus: order.paymentStatus,
        subtotal,
        shippingFee: order.shippingFee,
        total,
        depositAmount,
        balanceAmount,
        balanceDueAt:
          isPreOrder && order.status === 'ready' ? daysFromNow(7) : null,
        recipientName: order.buyer.name,
        phone: '+84 90 123 4567',
        address: '42 Nguyen Hue, District 1',
        city: 'Ho Chi Minh City',
        province: 'Ho Chi Minh City',
        deliveryMethod: order.deliveryMethod,
        placedAt: order.placedAt,
        paidAt: order.paidAt,
        readyAt: 'readyAt' in order ? order.readyAt : undefined,
        deliveredAt: 'deliveredAt' in order ? order.deliveredAt : undefined,
        completedAt: 'completedAt' in order ? order.completedAt : undefined,
        cancelledAt: 'cancelledAt' in order ? order.cancelledAt : undefined,
        refundedAt: 'refundedAt' in order ? order.refundedAt : undefined,
        items: {
          create: {
            listingId: listing.id,
            saleMode: isPreOrder ? 'pre_order' : 'in_stock',
            quantity: order.quantity,
            unitPrice: listing.price,
            lineTotal: subtotal,
          },
        },
        payments: {
          create: {
            purpose:
              isPreOrder && depositAmount !== null ? 'order_deposit' : 'order_full',
            method: index % 2 === 0 ? 'bank_card' : 'e_wallet',
            idempotencyKey: `seed:${order.code}:initial`,
            amount: depositAmount ?? total,
            state: order.paymentStatus === 'refunded' ? 'refunded' : 'paid',
            paidAt: order.paidAt,
            refundedAt: 'refundedAt' in order ? order.refundedAt : undefined,
          },
        },
      },
    });
    console.log(`  order ${order.code} — ${order.status}`);
  }
}

async function seedCart(users: Map<string, SeededUser>, listings: Map<string, SeededListing>) {
  await prisma.cartItem.createMany({
    data: [
      {
        userId: users.get('buyer@fishmarket.demo')!.id,
        listingId: listings.get('FM-19102')!.id,
        quantity: 1,
      },
      {
        userId: users.get('buyer@fishmarket.demo')!.id,
        listingId: listings.get('FM-18877')!.id,
        quantity: 2,
      },
    ],
  });
}

async function main() {
  console.log('Resetting demo data…');
  await resetDemoData();

  console.log('Seeding company…');
  await seedCompany();

  console.log('Seeding users…');
  const users = await seedUsers();
  const admins = ['admin@fishmarket.demo', 'ops@fishmarket.demo'].map((email) => users.get(email)!);

  console.log('Seeding listings…');
  const listings = await seedListings(admins);

  console.log('Seeding orders…');
  await seedOrders(users, listings);
  await seedCart(users, listings);

  await seedNotifications(users);
  await seedActivity(users);
  await seedFarmVerification();

  console.log('Seeding batch sponsorship…');
  await seedBatch(users, admins[0]);

  await prisma.sequence.createMany({
    data: [
      { name: 'listing', value: 48_300 },
      { name: 'order', value: 10_025 },
      { name: 'batch', value: 1_024 },
    ],
  });

  console.log('Seed complete.');
  console.log('Demo accounts:');
  console.log('  buyer@fishmarket.demo / Buyer123 (User)');
  console.log('  admin@fishmarket.demo / Admin123 (Admin)');
  console.log('  ops@fishmarket.demo / Ops12345 (Admin)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
