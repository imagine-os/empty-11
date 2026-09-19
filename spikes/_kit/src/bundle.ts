import { gzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { emptyBundle, type BundleResult } from './schema.ts';

/**
 * Sum of gzip(-9) bytes of every `.js` asset a Vite production build emits
 * under `<outDir>/assets`. Mirrors `spikes/canvas-eval/scripts/measure.mjs`'s
 * method exactly, so a bundle number from this kit and one from that earlier
 * spike are directly comparable.
 */
function gzipJsAssets(outDir: string): number {
  const assetsDir = join(outDir, 'assets');
  if (!existsSync(assetsDir)) return 0;
  let total = 0;
  for (const name of readdirSync(assetsDir)) {
    if (!name.endsWith('.js')) continue;
    const bytes = readFileSync(join(assetsDir, name));
    total += gzipSync(bytes, { level: 9 }).length;
  }
  return total;
}

/** Exported so `run.ts`'s browser step can build the same entry to a dist dir it then serves. */
export async function buildEntry(entryHtml: string, outDir: string): Promise<void> {
  await build({
    root: resolve(entryHtml, '..'),
    logLevel: 'silent',
    plugins: [react()],
    build: {
      outDir: resolve(outDir),
      emptyOutDir: true,
      minify: 'esbuild',
      rollupOptions: { input: resolve(entryHtml) },
    },
  });
}

/**
 * Pure subtraction, split out for a fast unit test: the candidate's own
 * build's gzip size minus the shared baseline's, i.e. what the library
 * itself costs once React/ReactDOM are paid for either way. `null` when
 * either side wasn't measured — never a subtraction against a placeholder 0.
 */
export function subtractBaseline(gzipBytes: number | null, sharedBaselineGzipBytes: number | null): number | null {
  if (gzipBytes === null || sharedBaselineGzipBytes === null) return null;
  return gzipBytes - sharedBaselineGzipBytes;
}

/**
 * Builds the shared baseline (React + ReactDOM, nothing else mounted) once
 * per run and every candidate's own entry, and returns the candidate's own
 * weight as `gzipBytes` (its full build) alongside `sharedBaselineGzipBytes`,
 * so callers can subtract if they want the isolated library cost, or compare
 * `gzipBytes` directly when the candidate build doesn't share React's chunk
 * boundary with the baseline (single-entry builds don't chunk-split against
 * each other, so subtraction — not chunk exclusion — is how this kit isolates
 * library weight; see docs/platform/spike-harness.md "Bundle method").
 */
export async function measureBundle(options: {
  candidateEntryHtml: string;
  baselineEntryHtml: string;
  workDir: string;
}): Promise<BundleResult> {
  const { candidateEntryHtml, baselineEntryHtml, workDir } = options;
  try {
    const baselineOut = join(workDir, '.spike-kit-baseline-dist');
    const candidateOut = join(workDir, '.spike-kit-candidate-dist');

    await buildEntry(baselineEntryHtml, baselineOut);
    const sharedBaselineGzipBytes = gzipJsAssets(baselineOut);

    await buildEntry(candidateEntryHtml, candidateOut);
    const gzipBytes = gzipJsAssets(candidateOut);

    rmSync(baselineOut, { recursive: true, force: true });
    rmSync(candidateOut, { recursive: true, force: true });

    return { gzipBytes, sharedBaselineGzipBytes, notMeasuredReason: null };
  } catch (err) {
    return emptyBundle(`vite build failed: ${(err as Error).message}`);
  }
}
