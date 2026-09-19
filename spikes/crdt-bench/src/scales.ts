import type { ScaleConfig } from './types.js';

/**
 * "full" mirrors the spec's exact workload numbers. It is slow enough
 * (multiple minutes across three libraries and several runs) that this
 * repo's committed `bench/results.json` was produced with `--runs 3` on
 * "full" rather than the spec's "median of 5" — see docs/research/
 * crdt-benchmark.md "Deviations from spec" for the reasoning. CI can run
 * `--runs 5` on a schedule where ten minutes of wall time is acceptable.
 */
export const SCALES: Record<string, ScaleConfig> = {
  tiny: {
    name: 'tiny',
    textChars: 2_000,
    textEdits: 500,
    shapeCount: 200,
    shapeUpdates: 400,
    peers: 4,
    peerSeconds: 2,
    peerLatencyMs: 200,
    peerOpsPerSecond: 5,
    mergeOpsPerSide: 200,
  },
  default: {
    name: 'default',
    textChars: 20_000,
    textEdits: 5_000,
    shapeCount: 2_000,
    shapeUpdates: 4_000,
    peers: 10,
    peerSeconds: 6,
    peerLatencyMs: 200,
    peerOpsPerSecond: 5,
    mergeOpsPerSide: 2_000,
  },
  full: {
    name: 'full',
    textChars: 200_000,
    textEdits: 50_000,
    shapeCount: 10_000,
    shapeUpdates: 20_000,
    peers: 50,
    peerSeconds: 60,
    peerLatencyMs: 200,
    peerOpsPerSecond: 5,
    mergeOpsPerSide: 10_000,
  },
};
