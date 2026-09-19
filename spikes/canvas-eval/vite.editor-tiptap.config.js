import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/editor-tiptap',
    rollupOptions: { input: 'editor-tiptap.html' },
    emptyOutDir: true,
    minify: 'esbuild',
  },
});
