import { memoryDelta, sampleMemory } from '../metrics.js';
import { mulberry32, percentile, randText } from '../rng.js';
import type { LibDescriptor, PartialRow, ResultRow, ScaleConfig } from '../types.js';

/**
 * Workload (c): `scale.peers` clients editing through a central relay (the
 * Hocuspocus deployment shape this ADR targets — the spec explicitly puts
 * peer-to-peer transports out of scope, so a hub relay is the in-scope
 * topology, not a simplification of it). Each round is one
 * `scale.peerLatencyMs` tick of one-way network delay: every peer produces
 * local edits, ships its full state to the hub, the hub merges all of them
 * and broadcasts its state back. Time itself is simulated (no real
 * `setTimeout` waits) so the benchmark finishes in seconds instead of
 * `scale.peerSeconds` of wall clock; see docs/research/crdt-benchmark.md.
 */
export async function runPeersWorkload(
  lib: LibDescriptor,
  scale: ScaleConfig,
): Promise<PartialRow[]> {
  const rows: PartialRow[] = [];
  const rounds = Math.max(1, Math.round((scale.peerSeconds * 1000) / scale.peerLatencyMs));
  const opsPerPeerPerRound = Math.max(
    1,
    Math.round((scale.peerOpsPerSecond * scale.peerLatencyMs) / 1000),
  );

  const hub = await lib.make();
  hub.create();

  // Each peer tracks its own text length locally (see the comment in
  // workloads/text.ts) instead of re-deriving it from the adapter every op.
  const peers: { adapter: Awaited<ReturnType<typeof lib.make>>; rand: () => number; len: number }[] = [];
  for (let p = 0; p < scale.peers; p++) {
    const peer = await lib.make();
    peer.create();
    peers.push({ adapter: peer, rand: mulberry32(1000 + p), len: 0 });
  }

  const applyLatenciesMs: number[] = [];
  const simT0 = performance.now();

  for (let round = 0; round < rounds; round++) {
    for (const peer of peers) {
      for (let i = 0; i < opsPerPeerPerRound; i++) {
        const str = randText(peer.rand, 1 + Math.floor(peer.rand() * 4));
        const t0 = performance.now();
        peer.adapter.applyText(Math.floor(peer.rand() * (peer.len + 1)), str);
        applyLatenciesMs.push(performance.now() - t0);
        peer.len += str.length;
      }
    }
    // Upload: hub merges every peer's state (arrives after one simulated latency tick).
    for (const peer of peers) {
      hub.merge(peer.adapter);
    }
    // Download: hub broadcasts its merged state back (a second simulated latency tick).
    const hubBytes = hub.encode();
    const hubLen = hub.getText().length;
    for (const peer of peers) {
      peer.adapter.load(hubBytes);
      peer.len = hubLen;
    }
  }

  const simMs = performance.now() - simT0;
  rows.push(row(lib, 'c', 'convergence_wall_time', simMs, 'ms'));

  const sortedLat = [...applyLatenciesMs].sort((a, b) => a - b);
  rows.push(row(lib, 'c', 'apply_p50', percentile(sortedLat, 50), 'ms'));
  rows.push(row(lib, 'c', 'apply_p99', percentile(sortedLat, 99), 'ms'));

  const finalBytes = hub.encode();
  rows.push(row(lib, 'c', 'encoded_size', finalBytes.length, 'bytes'));

  const expected = hub.getText();
  const allConverged = peers.every((peer) => peer.adapter.getText() === expected);
  rows.push(row(lib, 'c', 'peers_converged', allConverged ? 1 : 0, 'bool'));

  const memBefore = sampleMemory();
  const memAdapter = await lib.make();
  memAdapter.load(finalBytes);
  const memDelta = memoryDelta(memBefore, sampleMemory());
  rows.push(row(lib, 'c', 'memory_after_load_heap', memDelta.heapUsedBytes, 'bytes'));
  rows.push(row(lib, 'c', 'memory_after_load_rss', memDelta.rssBytes, 'bytes'));

  hub.dispose();
  memAdapter.dispose();
  for (const peer of peers) peer.adapter.dispose();

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
