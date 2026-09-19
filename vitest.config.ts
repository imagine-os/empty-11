import { defineConfig } from 'vitest/config';

/**
 * Root Vitest 3 workspace: it collects every package that ships a
 * `vitest.config.ts`. The globs are wildcards, so adding a package needs no edit
 * here — copy a sibling's config and it is picked up.
 *
 * Per-package runs (`pnpm --filter <pkg> test`) use that package's own config;
 * this file exists for `pnpm test:coverage`, which needs one process to write
 * a single `coverage/` report.
 */
export default defineConfig({
  test: {
    projects: [
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'packages/contracts/*/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      include: ['apps/*/src/**', 'packages/**/src/**'],
      exclude: ['**/*.test.*', '**/*.d.ts', '**/main.tsx', '**/*.mjs'],
    },
  },
});
