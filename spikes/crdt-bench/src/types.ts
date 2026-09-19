/**
 * PAP-139: the one interface every adapter implements so workloads and the
 * runner never touch a library's native API directly. Kept intentionally
 * small — it is the reusable surface named in the issue's Interface
 * contract, not a full port of any library's API.
 */
export interface ShapeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fill: string;
}

export interface CrdtAdapter {
  readonly libName: 'yjs' | 'automerge' | 'loro-crdt';
  readonly libVersion: string;

  /** Fresh empty document with a "text" field and a "shapes" map ready to use. */
  create(): void;

  /** Insert `text` at `pos` (UTF-16 code unit offset — see docs/research/crdt-benchmark.md Edge cases). */
  applyText(pos: number, text: string): void;

  /** Delete `len` UTF-16 code units starting at `pos`. */
  deleteText(pos: number, len: number): void;

  /** Upsert one shape's properties by id (canvas workload). */
  setShape(id: string, props: Partial<ShapeProps>): void;

  /** Current text content, for correctness checks. */
  getText(): string;

  /** Current shape count, for correctness checks. */
  getShapeCount(): number;

  /** Encode the whole document to bytes (library's native full-state encoding). */
  encode(): Uint8Array;

  /** Replace this adapter's document with the state encoded in `bytes`. */
  load(bytes: Uint8Array): void;

  /** Merge another adapter's full state into this one (both must be the same libName). */
  merge(other: CrdtAdapter): void;

  /** Release native/WASM resources between iterations, where the library needs it. */
  dispose(): void;
}

export type AdapterFactory = () => Promise<CrdtAdapter>;

export interface LibDescriptor {
  /** Report label, e.g. "yjs" or "yjs-gc" — distinct configs of the same library get distinct labels. */
  libName: string;
  libVersion: string;
  make: AdapterFactory;
}

export type WorkloadName = 'a' | 'b' | 'c';

export interface ResultRow {
  lib: string;
  libVersion: string;
  workload: WorkloadName;
  metric: string;
  value: number;
  unit: string;
  runs: number;
  scale: string;
}

/** What a single workload run reports, before the runner attaches `runs`/`scale`. */
export type PartialRow = Omit<ResultRow, 'runs' | 'scale'>;

export interface ScaleConfig {
  name: string;
  /** workload a */
  textChars: number;
  textEdits: number;
  /** workload b */
  shapeCount: number;
  shapeUpdates: number;
  /** workload c */
  peers: number;
  peerSeconds: number;
  peerLatencyMs: number;
  peerOpsPerSecond: number;
  /** merge-of-divergent-histories test, shared by all workloads' merge metric */
  mergeOpsPerSide: number;
}
