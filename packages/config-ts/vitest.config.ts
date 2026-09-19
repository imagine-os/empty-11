import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'config-ts', environment: 'node', passWithNoTests: true },
});
