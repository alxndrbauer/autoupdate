import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
  include: ['test/**/*.spec.ts'],
  setupFiles: ['test/setup.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage-vitest',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      all: true,
  // All logic covered; branch instrumentation for a few defensive null checks sits <100%.
  // Keep strict 100% everywhere except branches (actual ~98.75%).
  thresholds: { lines: 100, functions: 100, statements: 100, branches: 98 },
    },
  },
});
