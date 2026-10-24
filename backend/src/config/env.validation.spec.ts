import { validateEnv } from './env.validation.js';
const base = { DATABASE_URL: 'postgresql://user:password@localhost:5432/fishfarm', JWT_ACCESS_SECRET: 'test-secret' };
describe('database environment validation', () => {
  it('normalizes database URLs and validates the environment', () => {
    const result = validateEnv({ ...base, DATABASE_URL: ` ${base.DATABASE_URL} ` });
    expect(result.DATABASE_URL).toBe(base.DATABASE_URL);
    expect(result.PORT).toBe(4000);
  });
  it('rejects blank required values', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: '  ' })).toThrow('DATABASE_URL');
  });
  it('rejects invalid connection URLs without exposing credentials', () => {
    for (const DATABASE_URL of ['mysql://user:private@localhost/fishfarm', 'not-a-url', 'postgresql://localhost']) {
      expect(() => validateEnv({ ...base, DATABASE_URL })).toThrow('valid PostgreSQL');
      try { validateEnv({ ...base, DATABASE_URL }); } catch (e) { expect(String(e)).not.toContain('private'); }
    }
  });
  it('validates DIRECT_URL independently', () => {
    expect(() => validateEnv({ ...base, DIRECT_URL: 'wrong' })).toThrow('DIRECT_URL');
    expect(validateEnv({ ...base, DIRECT_URL: '' }).DATABASE_URL).toBe(base.DATABASE_URL);
  });
});
