# crdt-bench (PAP-139)

Standalone benchmark harness comparing `yjs`, `@automerge/automerge` and `loro-crdt` behind one
`CrdtAdapter` interface (`src/types.ts`). Never imported by the rest of the monorepo — see the root
`CLAUDE.md`'s note that `spikes/` is throwaway. Backs
[ADR 0005](../../docs/adr/0005-crdt-library.md) and `docs/research/crdt-benchmark.md`.

## Run it

```bash
pnpm install --ignore-workspace   # standalone package: not in the root pnpm-workspace.yaml globs
pnpm test              # vitest: determinism, round-trip, merge-convergence
pnpm bench:crdt --workload a --runs 1   # demo: one workload, one run, default scale
pnpm bench              # full matrix -> bench/results.json + bench/results.md
```

`pnpm bench:crdt` flags:

| Flag | Default | Meaning |
| -- | -- | -- |
| `--workload` | `all` | `a` (text), `b` (canvas shapes), `c` (peer relay), or `all` |
| `--scale` | `default` | `tiny` (smoke, seconds), `default` (~1 min), `full` (the spec's exact sizes: 200k chars/50k edits, 10k shapes/20k updates, 50 peers x 60s) |
| `--runs` | `5` | Runs per (lib, workload); reported values are the median |
| `--libs` | `yjs,yjs-gc,automerge,loro-crdt` | Comma list; `yjs`/`yjs-gc` are the same library with `Y.Doc({gc})` toggled (spec edge case: "Yjs `gc:true` changes encoded size: measure both") |
| `--out` / `--md` | — | Write `results.json` / a Markdown table |

## Workloads

* **(a) text** — a rich-text doc seeded then driven by random insert/delete ops to the spec's
  target size, plus a merge of two histories that diverged from a shared base by
  `mergeOpsPerSide` ops each.
* **(b) shapes** — a canvas `Y.Map`-equivalent of shapes seeded, then random property patches,
  plus the same divergent-merge pattern on shape properties.
* **(c) peers** — `scale.peers` clients editing through a central relay (hub), one simulated
  `peerLatencyMs` tick per round for `peerSeconds` of simulated time. This is a hub/relay
  topology, not peer-to-peer mesh gossip, because the issue's Scope explicitly puts
  peer-to-peer transports out of scope — a relay is exactly the Hocuspocus shape PaperOS
  targets. Time is simulated (no real `setTimeout` waits), so the harness finishes in seconds.

## Metrics (`results.json` rows: `{ lib, libVersion, workload, metric, value, unit, runs, scale }`)

`apply_p50`/`apply_p99` (ms), `encode_time`/`load_time` (ms), `encoded_size` (bytes),
`memory_after_load_heap`/`memory_after_load_rss` (bytes — see below), `merge_time_divergent` (ms,
workloads a/b), `convergence_wall_time`/`peers_converged` (workload c), `wasm_gzip_size` (bytes,
one-off per library, 0 for pure-JS Yjs).

**Memory caveat**: `process.memoryUsage().heapUsed` only covers the V8/JS heap. Automerge and Loro
are WASM-backed and keep most of a document's memory in WASM linear memory, which does not show up
in `heapUsed` — so we also report `..._rss` (whole-process resident memory delta), which does
capture it, and neither number is perfectly clean (RSS includes noise from GC timing and any other
allocation in the process). Treat both as an order-of-magnitude signal, not a precise figure.

## Edge cases this harness handles (from the spec)

* **WASM init** is not included in `encode_time`/`load_time`/`apply_p*`: the first adapter of a
  given library built by the runner "warms" the WASM module before any timing starts (`lib.make()`
  is called once up front to read `libVersion`).
* **UTF-16 vs grapheme offsets**: all three adapters index text by UTF-16 code unit (confirmed by
  the determinism test using multi-adapter identical scripts); this harness's generators only ever
  emit single-code-unit ASCII, so it never exercises the surrogate-pair edge case Automerge
  documents — noted, not tested.
* **Loro version churn**: `loro-crdt` is pinned to an exact version (no `^`) in `package.json`.
* **Runner noise**: `--runs 5` (the CI default) reports the median.

## Determinism tests (`src/determinism.test.ts`)

1. A fixed 1,000-op insert/delete script (positions computed ahead of time, not read back from a
   live adapter) applied fresh to all four adapter configs produces byte-identical final text.
2. Encode → load round-trips text and shapes for each adapter.
3. Merging two histories that diverged from a shared base converges to the same text regardless of
   merge direction, and re-merging is a no-op.
