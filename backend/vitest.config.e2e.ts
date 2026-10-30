import { defineConfig } from 'vitest/config';
import { configureTestDatabase } from './test-database.js';

configureTestDatabase();

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // All suites share one _test database and role-scoped notifications fan out
    // to every matching user in it (src/common/notifications.ts), so parallel
    // files crossfire into each other's fixtures (seen as flaky totals in the
    // notifications isolation test). Suites must run one at a time.
    fileParallelism: false,
  },
});
