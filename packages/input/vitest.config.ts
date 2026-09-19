import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'input',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
  },
});
