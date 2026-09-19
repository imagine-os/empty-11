import { z } from 'zod';

/**
 * PAP-753 shared results schema. One shape, every spike (PAP-212, PAP-292,
 * PAP-293, PAP-294, PAP-127, ...) writes and reads it the same way, so
 * `pnpm --filter @paperos/agents lib score --facts-from <dir>` (PAP-209,
 * `docs/platform/library-rubric.md` section 8) can pull measured facts from
 * any of them without a per-spike adapter.
 *
 * A number that could not be measured is `null`, never `0` or omitted — see
 * `docs/platform/spike-harness.md` "Declaring null" and the rubric's own
 * "unknown facts are written `unknown`, never `0`" rule (this schema's analog
 * for numbers is `null`; the human-readable reason goes in the sibling
 * `notMeasuredReason` field).
 */

export const StatusSchema = z.enum(['ok', 'unstable', 'failed:peer', 'error']);

export const BundleResultSchema = z.object({
  /** Gzip bytes of the candidate's own route/entry chunk, esbuild/rollup output. */
  gzipBytes: z.number().nonnegative().nullable(),
  /**
   * Gzip bytes of the shared baseline build (`spikes/_kit/baseline/`: React +
   * ReactDOM mounted, nothing else) from the same Vite/esbuild version, so
   * `gzipBytes - sharedBaselineGzipBytes` is the library's own weight and is
   * comparable across candidates and across spikes.
   */
  sharedBaselineGzipBytes: z.number().nonnegative().nullable(),
  notMeasuredReason: z.string().nullable(),
});

export const RuntimeResultSchema = z.object({
  /** Wall time in ms of the candidate's exported `runWorkload()`, via performance.now(). */
  wallTimeMeanMs: z.number().nonnegative().nullable(),
  wallTimeP5Ms: z.number().nonnegative().nullable(),
  /** process.memoryUsage().heapUsed delta across the workload run, bytes. */
  heapUsedDeltaBytes: z.number().nullable(),
  /** process.memoryUsage().rss delta, bytes — catches WASM/native memory heapUsed misses. */
  rssDeltaBytes: z.number().nullable(),
  runs: z.number().int().nonnegative(),
  /** true when the three runs agreed within 5%; false when they did not; null when not run. */
  stable: z.boolean().nullable(),
  notMeasuredReason: z.string().nullable(),
});

export const BrowserResultSchema = z.object({
  /** Mean frames-per-second over a fixed-duration rAF sample in a real Chromium page. */
  meanFps: z.number().nonnegative().nullable(),
  /** 5th-percentile FPS across the same sample (worst-typical frame rate, not worst frame). */
  p5Fps: z.number().nonnegative().nullable(),
  /** Frames whose interval exceeded 50ms (slower than 20fps for one frame). */
  longFrames: z.number().int().nonnegative().nullable(),
  notMeasuredReason: z.string().nullable(),
});

export const CandidateResultSchema = z.object({
  lib: z.string().min(1),
  version: z.string().min(1),
  measuredAt: z.string().datetime(),
  bundle: BundleResultSchema,
  runtime: RuntimeResultSchema,
  browser: BrowserResultSchema,
  status: StatusSchema,
  notes: z.array(z.string()).default([]),
});

export const SummarySchema = z.object({
  spike: z.string().min(1),
  measuredAt: z.string().datetime(),
  method: z.string().min(1),
  candidates: z.array(CandidateResultSchema),
});

export type Status = z.infer<typeof StatusSchema>;
export type BundleResult = z.infer<typeof BundleResultSchema>;
export type RuntimeResult = z.infer<typeof RuntimeResultSchema>;
export type BrowserResult = z.infer<typeof BrowserResultSchema>;
export type CandidateResult = z.infer<typeof CandidateResultSchema>;
export type Summary = z.infer<typeof SummarySchema>;

export function emptyBundle(notMeasuredReason: string | null = null): BundleResult {
  return { gzipBytes: null, sharedBaselineGzipBytes: null, notMeasuredReason };
}

export function emptyRuntime(notMeasuredReason: string | null = null): RuntimeResult {
  return {
    wallTimeMeanMs: null,
    wallTimeP5Ms: null,
    heapUsedDeltaBytes: null,
    rssDeltaBytes: null,
    runs: 0,
    stable: null,
    notMeasuredReason,
  };
}

export function emptyBrowser(notMeasuredReason: string | null = null): BrowserResult {
  return { meanFps: null, p5Fps: null, longFrames: null, notMeasuredReason };
}
