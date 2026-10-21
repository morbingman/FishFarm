import request from 'supertest';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  PRIVATE_UPLOAD_DIRECTORY,
  resolvePrivateUploadDir,
  resolveUploadDir,
} from '../src/uploads/upload.config.js';
import { createTestApp } from './test-app.js';

const PASSWORD = 'SecurePass123';
const COMPANY_ID = 'fishfarm';
const COMPANY_NAME = 'FishFarm';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('Uploads (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let adminToken: string;
  let otherAdminToken: string;
  let userToken: string;
  let adminId: string;
  let otherAdminId: string;
  let userId: string;
  const stamp = Date.now();
  const publicFiles: string[] = [];
  const privateFiles: string[] = [];
  const listingCodes: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.company.upsert({
      where: { id: COMPANY_ID },
      create: { id: COMPANY_ID, name: COMPANY_NAME },
      update: {},
    });

    const admin = await register('uploads.admin');
    adminId = admin.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: 'Admin' } });
    adminToken = admin.token;

    const other = await register('uploads.other-admin');
    otherAdminId = other.id;
    await prisma.user.update({ where: { id: otherAdminId }, data: { role: 'Admin' } });
    otherAdminToken = other.token;

    const user = await register('uploads.user');
    userId = user.id;
    userToken = user.token;
  });

  afterAll(async () => {
    if (listingCodes.length > 0) {
      await prisma.listing.deleteMany({ where: { code: { in: listingCodes } } });
    }
    const userIds = [adminId, otherAdminId, userId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const publicDir = resolveUploadDir(process.env.UPLOAD_DIR);
    const privateDir = resolvePrivateUploadDir(process.env.UPLOAD_DIR);
    await Promise.all([
      ...publicFiles.map((url) => unlink(join(publicDir, basename(url))).catch(() => undefined)),
      ...privateFiles.map((url) => unlink(join(privateDir, basename(url))).catch(() => undefined)),
    ]);
    await app.close();
  });

  async function register(prefix: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `${prefix}.${stamp}@example.com`,
        password: PASSWORD,
        name: `E2E ${prefix}`,
      })
      .expect(201);
    return {
      id: response.body.user.id as string,
      token: response.body.accessToken as string,
    };
  }

  function upload(
    token: string | undefined,
    purpose: string,
    content: Buffer = PNG,
    filename = 'fish.png',
    contentType = 'image/png',
  ) {
    const agent = request(app.getHttpServer()).post('/v1/uploads');
    if (token) agent.set('Authorization', `Bearer ${token}`);
    return agent.field('purpose', purpose).attach('file', content, { filename, contentType });
  }

  it('uploads an image, serves it and attaches it to a company listing', async () => {
    const response = await upload(adminToken, 'listing_image').expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      url: expect.stringMatching(/^\/uploads\/[0-9a-f-]+\.png$/),
      mimeType: 'image/png',
      sizeBytes: PNG.length,
      purpose: 'listing_image',
      isPrivate: false,
    });
    publicFiles.push(response.body.url as string);

    await request(app.getHttpServer())
      .get(response.body.url)
      .expect(200)
      .expect('Content-Type', /image\/png/);

    const listing = await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Uploaded photo koi', species: 'Koi', images: [{ url: response.body.url }] })
      .expect(201);
    listingCodes.push(listing.body.id);
    expect(listing.body.draft.images[0].url).toBe(response.body.url);
    expect(listing.body.draft.images[0].isMain).toBe(true);
  });

  it('accepts external image URLs and rejects unsupported schemes', async () => {
    const external = await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'External photo koi',
        species: 'Koi',
        images: [{ url: 'https://images.example.com/koi.jpg' }],
      })
      .expect(201);
    listingCodes.push(external.body.id);

    await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: [{ url: 'javascript:alert(1)' }] })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('listing.invalidImageUrl'));
  });

  it('lets any Admin reuse catalog media uploaded by another Admin', async () => {
    const owned = await upload(otherAdminToken, 'listing_image').expect(201);
    publicFiles.push(owned.body.url as string);

    const listing = await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: [{ url: owned.body.url }] })
      .expect(201);
    listingCodes.push(listing.body.id);
  });

  it('rejects unknown upload urls', async () => {
    await request(app.getHttpServer())
      .post('/v1/company/listings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ images: [{ url: `/uploads/${crypto.randomUUID()}.png` }] })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('uploads.notFound'));
  });

  it('enforces auth, role, purpose and file-type rules', async () => {
    await upload(undefined, 'listing_image').expect(401);

    await upload(userToken, 'listing_image')
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('uploads.forbidden'));

    await upload(adminToken, 'not_a_purpose')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('uploads.invalidPurpose'));

    await upload(adminToken, 'listing_image', Buffer.from('hello'), 'note.txt', 'text/plain')
      .expect(415)
      .expect(({ body }) => expect(body.code).toBe('uploads.unsupportedType'));

    await request(app.getHttpServer())
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('purpose', 'listing_image')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('uploads.fileRequired'));
  });

  it('stores company documents privately and keeps dispute evidence private', async () => {
    const farm = await upload(
      adminToken,
      'farm_document',
      PDF,
      'license.pdf',
      'application/pdf',
    ).expect(201);
    expect(farm.body).toMatchObject({
      mimeType: 'application/pdf',
      purpose: 'farm_document',
      isPrivate: true,
    });
    expect(farm.body.url).toMatch(
      new RegExp(`^/uploads/${PRIVATE_UPLOAD_DIRECTORY}/[0-9a-f-]+\\.pdf$`),
    );
    privateFiles.push(farm.body.url as string);

    const dispute = await upload(
      userToken,
      'dispute_attachment',
      PDF,
      'evidence.pdf',
      'application/pdf',
    ).expect(201);
    expect(dispute.body).toMatchObject({ purpose: 'dispute_attachment', isPrivate: true });
    privateFiles.push(dispute.body.url as string);

    // Private documents must never be reachable through the public static path.
    await request(app.getHttpServer()).get(farm.body.url).expect(404);
    await request(app.getHttpServer()).get(dispute.body.url).expect(404);
  });
});
