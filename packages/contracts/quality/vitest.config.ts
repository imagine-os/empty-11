import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'contract-quality', environment: 'node', passWithNoTests: true },
});
