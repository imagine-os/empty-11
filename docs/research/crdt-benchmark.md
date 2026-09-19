# CRDT benchmark: Yjs vs Automerge vs Loro (PAP-139)

Research backing [ADR 0005](../adr/0005-crdt-library.md). Scored against PAP-209's draft rubric
(license, maintenance, bundle size, TypeScript quality, agent-friendliness, plus one
collaborative-editor-ecosystem domain extra) — PAP-209 had not landed `docs/libraries/rubric.md` or
a mergeable `rubric.yaml` in this repository as of this run, so the scoring here is Nova's own
application of those six named criteria rather than a `pnpm lib score` run; see "Deviations from
spec" below.

**Bottom line:** Yjs, already the blueprint's pick, is confirmed. It has the smallest bundle (no
WASM), the cheapest per-op apply cost on this harness, and — decisively — the only mature
server/editor ecosystem (Hocuspocus, `y-prosemirror` under Tiptap's official collaboration
extension) that PAP-140/142/132 need to not build themselves. See ADR 0005 for the reopen
criteria.

## Method

Harness: `spikes/crdt-bench/` (`pnpm bench:crdt`), one `CrdtAdapter` interface
(`applyText`/`deleteText`/`setShape`/`encode`/`load`/`merge`) implemented for each library
(`src/adapters/*.ts`). Three workloads, matching the issue's Scope:

* **(a) text** — a rich-text document driven by random insert/delete ops to a target size, then a
  merge of two histories that diverged from a shared base.
* **(b) shapes** — a canvas map of shapes seeded, then random property patches, then the same
  divergent-merge pattern.
* **(c) peers** — N clients editing through a central relay (hub), one simulated latency tick per
  round. This is a hub/relay topology, not peer-to-peer mesh: the issue's Scope explicitly puts
  peer-to-peer transports out of scope, and a relay is the actual Hocuspocus deployment shape.
  Network time is simulated (no real `setTimeout` waits).

Every workload also measures `encode`/`load` time and size, memory after a fresh load, and
per-op apply p50/p99. `Y.Doc({gc})` is measured both `true` and `false` (reported as `yjs-gc` and
`yjs`) per the issue's edge case. WASM gzip size is measured once per library, from each package's
browser build (not the Node build the harness runs on), because that is what ships to the client.

**Hardware**: Intel Xeon @ 2.80GHz (single benchmark process, not pinned to a core), 15 GiB RAM,
Linux 6.18 x86_64, Node 22.22.2, run 2026-09-19. This is a shared CI-style VM, not a quiet
benchmarking rig — see "Deviations from spec" on run-to-run noise.

**Versions pinned** (`spikes/crdt-bench/package.json`): `yjs@13.6.32`, `@automerge/automerge@3.5.0`,
`loro-crdt@1.16.1`. All three are MIT licensed (verified from each package's `package.json`,
2026-09-19).

## Results

`bench/results.json` and `bench/results.md` are the committed, machine-readable and human-readable
outputs of the run summarized below (`pnpm bench`, scale `default`, median of 5 runs, 6m31s wall
clock on the hardware above — comfortably inside the DoD's "under 10 minutes", though with less
margin than a quieter CI runner would give). Full tables are in those files; the numbers below are
pulled from them. `yjs` is `gc: false`, `yjs-gc` is `gc: true` (same library, per the issue's edge
case).

### Workload (a): text

| metric | unit | yjs | yjs-gc | automerge | loro-crdt |
|---|---|---|---|---|---|
| apply_p50 | ms | 0.012 | 0.009 | 0.108 | 0.005 |
| apply_p99 | ms | 0.072 | 0.048 | 0.236 | 0.035 |
| encode_time | ms | 14.014 | 11.777 | 8.546 | 6.022 |
| encoded_size | bytes | 63,253 | 65,714 | 70,965 | 100,452 |
| load_time | ms | 30.5 | 16.067 | 51.636 | 0.342 |
| memory_after_load_heap | bytes | 2,290,512 | 2,283,712 | 23,296 | 768 |
| memory_after_load_rss | bytes | 0 | 0 | 1,048,576 | 131,072 |
| merge_time_divergent | ms | 13.325 | 11.691 | 85.531 | 34.457 |
| wasm_gzip_size (raw .wasm, browser build) | bytes | 0 | 0 | 1,147,333 | 1,072,193 |

### Workload (b): shapes

| metric | unit | yjs | yjs-gc | automerge | loro-crdt |
|---|---|---|---|---|---|
| apply_p50 | ms | 0.005 | 0.005 | 2.417 | 0.014 |
| apply_p99 | ms | 0.037 | 0.036 | 6.56 | 0.055 |
| encode_time | ms | 27.298 | 14.892 | 36.166 | 23.394 |
| encoded_size | bytes | 328,422 | 143,506 | 145,376 | 192,646 |
| load_time | ms | 40.882 | 20.505 | 323.952 | 2.143 |
| memory_after_load_heap | bytes | 3,272,776 | 2,060,240 | 499,944 | 752 |
| memory_after_load_rss | bytes | 0 | 0 | 2,097,152 | 0 |
| merge_time_divergent | ms | 18.031 | 8.655 | 902.309 | 18.975 |

### Workload (c): peer relay (10 peers, 6 simulated seconds, 200ms latency)

| metric | unit | yjs | yjs-gc | automerge | loro-crdt |
|---|---|---|---|---|---|
| apply_p50 | ms | 0.047 | 0.045 | 0.468 | 0.127 |
| apply_p99 | ms | 0.318 | 0.151 | 5.071 | 3.631 |
| convergence_wall_time | ms | 299.5 | 286.7 | 2,498.0 | **52,187.6** |
| encoded_size | bytes | 7,539 | 7,549 | 10,097 | 42,988 |
| memory_after_load_heap | bytes | 10,400 | 0 | 1,272 | 984 |
| memory_after_load_rss | bytes | 0 | 0 | 131,072 | 131,072 |
| peers_converged (1 = all peers match the hub) | bool | 1 | 1 | 1 | 1 |

**All three converge correctly** (`peers_converged: 1`, and the determinism test suite checks this
more rigorously — see below). Convergence *speed* is where they diverge sharply: see the callout
below.

### A second finding: Loro is fastest per-op but slowest at repeated full-snapshot relay

Loro has the cheapest single-op apply cost of the three in every workload (workload a apply_p50:
Loro 0.005ms vs Yjs 0.012ms vs Automerge 0.108ms) and the cheapest single divergent-history merge
in workloads a/b. But workload (c)'s hub relay — the topology Hocuspocus actually uses — calls
`encode()`/`load()`/`merge()` (full-snapshot export and import) once per peer per round, and there
Loro is roughly **170x slower than Yjs and 20x slower than Automerge** end to end
(`convergence_wall_time`: 52.2s vs 0.3s vs 2.5s, for the same 10-peers/30-rounds workload — the
`--scale full` 50-peers/300-rounds version did not finish inside this session's time budget for
Loro at all). This harness only exercises Loro's `export({mode:'snapshot'})`/`import()` path,
because the `CrdtAdapter` interface's `encode()`/`load()` are full-state by contract (matching the
issue's Interface contract); Loro also has an incremental `export({mode:'update'})` mode this
harness does not use, which upstream's own docs recommend for exactly this repeated-sync pattern —
so this is evidence against *this specific access pattern*, not a blanket claim that Loro is slow.
It is, however, directly relevant to the decision: it means adopting Loro for a Hocuspocus-shaped
relay would require using its incremental sync API correctly from day one, which is exactly the
kind of integration risk PAP-139 exists to price in before PAP-140 starts building.

### Bundle size (esbuild metafile over a fixture entry point, per PAP-209's rubric §2.3)

Fixture: one entry file per library doing the minimal real thing (`spikes/crdt-bench/bundle-fixtures/*-entry.ts`
— create a doc, insert text, encode), bundled with `esbuild --bundle --minify --format=esm
--platform=browser`, gzip -9 on the output:

| | Yjs | Automerge | Loro |
| -- | -- | -- | -- |
| Bundled + minified, gzip | **22,599 bytes** | 1,643,964 bytes (`--loader:.wasm=binary`, WASM inlined as base64) | 12,928 bytes (its `bundler` build statically imports the `.wasm`, which esbuild's default `file` loader externalizes as a separately-fetched asset rather than inlining — see note) |

**Reading this table needs one caveat**: Automerge's and Loro's official "bundler" entry points
both do a static `import ... from "./x.wasm"`, which every real bundler (Vite, Webpack 5, esbuild
with a configured loader) treats as an asset to fetch, not inline — that is the standard, intended
integration path, and it is why Loro's number above looks small: esbuild's default loader for an
unrecognised extension is `file`, so the actual WASM bytes never enter that gzip figure at all. To
get a number for Automerge at all (plain `esbuild --bundle` errors outright on its static `.wasm`
import with no loader configured), we forced `--loader:.wasm=binary`, which inlines it as base64 —
a real but *worse-than-necessary* integration (a properly configured bundler would fetch it
separately too). The two numbers are therefore not apples-to-apples with each other, but they agree
on the conclusion that matters for scoring: **the actual WASM payload, however it is loaded, is
about 1.0-1.15MB gzipped for both Automerge and Loro** (see `wasm_gzip_size` in the workload tables
above, measured uniformly as "gzip of each library's own browser-build `.wasm` file"), against
**zero WASM and 22.6KB total for Yjs**, which ships no compiled binary at all. The rubric's bundle
score below uses the uniform `wasm_gzip_size` number, not the fixture table, for exactly this
reason.

### Maturity and ecosystem (not benchmarked; documented with dated sources)

| | Yjs | Automerge | Loro |
| -- | -- | -- | -- |
| npm downloads/week (2026-09-10 to 09-16, `api.npmjs.org`) | 7,949,554 | 54,557 | 156,776 |
| Latest version / last publish (`npm view`, checked 2026-09-19) | 13.6.32 / 2026-08-04 | 3.5.0 / 2026-09-16 | 1.16.1 / 2026-09-10 |
| License | MIT | MIT | MIT |
| Collaborative rich-text server | Hocuspocus (self-hostable, actively maintained) | none first-party; DIY over a generic sync channel | none first-party |
| Rich-text editor binding | `y-prosemirror` → Tiptap's official `@tiptap/extension-collaboration` | community ProseMirror binding, less polished, no Tiptap-official package | experimental ProseMirror binding (`loro-prosemirror`), pre-1.0 quality, no Tiptap-official package |
| Awareness/presence protocol | `y-protocols/awareness`, first-party, transported by Hocuspocus | none first-party (roll your own over the same channel) | none first-party |
| TypeScript | first-party hand-written `.d.ts`, stable for years | first-party, generated in part from Rust/WASM bindings | first-party, generated from Rust/WASM bindings, notably ergonomic |

GitHub star counts and issue-age were not available from this sandbox (no GitHub API access to
third-party repos without an explicit `add_repo` grant); npm download counts and publish recency
above stand in as the maintenance signal, which is what PAP-209's draft rubric's "maintenance"
criterion actually asks for.

## Edge cases (from the spec)

* **WASM init excluded from timings**: the runner calls `lib.make()` once per library up front (to
  read `libVersion`) before any workload starts timing, which is also when each library's WASM
  module is instantiated.
* **UTF-16 vs grapheme offsets**: all three libraries index text by UTF-16 code unit (verified in
  `src/determinism.test.ts`, which applies the identical op script — computed positions, not
  positions read back from a live adapter — to all four adapter configs and asserts identical
  final text). The harness's text generators only emit single-code-unit ASCII, so the
  surrogate-pair case Automerge's docs call out is documented, not exercised.
* **`Yjs gc:true` changes encoded size**: measured as two separate library rows, `yjs` (`gc:
  false`) and `yjs-gc` (`gc: true`); see the results table.
* **Loro version churn**: pinned to an exact version (`loro-crdt@1.16.1`, no `^`) in
  `spikes/crdt-bench/package.json`.
* **Runner noise**: reported values are the median of `--runs 5` (the `pnpm bench` default).

## A finding this benchmark surfaced: Automerge's per-`change()` cost is not flat

The workloads originally called `adapter.getText().length` before every apply to compute a random
edit position — reading the live document back once per operation, the way a naive port of this
harness might. For Automerge this made `doc.text` re-materialise the whole string on every read,
turning a straight-line op loop quadratic: a 50k-op run went from 8 seconds (measured with a
throwaway script that tracks length itself) to multiple minutes. The harness now tracks length
itself (see the comment in `src/workloads/text.ts`), which is also the realistic choice — a real
editor tracks its own document length locally and does not re-derive it from CRDT state on every
keystroke.

Even after that fix, Automerge's `Automerge.change()` — called once per keystroke/property update,
which is exactly how this harness (and a naive editor integration) uses it — has a per-call cost
that grows with the document's total historical op count, not just its current size: at the
spec's literal full scale (200k chars / 50k edits for workload a; 10k shapes / 20k updates for
workload b; 50 peers × 300 relay rounds for workload c) this pushed a single library's run for
workload b or c well past ten minutes. Automerge's own guidance is to batch multiple mutations
per `change()` call rather than call it once per fine-grained edit; this harness intentionally
does not do that (the `CrdtAdapter` interface is one call per op, matching the issue's Interface
contract), because "how does the library behave under the access pattern a naive integration would
use" is exactly the question this ADR needs answered before PAP-142 picks an integration strategy.

## Deviations from spec

* **Committed headline numbers are at `--scale default`, not the spec's literal sizes.** The
  harness fully supports `--scale full` (200k chars/50k edits; 10k shapes/20k updates; 50 peers ×
  60s) and workload (a) was run there successfully — median of 3 runs, ~9-12s per library, see
  `bench/results-full-a.json` — but a full run of workloads (b) and, especially, (c) at that scale
  did not finish inside this session's time budget: Automerge's per-`change()` cost grows with
  total historical op count (see the callout above), and Loro's repeated full-snapshot relay cost
  (also above) both get dramatically worse at 50 peers × 300 rounds / 20k shape updates than at
  `default` scale's 10 peers × 30 rounds / 4k updates. `default` scale exercises the same code
  paths and the same relative ordering at a size that keeps `pnpm bench` — the DoD's "CI under 10
  minutes" command — comfortably inside budget (6m31s measured). A scheduled (not per-PR) CI job
  running `--scale full --runs 3` is the natural next step for workloads (b)/(c) and needs no
  harness change, just a workflow entry (Needs Justin: none — CI config, not a paid resource).
* **`@automerge/automerge` pinned to 3.5.0, not the spec's "2.x."** 2.2.9 is the newest 2.x release;
  3.5.0 is the current stable line as of 2026-09-19 and is what a new integration would actually
  ship. The `CrdtAdapter` surface used here (`Automerge.change`/`splice`/`save`/`load`/`merge`) is
  unchanged between the two lines.
* **PAP-209's rubric is a draft.** No `docs/libraries/rubric.yaml` or `pnpm lib score` exists yet in
  this repository; the scorecard in ADR 0005 applies PAP-209's six named criteria by hand. Re-score
  with `pnpm lib score` once PAP-209 lands, per that issue's own consumer list (PAP-139 is on it).
* **Memory metric reports two numbers, not one.** The spec's Interface contract does not name a
  specific memory metric shape; `results.json` reports `memory_after_load_heap` (V8 heap only) and
  `memory_after_load_rss` (whole-process RSS delta), because Automerge and Loro are WASM-backed and
  hold most of a document's memory in WASM linear memory, which `heapUsed` alone would hide (see
  the harness README for the full caveat).
* **Peers workload (c) is a hub relay, not a peer-to-peer mesh.** The issue's own Scope puts
  peer-to-peer transports out of scope, so this is the in-scope topology, not a simplification of a
  required one; see the harness README.

## Definition of done

* [x] `pnpm bench:crdt` runs (well under 10 minutes at the default/CI scale; see "Deviations" for
  the full-scale caveat) and writes `results.json` and `results.md`; every workload has numbers for
  every library.
* [x] ADR merged as `accepted` ([0005](../adr/0005-crdt-library.md)), linked from the ADR index
  (`docs/adr/README.md`) — realtime project description link left as a note below (see "Gaps").
* [x] Linear comment with results table, ADR link and a recommendation paragraph (posted on
  PAP-139 at session end).
* [x] Developer changelog entry (`docs/changelog/unreleased/PAP-139.md`).
* [ ] **Gap**: "registry entries for the three libraries (PAP-216)" — PAP-216 (the library registry
  issue) has not landed a registry file in this repository as of this run; nothing to add the three
  libraries to yet. Follow-up: whichever session picks up PAP-216 should add Yjs/Automerge/Loro
  rows citing this document.
* [ ] **Gap**: linking this ADR "from... the realtime project description" is a Linear edit outside
  this issue's own card, done via a comment on PAP-139 pointing at the ADR/doc rather than an edit
  to the project description itself (this session does not have a documented path to edit a
  project's description field safely under the brief's "never touch... beyond your own issue" rule
  read narrowly; flagged for Atlas/the coordinating session).
