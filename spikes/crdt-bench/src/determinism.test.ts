import { describe, expect, it } from "vitest";
import { makeYjsAdapter } from "./adapters/yjs-adapter.js";
import { makeAutomergeAdapter } from "./adapters/automerge-adapter.js";
import { makeLoroAdapter } from "./adapters/loro-adapter.js";
import type { CrdtAdapter } from "./types.js";

const ADAPTERS: { name: string; make: () => CrdtAdapter }[] = [
  { name: "yjs", make: () => makeYjsAdapter({ gc: false }) },
  { name: "yjs-gc", make: () => makeYjsAdapter({ gc: true }) },
  { name: "automerge", make: () => makeAutomergeAdapter() },
  { name: "loro-crdt", make: () => makeLoroAdapter() },
];

/**
 * A fixed 1,000-op script of (insert | delete) instructions against
 * absolute positions computed ahead of time (not read back from the
 * adapter mid-run), so every adapter — regardless of internal
 * representation — sees literally the same sequence and must produce the
 * same final string if it interprets positions as UTF-16 code units the
 * way this harness assumes (see docs/research/crdt-benchmark.md Edge
 * cases). This is the spec's Test plan item: "deterministic 1,000-op edit
 * script yields identical final text across all three adapters."
 */
function buildScript(): { pos: number; ins: string; del: number }[] {
  let seed = 42;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const alpha = "abcdefghijklmnopqrstuvwxyz ";
  const ops: { pos: number; ins: string; del: number }[] = [];
  let len = 0;
  for (let i = 0; i < 1000; i++) {
    if (rand() < 0.8 || len === 0) {
      const pos = Math.floor(rand() * (len + 1));
      let str = "";
      const n = 1 + Math.floor(rand() * 6);
      for (let j = 0; j < n; j++) str += alpha[Math.floor(rand() * alpha.length)];
      ops.push({ pos, ins: str, del: 0 });
      len += str.length;
    } else {
      const pos = Math.floor(rand() * len);
      const del = Math.min(len - pos, 1 + Math.floor(rand() * 3));
      ops.push({ pos, ins: "", del });
      len -= del;
    }
  }
  return ops;
}

function runScript(adapter: CrdtAdapter, ops: { pos: number; ins: string; del: number }[]): string {
  adapter.create();
  for (const op of ops) {
    if (op.del > 0) adapter.deleteText(op.pos, op.del);
    else adapter.applyText(op.pos, op.ins);
  }
  return adapter.getText();
}

describe("PAP-139: adapter determinism", () => {
  it("all adapters produce identical final text for the same 1,000-op script", () => {
    const ops = buildScript();
    const results = ADAPTERS.map(({ name, make }) => {
      const adapter = make();
      const text = runScript(adapter, ops);
      adapter.dispose();
      return { name, text };
    });
    const expected = results[0].text;
    for (const r of results) {
      expect(r.text, `${r.name} diverged from ${results[0].name}`).toBe(expected);
    }
  });

  for (const { name, make } of ADAPTERS) {
    it(`${name}: encode/load round-trips text and shapes`, () => {
      const adapter = make();
      adapter.create();
      adapter.applyText(0, "hello world");
      adapter.setShape("s1", { x: 1, y: 2, w: 3, h: 4, rotation: 5, fill: "#abcdef" });
      const bytes = adapter.encode();

      const loaded = make();
      loaded.load(bytes);
      expect(loaded.getText()).toBe("hello world");
      expect(loaded.getShapeCount()).toBe(1);

      adapter.dispose();
      loaded.dispose();
    });
  }

  for (const { name, make } of ADAPTERS) {
    it(`${name}: merging two divergent histories converges both ways`, () => {
      const base = make();
      base.create();
      base.applyText(0, "base");
      const baseBytes = base.encode();

      const left = make();
      left.load(baseBytes);
      const right = make();
      right.load(baseBytes);

      left.applyText(4, "-left");
      right.applyText(4, "-right");

      const leftCopyForRightMerge = make();
      leftCopyForRightMerge.load(left.encode());
      const rightCopyForLeftMerge = make();
      rightCopyForLeftMerge.load(right.encode());

      left.merge(rightCopyForLeftMerge);
      leftCopyForRightMerge.merge(right);

      // Both directions converge to the same state (commutativity), and
      // re-merging is a no-op (idempotence) — the two CRDT guarantees the
      // spec's Definition of done relies on.
      expect(left.getText()).toBe(leftCopyForRightMerge.getText());
      const converged = left.getText();
      left.merge(rightCopyForLeftMerge);
      expect(left.getText()).toBe(converged);

      base.dispose();
      left.dispose();
      right.dispose();
      leftCopyForRightMerge.dispose();
      rightCopyForLeftMerge.dispose();
    });
  }
});
