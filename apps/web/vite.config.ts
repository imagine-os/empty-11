import { execFileSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha()),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    // 'hidden' (not `true`): PAP-15 publishes this build's output publicly on
    // GitHub Pages. `true` writes a `//# sourceMappingURL` comment into the
    // shipped JS, so a public visitor's devtools auto-fetch and display the
    // original source; 'hidden' still emits the .map files (kept for our own
    // error-correlation tooling) but omits that comment, so a public devtools
    // session sees only the built output. Flagged by review; tracked for a
    // stricter follow-up (drop maps from the public artifact entirely, or
    // gate this behind an env check) as Triage PAP-1012.
    sourcemap: 'hidden',
  },
  server: {
    port: 5173,
  },
});
