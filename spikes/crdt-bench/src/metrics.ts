/**
 * `process.memoryUsage().heapUsed` only covers the V8/JS heap. Automerge and
 * Loro are WASM-backed and keep most of a loaded document's memory in WASM
 * linear memory, which does not show up there — so heapUsed alone makes
 * them look artificially cheap next to Yjs (pure JS). We report both heap
 * delta and RSS delta (the whole process's resident memory, which does
 * include WASM linear memory) and the research doc explains the gap.
 */
export interface MemorySample {
  heapUsedBytes: number;
  rssBytes: number;
}

export function sampleMemory(): MemorySample {
  if (global.gc) global.gc();
  const m = process.memoryUsage();
  return { heapUsedBytes: m.heapUsed, rssBytes: m.rss };
}

export function memoryDelta(before: MemorySample, after: MemorySample): MemorySample {
  return {
    heapUsedBytes: Math.max(0, after.heapUsedBytes - before.heapUsedBytes),
    rssBytes: Math.max(0, after.rssBytes - before.rssBytes),
  };
}
