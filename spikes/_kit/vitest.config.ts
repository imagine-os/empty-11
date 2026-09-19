import { defineConfig } from 'vitest/config';

// Standalone package (see README: `pnpm install --ignore-workspace`), not one
// of the root vitest.config.ts's workspace `projects` globs — this file's
// mere presence stops Vitest from walking up and picking up the root config.
export default defineConfig({
  test: {
    root: import.meta.dirname,
  },
});
