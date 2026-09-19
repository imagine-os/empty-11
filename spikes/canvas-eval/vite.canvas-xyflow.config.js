import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/canvas-xyflow',
    rollupOptions: { input: 'canvas-xyflow.html' },
    emptyOutDir: true,
    minify: 'esbuild',
  },
});
