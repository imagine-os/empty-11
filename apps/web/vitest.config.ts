import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(process.env.VITE_GIT_SHA ?? 'test'),
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
  },
});
