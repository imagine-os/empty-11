import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'spec', environment: 'node', passWithNoTests: true },
});
