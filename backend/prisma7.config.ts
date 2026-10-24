import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('./', import.meta.url));
config({ path: resolve(root, process.env.ENV_FILE?.trim() || '.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // Use the direct connection or Supabase session pooler on 5432 for migrations.
  datasource: { url: process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() },
});
