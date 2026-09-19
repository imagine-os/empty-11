import { emptyRuntime, type RuntimeResult } from './schema.ts';

export interface Workload {
  /** Runs once, timed, memory-sampled around it. Sync or async. */
  runWorkload: () => void | Promise<void>;
  /** Optional one-time setup excluded from the timed region (e.g. seeding fixture data). */
  setup?: () => void | Promise<void>;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

/** True when every run is within `toleranceRatio` of the mean (default 5%) — exported for a fast unit test; used at runtime to set `stable`/`status: unstable`. */
export function isStable(values: number[], toleranceRatio = 0.05): boolean {
  if (values.length < 2) return true;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return true;
  return values.every((v) => Math.abs(v - mean) / mean <= toleranceRatio);
}

/**
 * Times `runWorkload()` across `runs` (default 3, per PAP-753's "reproducible
 * within 5 percent across three runs or report unstable") and samples
 * `process.memoryUsage()` immediately before and after each run, reporting
 * the delta of the last run (memory deltas across repeated runs are noisy
 * with GC timing; the last run is post-warm-up and closest to steady state).
 */
export async function measureRuntime(
  workload: Workload,
  options: { runs?: number } = {},
): Promise<RuntimeResult> {
  const runs = options.runs ?? 3;
  try {
    await workload.setup?.();

    const wallTimes: number[] = [];
    let heapUsedDeltaBytes = 0;
    let rssDeltaBytes = 0;

    for (let i = 0; i < runs; i += 1) {
      const before = process.memoryUsage();
      const start = performance.now();
      await workload.runWorkload();
      const elapsed = performance.now() - start;
      const after = process.memoryUsage();

      wallTimes.push(elapsed);
      heapUsedDeltaBytes = after.heapUsed - before.heapUsed;
      rssDeltaBytes = after.rss - before.rss;
    }

    const sorted = [...wallTimes].sort((a, b) => a - b);
    const mean = wallTimes.reduce((a, b) => a + b, 0) / wallTimes.length;
    const stable = isStable(wallTimes);

    return {
      wallTimeMeanMs: mean,
      wallTimeP5Ms: percentile(sorted, 5),
      heapUsedDeltaBytes,
      rssDeltaBytes,
      runs,
      stable,
      notMeasuredReason: stable ? null : 'unstable: runs varied by more than 5% of the mean',
    };
  } catch (err) {
    return emptyRuntime(`workload threw: ${(err as Error).message}`);
  }
}
