import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'boundaries',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
