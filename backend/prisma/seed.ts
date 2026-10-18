import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

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
  ]);
}

type SeedUser = {
  email: string;
  password: string;
  name: string;
  role: 'Buyer' | 'Seller' | 'Admin';
  status?: 'active' | 'suspended';
  store?: string;
};

async function seedUsers() {
  const users: SeedUser[] = [
    { email: 'buyer@fishmarket.demo', password: 'Buyer123', name: 'Alex Nguyen', role: 'Buyer' },
    {
      email: 'seller@fishmarket.demo',
      password: 'Seller123',
      name: 'Golden Koi Farm',
      role: 'Seller',
      store: 'Golden Koi Farm',
    },
    { email: 'admin@fishmarket.demo', password: 'Admin123', name: 'Marketplace Admin', role: 'Admin' },
    {
      email: 'lagoon@fishmarket.demo',
      password: 'Demo1234',
      name: 'Blue Lagoon Aquatics',
      role: 'Seller',
      store: 'Blue Lagoon Aquatics',
    },
    {
      email: 'mekong@fishmarket.demo',
      password: 'Demo1234',
      name: 'Mekong Aroworld',
      role: 'Seller',
      store: 'Mekong Aroworld',
    },
    { email: 'linh@fishmarket.demo', password: 'Demo1234', name: 'Linh Tran', role: 'Buyer' },
    {
      email: 'minh@fishmarket.demo',
      password: 'Demo1234',
      name: 'Minh Pham',
      role: 'Buyer',
      status: 'suspended',
    },
  ];

  const byEmail = new Map<string, { id: string; name: string }>();
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
        store: user.store,
        emailVerifiedAt: new Date('2024-03-12T00:00:00.000Z'),
      },
    });
    byEmail.set(user.email, { id: created.id, name: created.name });
  }
  return byEmail;
}

type SeedListing = {
  code: string;
  owner: string;
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

async function seedListings(users: Map<string, { id: string; name: string }>) {
  const listings: SeedListing[] = [
    {
      code: 'FM-20817',
      owner: 'lagoon@fishmarket.demo',
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
      owner: 'mekong@fishmarket.demo',
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
      owner: 'seller@fishmarket.demo',
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
      owner: 'seller@fishmarket.demo',
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
      owner: 'seller@fishmarket.demo',
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
      owner: 'lagoon@fishmarket.demo',
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
      owner: 'seller@fishmarket.demo',
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
        '25% deposit reserves your fish. The balance is due within 7 days of the seller marking the order ready. If the balance is missed, the order is cancelled and the deposit refunded in full.',
    },
  ];

  for (const item of listings) {
    const owner = users.get(item.owner)!;
    const seller = await prisma.user.findUniqueOrThrow({ where: { email: item.owner } });
    const createdAt = ago(item.hoursAgo + 5);
    const updatedAt = ago(item.hoursAgo);
    const submittedAt = ago(item.hoursAgo + 1);

    const listing = await prisma.listing.create({
      data: {
        code: item.code,
        ownerId: owner.id,
        sellerName: seller.store ?? seller.name,
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
            { at: createdAt, actorId: owner.id, actorLabel: owner.name, action: 'Created draft' },
            { at: submittedAt, actorId: owner.id, actorLabel: owner.name, action: 'Submitted for review' },
            ...(item.status === 'approved'
              ? [
                  {
                    at: ago(item.hoursAgo),
                    actorLabel: 'Marketplace Admin',
                    action: 'Approved',
                  },
                ]
              : []),
          ],
        },
      },
    });
    console.log(`  listing ${listing.code} — ${item.name}`);
  }
}

async function seedNotifications(users: Map<string, { id: string; name: string }>) {
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
        recipientId: users.get('seller@fishmarket.demo')!.id,
        type: 'system',
        titleKey: 'notifications.seller.welcome.title',
        bodyKey: 'notifications.seller.welcome.body',
        link: '#seller/add',
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

async function seedActivity(users: Map<string, { id: string; name: string }>) {
  await prisma.activity.createMany({
    data: [
      {
        actorLabel: 'Marketplace Admin',
        role: 'Admin',
        action: 'Approved listing',
        target: 'Kohaku Koi, 40 cm',
        link: '#admin/review/FM-19544',
        createdAt: ago(48),
      },
      {
        actorId: users.get('lagoon@fishmarket.demo')!.id,
        actorLabel: 'Blue Lagoon Aquatics',
        role: 'Seller',
        action: 'Submitted listing for review',
        target: 'Betta Halfmoon Blue',
        link: '#admin/review/FM-20817',
        createdAt: ago(20),
      },
    ],
  });
}

async function seedBatch(users: Map<string, { id: string; name: string }>) {
  const sellerId = users.get('seller@fishmarket.demo')!.id;
  const buyerId = users.get('buyer@fishmarket.demo')!.id;

  const batch = await prisma.growOutBatch.create({
    data: {
      code: 'BATCH-1024',
      sellerId,
      title: 'Golden Kohaku Grow-out — Autumn 2026',
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
      expectedHarvestWeightG: 5000,
      totalShares: 40,
      sharesAvailable: 38,
      packagePricePerShare: 2_400_000,
      contingencyPct: 10,
      riskDisclosure:
        'Fish farming carries mortality and weather risk. A 10% contingency is built into the package. If the harvest falls short, undelivered value is refunded pro rata from escrow, or the sponsor may choose partial delivery plus a refund. Total loss is refunded in full.',
      termsVersion: '2026-10-18',
      farmVerified: true,
      inspectedAt: new Date('2026-09-20T00:00:00.000Z'),
      inspector: 'Marketplace Admin',
      submittedAt: ago(220),
      reviewedAt: ago(200),
      reviewedBy: 'Marketplace Admin',
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
            note: 'Farm-owned and reusable across batches.',
          },
          { category: 'feed', label: 'Premium koi feed', amount: 1_250_000, allocation: 'per_share' },
          { category: 'labour', label: 'Daily care and monitoring', amount: 380_000, allocation: 'per_share' },
          { category: 'health', label: 'Quarantine and vet checks', amount: 130_000, allocation: 'per_share' },
          { category: 'transport', label: 'Farm to delivery hub', amount: 140_000, allocation: 'per_share' },
          { category: 'platform_fee', label: 'Platform fee', amount: 100_000, allocation: 'per_share' },
          {
            category: 'contingency',
            label: '10% contingency buffer',
            amount: 200_000,
            allocation: 'per_share',
            note: 'Covers feed and energy swings. The farm bears overruns beyond this.',
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

async function seedFarmVerification(users: Map<string, { id: string; name: string }>) {
  await prisma.farmVerification.create({
    data: {
      sellerId: users.get('seller@fishmarket.demo')!.id,
      level: 'inspected',
      status: 'approved',
      inspectedAt: new Date('2026-09-20T00:00:00.000Z'),
      inspector: 'Marketplace Admin',
      notes: 'Pond capacity, water source and biosecurity verified on site.',
      validUntil: new Date('2027-09-20T00:00:00.000Z'),
      submittedAt: new Date('2026-09-01T00:00:00.000Z'),
      reviewedAt: new Date('2026-09-20T00:00:00.000Z'),
      reviewedBy: 'Marketplace Admin',
      documents: {
        create: [
          { type: 'business_registration', url: 'https://storage.fishfarm.local/demo/golden-koi/business.pdf' },
          { type: 'owner_identity', url: 'https://storage.fishfarm.local/demo/golden-koi/identity.pdf' },
          { type: 'land_use_rights', url: 'https://storage.fishfarm.local/demo/golden-koi/lease.pdf' },
          { type: 'environmental_permit', url: 'https://storage.fishfarm.local/demo/golden-koi/water-permit.pdf' },
          { type: 'veterinary_records', url: 'https://storage.fishfarm.local/demo/golden-koi/quarantine.pdf' },
          { type: 'site_photos', url: 'https://storage.fishfarm.local/demo/golden-koi/site.zip' },
          { type: 'bank_account', url: 'https://storage.fishfarm.local/demo/golden-koi/bank.pdf' },
        ],
      },
    },
  });
}

async function main() {
  console.log('Resetting demo data…');
  await resetDemoData();

  console.log('Seeding users…');
  const users = await seedUsers();

  console.log('Seeding listings…');
  await seedListings(users);

  await seedNotifications(users);
  await seedActivity(users);
  await seedFarmVerification(users);

  console.log('Seeding batch sponsorship…');
  await seedBatch(users);

  await prisma.sequence.createMany({
    data: [
      { name: 'listing', value: 48_300 },
      { name: 'order', value: 10_000 },
      { name: 'batch', value: 1_024 },
    ],
  });

  console.log('Seed complete.');
  console.log('Demo accounts:');
  console.log('  buyer@fishmarket.demo / Buyer123');
  console.log('  seller@fishmarket.demo / Seller123');
  console.log('  admin@fishmarket.demo / Admin123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
