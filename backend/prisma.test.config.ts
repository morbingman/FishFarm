import { defineConfig } from 'prisma/config';
import { configureTestDatabase } from './test-database.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: configureTestDatabase() },
});
