import { config } from 'dotenv';

export function configureTestDatabase(): string {
  config({ quiet: true });
  const developmentUrl = process.env.DATABASE_URL;
  if (!developmentUrl) throw new Error('DATABASE_URL is required to configure the test database');
  const url = new URL(process.env.TEST_DATABASE_URL ?? developmentUrl);
  if (!process.env.TEST_DATABASE_URL) url.pathname = '/fishfarm_test';
  const development = new URL(developmentUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  const sameDatabase = url.hostname === development.hostname
    && (url.port || '5432') === (development.port || '5432')
    && database === decodeURIComponent(development.pathname.slice(1));
  if (!database.endsWith('_test') || sameDatabase) {
    throw new Error('Tests require a separate database whose name ends in _test');
  }
  process.env.DATABASE_URL = url.href;
  return url.href;
}
