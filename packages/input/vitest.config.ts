import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'input',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    // Browser self-tests of `@paperos/input/testing` run under Playwright
    // (`pnpm --filter @paperos/input test:e2e`), never under Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
