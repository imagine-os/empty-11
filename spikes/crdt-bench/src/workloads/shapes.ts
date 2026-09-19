import { memoryDelta, sampleMemory } from '../metrics.js';
import { mulberry32, percentile } from '../rng.js';
import type { LibDescriptor, PartialRow, ResultRow, ScaleConfig } from '../types.js';

const COLORS = ['#ff5733', '#33ff57', '#3357ff', '#f0f0f0', '#111111'];

/**
 * Workload (b): a canvas map of `scale.shapeCount` shapes seeded, then
 * `scale.shapeUpdates` random property patches on existing shapes, plus a
 * merge-of-two-divergent-histories pass (shape edits instead of text).
 */
export async function runShapesWorkload(
  lib: LibDescriptor,
  scale: ScaleConfig,
): Promise<PartialRow[]> {
  const rows: PartialRow[] = [];
  const rand = mulberry32(10);
  const adapter = await lib.make();
  adapter.create();

  for (let i = 0; i < scale.shapeCount; i++) {
    adapter.setShape(`shape-${i}`, {
      x: Math.floor(rand() * 4000),
      y: Math.floor(rand() * 4000),
      w: 10 + Math.floor(rand() * 200),
      h: 10 + Math.floor(rand() * 200),
      rotation: Math.floor(rand() * 360),
      fill: COLORS[Math.floor(rand() * COLORS.length)],
    });
  }

  const applyLatenciesMs: number[] = [];
  for (let i = 0; i < scale.shapeUpdates; i++) {
    const id = `shape-${Math.floor(rand() * scale.shapeCount)}`;
    const t0 = performance.now();
    adapter.setShape(id, { x: Math.floor(rand() * 4000), y: Math.floor(rand() * 4000) });
    applyLatenciesMs.push(performance.now() - t0);
  }

  const sortedLat = [...applyLatenciesMs].sort((a, b) => a - b);
  rows.push(row(lib, 'b', 'apply_p50', percentile(sortedLat, 50), 'ms'));
  rows.push(row(lib, 'b', 'apply_p99', percentile(sortedLat, 99), 'ms'));

  const encodeT0 = performance.now();
  const bytes = adapter.encode();
  const encodeMs = performance.now() - encodeT0;
  rows.push(row(lib, 'b', 'encode_time', encodeMs, 'ms'));
  rows.push(row(lib, 'b', 'encoded_size', bytes.length, 'bytes'));

  const loadAdapter = await lib.make();
  const loadT0 = performance.now();
  loadAdapter.load(bytes);
  const loadMs = performance.now() - loadT0;
  rows.push(row(lib, 'b', 'load_time', loadMs, 'ms'));

  const memBefore = sampleMemory();
  const memAdapter = await lib.make();
  memAdapter.load(bytes);
  const memDelta = memoryDelta(memBefore, sampleMemory());
  rows.push(row(lib, 'b', 'memory_after_load_heap', memDelta.heapUsedBytes, 'bytes'));
  rows.push(row(lib, 'b', 'memory_after_load_rss', memDelta.rssBytes, 'bytes'));

  const baseAdapter = await lib.make();
  baseAdapter.create();
  for (let i = 0; i < Math.min(200, scale.shapeCount); i++) {
    baseAdapter.setShape(`shape-${i}`, { x: 0, y: 0, w: 10, h: 10, rotation: 0, fill: '#000000' });
  }
  const baseBytes = baseAdapter.encode();
  const left = await lib.make();
  left.load(baseBytes);
  const right = await lib.make();
  right.load(baseBytes);

  const randL = mulberry32(11);
  const randR = mulberry32(12);
  const baseCount = Math.min(200, scale.shapeCount);
  for (let i = 0; i < scale.mergeOpsPerSide; i++) {
    left.setShape(`shape-${Math.floor(randL() * baseCount)}`, { x: Math.floor(randL() * 4000) });
    right.setShape(`shape-${Math.floor(randR() * baseCount)}`, { y: Math.floor(randR() * 4000) });
  }

  const mergeT0 = performance.now();
  left.merge(right);
  const mergeMs = performance.now() - mergeT0;
  rows.push(row(lib, 'b', 'merge_time_divergent', mergeMs, 'ms'));

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
