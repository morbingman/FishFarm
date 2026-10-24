import { config } from 'dotenv';
import { envFilePath } from '../src/config/env-file.js';
config({ path: envFilePath, quiet: true });
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ensureDefaultAdmin } from '../src/auth/default-admin.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  await ensureDefaultAdmin(prisma, {
    email: process.env.DEFAULT_ADMIN_EMAIL,
    password: process.env.DEFAULT_ADMIN_PASSWORD,
    resetPassword: process.argv.includes('--reset-password'),
  });
  console.log('Default administrator is ready.');
} finally {
  await prisma.$disconnect();
}
