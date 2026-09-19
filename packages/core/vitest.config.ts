import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/modules/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/**/*.d.ts'],
      /**
       * `manifest.ts` is the one data shape the Module System hangs on
       * (ADR 0014): every branch of it is a rule a manifest author will hit,
       * so it is held at 100%. Coverage runs as its own pass over `src/modules`
       * (`pnpm --filter @paperos/core test:coverage`, chained from `test`) so
       * v8's instrumentation never perturbs a sibling folder's timing budget.
       */
      thresholds: {
        'src/modules/manifest.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
