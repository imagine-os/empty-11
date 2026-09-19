---
id: "0005"
title: "CRDT library for documents and canvas"
status: Accepted
date: 2026-09-19
deciders: ["Nova", "Scout"]
issue: PAP-139
supersedes: []
supersededBy: null
tags: ["library", "realtime", "crdt"]
reviewDate: 2027-01-19
---

# 0005. CRDT library for documents and canvas

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-139](https://linear.app/paperos/issue/PAP-139/benchmark-yjs-vs-automerge-vs-loro-for-document-crdt-and-write-an-adr)
* Deciders: Nova (CRDT Engineer, decision), Scout (Library Evaluator, harness and facts); reviewed by Sentinel (Code Reviewer)
* Review date: 2027-01-19

## Context

The blueprint (`docs/blueprint.md` line 16) already named Yjs via a self-hosted Hocuspocus server
as the realtime transport for documents and canvas, ahead of any measurement, because it is the
only one of the three libraries with a mature, drop-in relay server (Hocuspocus) and editor binding
(`y-prosemirror`, wrapped by Tiptap's official `@tiptap/extension-collaboration`). The risk this
issue exists to retire is that Automerge or Loro would turn out to be so much smaller, faster or
better-typed that re-implementing that server/editor glue would pay for itself before PAP-140
(Hocuspocus server), PAP-142 (editor) and PAP-132 (canvas) start building on it — all three name
the CRDT choice as a hard input (`docs/interface-and-data-contracts.md` row "Document": `yjs_document`,
`yjs_updates`, `state bytea` V2 update, 20 MB cap).

PAP-209's rubric (`docs/platform/library-rubric.md`, ADR 0009) and its ADR template
(`docs/adr/template.md`) merged in this repository before this ADR was written, so this is scored
against the real rubric, not a draft — six criteria (license 20, maintenance 20, bundle 15, a11y
15, ts 15, agent 15), `a11y` scored `n/a` for all three candidates (a CRDT library has no UI of its
own), one domain extra `collabEcosystem` (weight 10, additive) capturing the one property that
actually decides this comparison: whether a mature relay server and rich-text editor binding exist,
which none of the six base criteria measure directly. `pnpm lib score` (the scoring CLI) does not
exist as runnable code yet — only the rubric doc and its JSON mirror have landed — so the totals
below are computed by hand from the documented formula and will be re-checked once the CLI lands
(rubric §6's "draft tiers" caveat also applies: `ops/licenses/policy.yaml`, PAP-211, has not
merged, so the license gate uses the rubric's embedded draft tiers).

Full benchmark method, raw numbers, and two findings the harness surfaced (Automerge's
per-transaction cost growing with total historical ops; Loro's full-snapshot relay cost) are in
[`docs/research/crdt-benchmark.md`](../research/crdt-benchmark.md). Harness:
[`spikes/crdt-bench/`](../../spikes/crdt-bench/) (`pnpm bench:crdt`).

## Decision

**Yjs 13.6.32, via `Y.encodeStateAsUpdateV2` and a snapshot every 500 updates or 60 seconds, is
confirmed as the document and canvas CRDT.**

| Field | Value |
| -- | -- |
| Library | `yjs` |
| Version pinned | `13.6.32` |
| Encoding | `Y.encodeStateAsUpdateV2` (v2 update format) |
| GC | `Y.Doc({ gc: true })` in the Hocuspocus server (tombstones dropped once no client can reference them); `gc: false` only for a client that must keep full undo history |
| Snapshot cadence | Every 500 applied updates **or** 60 seconds of session time, whichever comes first — PAP-140 copies this into its persistence config |
| Awareness | `y-protocols/awareness`, transported by Hocuspocus over the same WebSocket |
| Editor binding | `y-prosemirror` under Tiptap's official `@tiptap/extension-collaboration` |

We will import `yjs` directly in `packages/collab` (the module that owns the Yjs room/document
lifecycle, per `docs/interface-and-data-contracts.md`'s "Yjs rooms and auth hook" ownership row) and
nowhere else; PAP-140/142/132 reach it through `packages/collab`'s contract package, not by each
importing `yjs` themselves, per the module boundary rule.

## Consequences

**Positive.** PAP-140 codes its persistence layer directly against `Y.encodeStateAsUpdateV2` and
the cadence above instead of re-deriving a format. PAP-142/132 build on `y-prosemirror` and a Yjs
`Y.Map` of shapes, matching `spikes/crdt-bench/src/adapters/yjs-adapter.ts`. The smallest bundle of
the three (no WASM) and the cheapest per-op apply cost on every workload this harness ran.

**Negative.** `memory_after_load_heap` for a loaded document is over 2MB even for a ~65KB encoded
document (workload a, default scale — see the research doc), because Yjs keeps a live JS object
graph rather than a compact buffer; Hocuspocus's per-room memory budget (PAP-140) should plan
around that, not around the encoded-size numbers. Yjs's `n/a`-for-a11y single-maintainer-style
governance (see the scorecard's `maintenance` evidence) means the project's bus factor is a real,
if unverified-in-this-sandbox, question — recorded as a re-open trigger below.

**Neutral.** Automerge and Loro adapters and workloads stay in the repo (`spikes/` is "never
imported" per this repo's `CLAUDE.md`), so a future reopen reruns the exact same harness instead of
re-deriving numbers from scratch.

## Alternatives rejected

**Automerge 3.5.0** — best-in-class conflict semantics and a real Rust core, backed by Ink & Switch,
but the largest WASM payload measured here (1.15MB gzip, `bundle` gate score 0), no first-party
relay server or Tiptap-official editor binding, and the highest per-op apply cost on this harness's
text workload. Its `Automerge.change()` also has a per-call cost that grows with the document's
total historical op count when called once per fine-grained edit (this harness's — and a naive
editor integration's — access pattern), which pushed a full-spec-scale run of workload (b) past
this session's time budget; see the research doc.

**Loro 1.16.1** — the fastest raw apply and single-merge numbers of the three, and a genuinely
ergonomic generated TypeScript API, but the youngest project (smallest download count, no verified
institutional backing), an equally large WASM payload (1.07MB gzip, `bundle` gate score 0), no
relay server and only an experimental pre-1.0 ProseMirror binding. This harness's peer-relay
workload also surfaced a specific integration risk: repeated full-snapshot `import()` calls (the
pattern a Hocuspocus-shaped relay uses) were roughly 170x slower end to end than Yjs's equivalent,
because this harness (matching the issue's Interface contract) only exercises `encode()`/`load()`
as full-state operations — Loro's incremental `export({mode:'update'})` path exists but was not
used here, so this is a real cost of the naive integration, not necessarily of Loro itself.

Both scorecards are in
[`docs/libraries/scorecards/`](../libraries/scorecards/); the required rendered table (rubric §9,
computed by hand per §1's formula since `pnpm lib score` is not yet runnable code):

| Candidate | Version | License | Maint. | Bundle | A11y | TS | Agent | Extras | Total | Gates | Migration (h) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Yjs** | 13.6.32 | 4 | 3 | 3 | n/a | 3 | 4 | collabEcosystem 4/10 | **87** | pass | 0 | **adopt** |
| Automerge | 3.5.0 | 4 | 4 | 0 | n/a | 3 | 3 | collabEcosystem 1/10 | 69 | pass | unknown | trial* |
| Loro | 1.16.1 | 4 | 3 | 0 | n/a | 4 | 2 | collabEcosystem 0/10 | 61 | pass | unknown | trial* |

`*` Automerge and Loro land in the rubric's 60-74 "trial" band (allowed behind a flag with a
re-evaluation date), but this ADR's Decision is not to adopt or trial either for the document/canvas
module: the Interface & Data Contracts name one CRDT encoding for `yjs_document`/`yjs_updates`, and
Yjs's total is 18-26 points clear of both — not a tie under rubric §7 (ties are within 5 points).
`a11y` is `n/a` for all three (rubric §2.4: "no user interface at all"); weights for the other five
criteria rescale from 85 to 90 (100 minus the 10-point `collabEcosystem` extra, factor 90/85) before
the `Total` column above is computed. Arithmetic and full evidence are in each scorecard file and
`docs/research/crdt-benchmark.md`.

**Do not benchmark, keep the blueprint's Yjs call on priors alone** — rejected: PAP-139 exists
specifically so the choice has numbers behind it before three other issues build on it.

## Re-open criteria

This decision is revisited when any of these becomes true:

- **Date.** `reviewDate` (2027-01-19) passes while status is `Accepted`.
- **Fact.** Automerge ships an official Tiptap/ProseMirror binding and a maintained relay server
  with comparable adoption to Hocuspocus; or Loro does the same and additionally demonstrates
  competitive full-snapshot (or documented incremental) relay performance at the peer counts
  PaperOS runs in production; or Yjs goes 12+ months without a release (rubric `maintenance` anchor
  1) or its governance concentrates further into a single unbacked maintainer.
- **Budget.** Hocuspocus's measured per-room memory (once PAP-140 ships) exceeds a stated line, at
  which point Yjs's `memory_after_load_heap` behaviour (see Consequences) is worth re-costing
  against Automerge/Loro's WASM-heap-not-JS-heap profile.
- **Advisory.** A critical advisory lands against `yjs`, `y-protocols`, or `@hocuspocus/server` with
  no patched version within 14 days.

Re-opening means a new benchmark run (`pnpm bench:crdt`) and scorecards, and a new ADR that
supersedes this one.

## References

- Linear issue: PAP-139
- Rubric: `docs/platform/library-rubric.md`; machine-readable: `packages/agents/src/rubric/library-rubric.json`
- Research: `docs/research/crdt-benchmark.md`
- Scorecards: `docs/libraries/scorecards/yjs@13.6.32.yaml`, `docs/libraries/scorecards/automerge@3.5.0.yaml`, `docs/libraries/scorecards/loro-crdt@1.16.1.yaml`
- Harness: `spikes/crdt-bench/` (`pnpm bench:crdt`, `pnpm test`)
- Registry entry: `docs/libraries/registry/*.yaml` (PAP-216) — not yet landed; see "Gaps" in the research doc
- Consumers: PAP-140 (Hocuspocus server, blocked by this ADR), PAP-142 (editor), PAP-132 (canvas)
