import { memoryDelta, sampleMemory } from '../metrics.js';
import { mulberry32, percentile, randText } from '../rng.js';
import type { LibDescriptor, PartialRow, ResultRow, ScaleConfig } from '../types.js';

/**
 * Workload (a): a rich-text document driven by `scale.textEdits` random
 * insert/delete ops until it holds roughly `scale.textChars` characters,
 * then a merge-of-two-divergent-histories pass on top.
 */
export async function runTextWorkload(
  lib: LibDescriptor,
  scale: ScaleConfig,
): Promise<PartialRow[]> {
  const rows: PartialRow[] = [];
  const rand = mulberry32(1);
  const adapter = await lib.make();
  adapter.create();

  const applyLatenciesMs: number[] = [];
  const seedLen = Math.floor(scale.textChars * 0.4);
  adapter.applyText(0, randText(rand, seedLen));
  // Track length ourselves instead of calling adapter.getText().length every
  // op: a real editor tracks its own document length and never re-derives
  // it from CRDT state on every keystroke, and for at least one library
  // (Automerge) doc.text materialises the whole rope on each read, which
  // turned a 50k-op run quadratic. See "Edge cases" in
  // docs/research/crdt-benchmark.md.
  let len = seedLen;

  for (let i = 0; i < scale.textEdits; i++) {
    const t0 = performance.now();
    if (rand() < 0.75 || len === 0) {
      const pos = Math.floor(rand() * (len + 1));
      const str = randText(rand, 1 + Math.floor(rand() * 8));
      adapter.applyText(pos, str);
      len += str.length;
    } else {
      const pos = Math.floor(rand() * len);
      const delLen = Math.min(len - pos, 1 + Math.floor(rand() * 4));
      adapter.deleteText(pos, delLen);
      len -= delLen;
    }
    applyLatenciesMs.push(performance.now() - t0);
  }

  const sortedLat = [...applyLatenciesMs].sort((a, b) => a - b);
  rows.push(row(lib, 'a', 'apply_p50', percentile(sortedLat, 50), 'ms'));
  rows.push(row(lib, 'a', 'apply_p99', percentile(sortedLat, 99), 'ms'));

  const encodeT0 = performance.now();
  const bytes = adapter.encode();
  const encodeMs = performance.now() - encodeT0;
  rows.push(row(lib, 'a', 'encode_time', encodeMs, 'ms'));
  rows.push(row(lib, 'a', 'encoded_size', bytes.length, 'bytes'));

  const loadAdapter = await lib.make();
  const loadT0 = performance.now();
  loadAdapter.load(bytes);
  const loadMs = performance.now() - loadT0;
  rows.push(row(lib, 'a', 'load_time', loadMs, 'ms'));

  const memBefore = sampleMemory();
  const memAdapter = await lib.make();
  memAdapter.load(bytes);
  const memDelta = memoryDelta(memBefore, sampleMemory());
  rows.push(row(lib, 'a', 'memory_after_load_heap', memDelta.heapUsedBytes, 'bytes'));
  rows.push(row(lib, 'a', 'memory_after_load_rss', memDelta.rssBytes, 'bytes'));

  // Merge of two divergent histories (mergeOpsPerSide ops on each side from a shared base).
  const baseAdapter = await lib.make();
  baseAdapter.create();
  baseAdapter.applyText(0, randText(mulberry32(2), 1000));
  const baseBytes = baseAdapter.encode();

  const left = await lib.make();
  left.load(baseBytes);
  const right = await lib.make();
  right.load(baseBytes);

  const randL = mulberry32(3);
  const randR = mulberry32(4);
  let lLen = 1000;
  let rLen = 1000;
  for (let i = 0; i < scale.mergeOpsPerSide; i++) {
    const lStr = randText(randL, 1 + Math.floor(randL() * 5));
    left.applyText(Math.floor(randL() * (lLen + 1)), lStr);
    lLen += lStr.length;
    const rStr = randText(randR, 1 + Math.floor(randR() * 5));
    right.applyText(Math.floor(randR() * (rLen + 1)), rStr);
    rLen += rStr.length;
  }

  const mergeT0 = performance.now();
  left.merge(right);
  const mergeMs = performance.now() - mergeT0;
  rows.push(row(lib, 'a', 'merge_time_divergent', mergeMs, 'ms'));

  adapter.dispose();
  loadAdapter.dispose();
  memAdapter.dispose();
  baseAdapter.dispose();
  left.dispose();
  right.dispose();

  return rows;
}

function row(
  lib: LibDescriptor,
  workload: ResultRow['workload'],
  metric: string,
  value: number,
  unit: string,
): PartialRow {
  return { lib: lib.libName, libVersion: lib.libVersion, workload, metric, value, unit };
}
