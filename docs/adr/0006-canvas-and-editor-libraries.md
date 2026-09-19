---
status: accepted
issue: PAP-127
reviewDate: 2027-01-01
decision:
  canvas: "@xyflow/react"
  canvasVersion: "12.11.6"
  editor: "@tiptap/core"
  editorVersion: "3.31.3"
  editorCollab: "y-prosemirror@1.3.7 via @tiptap/extension-collaboration@3.31.3"
---

# 0006. Canvas and editor libraries

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-127](https://linear.app/paperos/issue/PAP-127)
* Deciders: Scout (Library Evaluator, decision), Nova (Canvas Cartographer, spikes), Atlas
  (decision review — pending), Sentinel (Security Auditor, license review — pending)

## Context

Two library choices gate the rest of the In-App Collaboration & Knowledge project: the canvas
that PAP-132 builds windows and diagrams on, and the rich-text editor PAP-142 builds documents and
prompt logs on. Both must speak our stack's realtime layer: Yjs CRDTs synced through a
self-hostable Hocuspocus server (PAP-140), per `docs/interface-and-data-contracts.md` row 26
(`yjs_document`, `yjs_updates`, 20 MB cap). The candidates named by the plan were `tldraw` vs
`@xyflow/react` for the canvas, and `@tiptap/core` (`y-prosemirror`) vs `@blocknote/core` for the
editor. Full research, scores and citations: [`docs/research/canvas-and-editor-libraries.md`](../research/canvas-and-editor-libraries.md).

`imagine-os/paperos` (a separate, already-shipped PaperOS product, not this one) uses `tldraw`
heavily and pins it at `3.15.6` specifically — see Decision below for why that pin matters here.

PAP-209 (rubric) and PAP-211 (license policy) have not merged; this ADR uses their draft spec text
and re-scores once they do (see Reopen criteria).

## Decision

**Canvas: `@xyflow/react` 12.11.6.** **Editor: `@tiptap/core` 3.31.3 with `y-prosemirror` 1.3.7**
(via `@tiptap/extension-collaboration` 3.31.3). Both match the spec's expected outcome; the
spikes did not disagree with it — they sharpened the reason.

The deciding fact for the canvas is a **license change in tldraw, not a feature gap**. tldraw's
license text changed materially between the `3.x` line the plan was written against and every
release from `4.0.0` onward (current: `5.4.2`, published 2026-09-10):

* `tldraw@3.15.6` ("SEE LICENSE IN LICENSE.md", [full text](https://raw.githubusercontent.com/tldraw/tldraw/v3.15.6/LICENSE.md)): permits use "in your commercial or non-commercial projects" on the condition that the watermark stays visible — a free, watermarked path to production. This is why `imagine-os/paperos`'s `CLAUDE.md` says "the tldraw watermark is fine" and pins `tldraw`/`@tldraw/assets` at exactly `3.15.6`.
* `tldraw@5.4.2` (current `main`, [full text](https://raw.githubusercontent.com/tldraw/tldraw/main/LICENSE.md), same wording already at [v4.0.0](https://github.com/tldraw/tldraw/blob/v4.0.0/LICENSE.md)): "Not to use the Software in Production Environments" without a paid or trial License Key. Free use is now contractually limited to **Development Environments**. There is no longer a free, watermarked production path at all.

Under PAP-211's draft policy this text sits in the **Review** tier (ADR + waiver), but "review and
waive" assumed a watermark condition, not a hard production ban on the free tier. Adopting current
tldraw for a shipping PaperOS surface would mean a recurring paid Business License (a Needs Justin
item — see below) or accepting a canvas that cannot run in production for real users. `@xyflow/react`
is MIT with no such condition, is 4.5x smaller gzipped (126.6 KB vs 574.0 KB, measured,
`spikes/canvas-eval/results.json`), matches PaperOS's node/edge `FlowGraph` data model directly,
integrates with ELK for programmatic layout as the spec expects, and its own docs describe the
Yjs binding pattern our Hocuspocus stack needs — where tldraw's first-party multiplayer product,
`@tldraw/sync`, is a different, non-Yjs sync engine, making a Yjs binding to tldraw bespoke
integration work (which `imagine-os/paperos` proves is *possible*, at real cost: a hand-rolled
`Y.Map`-of-shapes binding under `src/collab/`, per `/workspace/paperos/docs/COLLAB.md`).

For the editor, Tiptap + `y-prosemirror` wins on license (MIT throughout vs BlockNote's MPL-2.0
core — allowed but a heavier review burden than a straight MIT stack), a smaller measured bundle
(219.9 KB vs 397.7 KB gzip, and BlockNote's number *undercounts* the real integration since 0.54.x
moved its themed view into a separate `@blocknote/mantine`/`@blocknote/shadcn` package not
exercised here), and an extension model that lets PAP-142 pick exactly the blocks a PaperOS
document needs instead of inheriting BlockNote's fixed Notion-style schema. BlockNote's own
strength — real-time collaboration and mentions/tables/uploads pre-wired with almost no assembly —
is real and worth keeping: **BlockNote is recorded as a later document-type option**, not
discarded.

Full scoring tables, all citations and dates: the research doc linked above. Bundle numbers were
measured with real production `vite build`s in `spikes/canvas-eval/` (see that folder's `README.md`
for method and, importantly, what was *not* measured — no live FPS or Hocuspocus convergence
numbers this session; see Reopen criteria).

## Consequences

* PAP-132 (canvas) imports `@xyflow/react` 12.11.6 and its peer `@xyflow/system`; sticky
  notes/shapes become custom `nodeTypes`, and freehand ink is explicitly deferred to PAP-157 (React
  Flow has no drawing surface — this was a known edge case going in).
* PAP-142 (editor) imports `@tiptap/core` 3.31.3, `@tiptap/starter-kit` 3.31.3,
  `@tiptap/extension-collaboration` 3.31.3 and `y-prosemirror` 1.3.7, all pinned to those versions
  (see the peer-dependency matrix in the research doc) so `yjs` resolves to one copy across the
  editor and PAP-140's Hocuspocus client.
* `imagine-os/paperos`'s existing `tldraw@3.15.6` pin is **not affected** by this ADR — it is a
  different product, already shipping, licensed correctly for its own use today. But it now carries
  a standing risk this ADR surfaces for the first time: bumping `tldraw` past `3.x` in that product
  would silently remove its free production license. Worth a note back to that repo's owners
  (outside this ADR's authority to act on).
* **Needs Justin:** none required to accept this decision (both winners are MIT, no waiver, no
  paid service). Flagging for awareness only: if a future issue wants tldraw specifically (its
  touch/pen/freehand strengths are real and scored higher than React Flow's), that is a recurring
  paid-license decision only Justin can make, not something to build against a mock.
* Screen-reader table navigation for either editor is an open question, not a confirmed gap (see
  research doc §Gaps). PAP-142 should include a real screen-reader pass before its own Definition
  of done is called complete.

## Alternatives rejected

* **`tldraw` 5.4.2 for the canvas** — rejected on license (Development-Environment-only free tier,
  as of the 4.x line) despite winning touch/pen, freehand drawing, PNG/SVG export and locked
  elements on raw capability. If a future surface specifically needs freehand ink at product
  quality, revisit with a real Business License budget, not as a workaround.
* **`tldraw` pinned at `3.15.6` for this product too** — considered, since that line's license does
  permit free watermarked production use. Rejected because pinning a security- and
  license-sensitive dependency two majors behind indefinitely is itself a maintenance liability
  (no upstream fixes, and the license clock is entirely tldraw's to reset on any patch release to
  that pinned line), and because it still fails the Yjs-binding-maturity and bundle-size criteria
  React Flow wins outright.
* **`@blocknote/core` for the editor** — rejected as the primary choice (heavier bundle, MPL-2.0
  vs MIT, fixed schema) but recorded as a later option: if a future PaperOS surface wants a
  Notion-style page with minimal wiring and can afford the bundle, BlockNote's pre-wired Yjs
  collaboration is a genuine time-saver.
* **Excalidraw, Miro-style whiteboard products** — out of scope per the spec; noted only as
  alternatives, not evaluated. Excalidraw is MIT and touch/pen-capable like tldraw but was excluded
  from full scoring by the spec's own Scope section.

## Reopen criteria

Reopen this ADR (new ADR that supersedes it, not an edit) if any of the following happen:

1. **PAP-209 merges** with a final `rubric.yaml` that scores either decision differently once run
   through `pnpm lib score` — re-score both decisions against the real rubric, not the draft used
   here.
2. **PAP-211 merges** with a license policy that treats tldraw's current text differently than the
   Review-tier assumption used here (e.g., if Development-Environment-only licenses are moved to
   Block for `bundled` context).
3. **A live FPS/convergence spike** (the follow-up recorded in the research doc's Gaps section)
   finds React Flow cannot sustain interactive frame rates at PAP-123's real `FlowGraph` scale, or
   that the Tiptap/Hocuspocus time-to-first-collaborative-render is unacceptable — neither was
   measured with a real browser in this session.
4. **tldraw ships a licensing change** that restores a free production path (their license has
   already changed once during this plan's lifetime; check the exact text again before any future
   ADR cites this one as settled).
5. **PAP-142 needs a Notion-style document surface** badly enough that BlockNote's pre-wired
   collaboration and schema outweigh its bundle size and license-tier cost — revisit as a
   surface-specific decision, not a reversal of this one.
