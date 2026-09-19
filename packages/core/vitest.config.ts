import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      // Always on for this package: the value types in `src/types` are the
      // contract every other package codes against, so their coverage is a
      // gate, not a report (PAP-302 definition of done).
      enabled: true,
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text-summary'],
      include: ['src/**'],
      exclude: ['**/*.test.ts'],
      thresholds: {
        '**/src/types/money.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        '**/src/types/cursor.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
