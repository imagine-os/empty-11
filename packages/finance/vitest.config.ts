import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'finance', environment: 'node', passWithNoTests: true },
});
