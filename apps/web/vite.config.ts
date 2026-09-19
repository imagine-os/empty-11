import { execFileSync } from 'node:child_process';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { paperosSpecsPlugin } from './vite-plugin-paperos-specs.js';

/** Commit stamped into the bundle: CI sets VITE_GIT_SHA, local falls back to git. */
function gitSha(): string {
  if (process.env.VITE_GIT_SHA) return process.env.VITE_GIT_SHA;
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [
    // Scans src/routes/**, writes src/routeTree.gen.ts. Must come before
    // the React plugin (TanStack Router's own recommendation).
    tanstackRouter({
      target: 'react',
      routesDirectory: 'src/routes',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    react(),
    paperosSpecsPlugin(),
  ],
  base: process.env.BASE_PATH ?? '/',
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha()),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
