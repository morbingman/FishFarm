import { defineConfig } from 'vitest/config';
import { configureTestDatabase } from './test-database.js';

configureTestDatabase();

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    maxWorkers: 2,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
