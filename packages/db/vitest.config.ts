import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'db',
    environment: 'node',
    passWithNoTests: true,
    // PGlite boots a WASM Postgres per integration test file; the default 5 s is not enough.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One WASM Postgres at a time. Each instance costs tens of megabytes, and the gate runs
    // every package in parallel; without this the suite is the first thing an OOM kills.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
});
