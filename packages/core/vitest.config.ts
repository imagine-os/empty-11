import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * `environment: 'node'` (this package's default, needed by `filter/`'s
 * PGlite tests) stays the default for the whole package. The React plugin
 * is needed regardless of environment, for `src/shell/**`'s JSX; the one
 * test file that renders a component (`AppShell.test.tsx`) opts into jsdom
 * per-file with a `// @vitest-environment jsdom` pragma instead of changing
 * this default (see README.md's "no React outside shell/" note).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'core',
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
