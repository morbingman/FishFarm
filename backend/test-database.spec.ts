import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: vi.fn() }));
import { configureTestDatabase } from './test-database.js';

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgresql://local:password@localhost:5432/fishfarm');
  vi.stubEnv('TEST_DATABASE_URL', undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('test database selection', () => {
  it('preserves connection options while selecting the isolated database', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://local:password@localhost:5432/fishfarm?schema=public');
    expect(configureTestDatabase()).toBe('postgresql://local:password@localhost:5432/fishfarm_test?schema=public');
    expect(process.env.DATABASE_URL).toBe('postgresql://local:password@localhost:5432/fishfarm_test?schema=public');
  });

  it('accepts an explicit separate test connection', () => {
    vi.stubEnv('TEST_DATABASE_URL', 'postgresql://local:password@localhost:5433/ci_test');
    expect(configureTestDatabase()).toBe('postgresql://local:password@localhost:5433/ci_test');
  });

  it('rejects a development database override', () => {
    vi.stubEnv('TEST_DATABASE_URL', process.env.DATABASE_URL);
    expect(() => configureTestDatabase()).toThrow('Tests require a separate database');
  });

  it('rejects an identical datasource even when its name ends in _test', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://local:password@localhost:5432/fishfarm_test');
    vi.stubEnv('TEST_DATABASE_URL', process.env.DATABASE_URL);
    expect(() => configureTestDatabase()).toThrow('Tests require a separate database');
  });

  it('rejects the same database disguised by connection credentials or schema options', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://local:password@localhost:5432/fishfarm_test');
    vi.stubEnv('TEST_DATABASE_URL', 'postgresql://other:password@localhost/fishfarm_test?schema=isolated');
    expect(() => configureTestDatabase()).toThrow('Tests require a separate database');
  });

  it('requires the development datasource', () => {
    vi.stubEnv('DATABASE_URL', undefined);
    expect(() => configureTestDatabase()).toThrow('DATABASE_URL is required');
  });
});
