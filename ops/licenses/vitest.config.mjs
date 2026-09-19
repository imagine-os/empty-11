import { defineConfig } from 'vitest/config';

/**
 * The licence gate's own tests (PAP-211). It lives under `ops/`, not in a
 * workspace package, so the root Vitest projects glob does not reach it —
 * same shape as ops/ci/compose-smoke. Run it with:
 *
 *   pnpm vitest run --config ops/licenses/vitest.config.mjs
 *
 * The `licenses` CI job (PAP-78) runs exactly that line before the scan.
 */
export default defineConfig({
  test: {
    name: 'licenses',
    include: ['__tests__/**/*.test.mjs'],
    root: import.meta.dirname,
    environment: 'node',
  },
});
