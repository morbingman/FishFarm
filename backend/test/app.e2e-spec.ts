import request from 'supertest';
import { createTestApp } from './test-app.js';

describe('FishFarm API (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1 returns API metadata', async () => {
    const response = await request(app.getHttpServer()).get('/v1').expect(200);

    expect(response.body).toMatchObject({
      name: 'FishFarm API',
      docs: '/docs',
      health: '/health',
    });
  });

  it('GET /health reports the database as up', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({ status: 'ok', db: 'up' });
  });
});
