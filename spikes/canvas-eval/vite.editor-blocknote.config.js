import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/editor-blocknote',
    rollupOptions: { input: 'editor-blocknote.html' },
    emptyOutDir: true,
    minify: 'esbuild',
  },
});
