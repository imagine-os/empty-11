import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { paperosSpecsPlugin } from './vite-plugin-paperos-specs.js';

export default defineConfig({
  plugins: [react(), paperosSpecsPlugin()],
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(process.env.VITE_GIT_SHA ?? 'test'),
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
    // Router integration tests mount a real TanStack Router and await a
    // route load; the default 5s is tight under this build loop's heavy
    // parallel `pnpm check` load (routinely <1s standalone). 15s only
    // matters when many builders' test runs contend for CPU at once.
    testTimeout: 15000,
  },
});
