import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'config-biome', environment: 'node', passWithNoTests: true },
});
