import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/canvas-tldraw',
    rollupOptions: { input: 'canvas-tldraw.html' },
    emptyOutDir: true,
    minify: 'esbuild',
  },
});
