import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = resolve(root, process.env.ENV_FILE?.trim() || '.env');
const loaded = dotenv.config({ path: envPath, quiet: true });
console.log(`Env file: ${envPath}`);
console.log(existsSync(envPath) ? 'Env file found.' : 'Env file not found; checking server environment variables.');
if (loaded.error && existsSync(envPath)) {
  console.error('Cannot read the selected env file. Check file permissions.');
  process.exit(1);
}
const missing = ['DATABASE_URL', 'JWT_ACCESS_SECRET'].filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error(`Missing variables: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Required variables found. Passwords and secrets are hidden.');
console.log('Runtime uses DATABASE_URL only; DIRECT_URL is not needed by this check.');

const hints = {
  EAI_AGAIN: 'DNS failed. Check network/DNS and the database hostname in Supabase Connect.',
  ENOTFOUND: 'Database hostname not found. Copy the URL again from Supabase Connect.',
  ECONNREFUSED: 'Connection refused. Check the database port and whether PostgreSQL is running.',
  ETIMEDOUT: 'Connection timed out. Check firewall, network access and whether the project is paused.',
  '28P01': 'Database password rejected. Use the database password, not your Supabase account password.',
  '3D000': 'Database name does not exist. Check the URL database name.',
  SELF_SIGNED_CERT_IN_CHAIN: 'TLS certificate chain rejected. Configure a trusted database CA certificate.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS certificate rejected. Configure a trusted database CA certificate.',
};
let failed = false;
for (const key of ['DATABASE_URL']) {
  const value = process.env[key]?.trim();
  if (!value) {
    console.log(`${key}: not set; migrations will use DATABASE_URL.`);
    continue;
  }
  let url;
  try {
    url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error();
  } catch {
    console.error(`${key}: invalid PostgreSQL URL. Encode special characters in the password.`);
    failed = true;
    continue;
  }
  console.log(`${key}: ${url.hostname}:${url.port || 5432}${url.pathname} (credentials hidden)`);
  const client = new pg.Client({ connectionString: value, connectionTimeoutMillis: 8000, query_timeout: 8000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log(`${key}: database connection OK.`);
    // Validate existing application tables; no Prisma migration history is required.
    const expected = JSON.parse(readFileSync(new URL('./required-schema.json', import.meta.url), 'utf8'));
    const result = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'",
    );
    const actual = new Map();
    for (const row of result.rows) {
      if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
      actual.get(row.table_name).add(row.column_name);
    }
    const missingTables = [];
    const missingColumns = [];
    for (const [table, columns] of Object.entries(expected)) {
      if (!actual.has(table)) { missingTables.push(table); continue; }
      for (const column of columns) {
        if (!actual.get(table).has(column)) missingColumns.push(`${table}.${column}`);
      }
    }
    if (missingTables.length || missingColumns.length) {
      failed = true;
      console.error('Existing database does not contain all tables/columns used by this backend.');
      if (missingTables.length) console.error(`Missing tables: ${missingTables.join(', ')}`);
      if (missingColumns.length) console.error(`Missing columns: ${missingColumns.join(', ')}`);
      console.error('Check that DATABASE_URL selects the correct database and public schema. No tables were created or changed.');
    } else console.log('All expected application table and column names are present. No migration history is required.');

  } catch (error) {
    failed = true;
    const code = typeof error.code === 'string' ? error.code : 'CONNECTION_FAILED';
    console.error(`${key}: ${code}. ${hints[code] || 'Check the database URL, project status, SSL and network settings.'}`);
  } finally {
    await client.end().catch(() => {});
  }
}
console.log(failed ? 'Check failed. No database data was modified.' : 'Environment and database checks passed. No data was modified.');
process.exitCode = failed ? 1 : 0;
