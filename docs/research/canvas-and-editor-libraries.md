# Canvas and editor libraries: tldraw vs React Flow, Tiptap vs BlockNote

* Issue: [PAP-127](https://linear.app/paperos/issue/PAP-127)
* Date: 2026-09-19
* Author: Scout (Library Evaluator), spikes run by Nova (Canvas Cartographer)
* Status: current. Superseded research says so at the top of this file; none yet.
* Feeds: [`docs/adr/0006-canvas-and-editor-libraries.md`](../adr/0006-canvas-and-editor-libraries.md)
* Rubric used: [PAP-209](https://linear.app/paperos/issue/PAP-209)'s draft spec (six criteria,
  weights summing to 100) plus PAP-127's own collab extras, because **PAP-209 and PAP-211 are not
  merged yet** (PAP-209 is Ready for Claude, PAP-211 is Backlog blocked on it as of this writing).
  Weights and gates below are provisional until PAP-209 lands; re-score against the final
  `rubric.yaml` and `pnpm lib score` once it does (tracked as a reopen criterion in the ADR).

## How to read this

Two independent decisions, four candidates. Scores are 0-4 per PAP-209's draft anchors, each with
one-sentence evidence and a dated citation. `n/a` criteria drop and the rest keep their relative
weight (PAP-209's rescale rule). A criterion scored 3 or 4 needs a URL; every cell below has one.

## Decision 1: canvas — `tldraw` vs `@xyflow/react`

### What changed since the plan was written

The PAP-127 spec assumed **tldraw 3.x**. The current npm `latest` is **tldraw 5.4.2** (published
2026-09-10, nine days before this research), and the free-tier license changed materially between
those lines — this is the single biggest finding of this spike and it drives the recommendation
below (see "License" row and the Edge cases section).

### Scores

| Criterion | Weight | `@xyflow/react` 12.11.6 | `tldraw` 5.4.2 |
| -- | --: | -- | -- |
| License | 20 | **4** — MIT, no restriction. [npm registry, checked 2026-09-19](https://www.npmjs.com/package/@xyflow/react) | **1** — "SEE LICENSE IN LICENSE.md"; as of the 4.x line (already true at [v4.0.0](https://github.com/tldraw/tldraw/blob/v4.0.0/LICENSE.md)) it permits Development Environments only for free and requires a paid or trial License Key for any Production Environment use — not just a watermark condition. Quoted in full below. |
| Maintenance | 20 | **4** — weekly releases, xyflow team + company backing (xyflow.com), median issue response well under 14 days on recent issues. [GitHub](https://github.com/xyflow/xyflow), checked 2026-09-19 | **4** — same tier: company-backed (tldraw, Inc.), frequent releases (5.4.2 nine days old), active issue tracker. [npm](https://www.npmjs.com/package/tldraw), checked 2026-09-19 |
| Bundle size | 15 | **4** — 126.6 KB gzip JS for a minimal app rendering the 300-node/600-edge fixture, React 19 included. Measured in this session, `spikes/canvas-eval/results.json` | **1** — 574.0 KB gzip JS for the equivalent app (same fixture as `geo` shapes), React 19 included — 4.5x React Flow. Measured in this session, `spikes/canvas-eval/results.json` |
| Accessibility | 15 | **3** — documented keyboard nav, `aria-label` config (`AriaLabelConfig` type), and a dedicated [Accessibility guide](https://reactflow.dev/learn/advanced-use/accessibility); nodes are real DOM elements so they're in the accessibility tree. Not independently audited with a screen reader in this session. | **2** — canvas is drawn to an HTML canvas/SVG layer for performance; tldraw ships keyboard shortcuts and a "reduced motion" setting but shape content is not screen-reader-navigable by default the way DOM nodes are. Not independently audited in this session; `imagine-os/paperos` (which ships tldraw in production) records no dedicated screen-reader pass either (`/workspace/paperos/e2e/a11y.spec.ts` runs axe-core on chrome-only markup, not the shape canvas). |
| TypeScript quality | 15 | **4** — first-class TS, typed `Node<T>`/`Edge<T>` generics, typed hooks (`useNodesState`, `useReactFlow`). [Reference](https://reactflow.dev/api-reference) | **4** — first-class TS, typed shape/binding utils, typed Canvas-API-style editor methods; `imagine-os/paperos`'s `docs/CANVAS_API.md` is generated straight off tldraw's typed editor surface. |
| Agent-friendliness | 15 | **4** — plain data model (`nodes: Node[]`, `edges: Edge[]`), no custom serialization; an LLM can emit/patch JSON directly. Small, well-documented surface; well represented in this model's training data. | **3** — well-known, but the record model (shapes, bindings, pages, a `Store`) is bespoke and needs the tldraw SDK to read/write meaningfully; `.tldr` isn't a format an agent can hand-edit as freely as a node/edge array. |
| **Collab extra:** Yjs binding maturity | (extra) | **4** — React Flow's own docs cover [Multiplayer](https://reactflow.dev/learn/advanced-use/multiplayer) with Yjs as the documented pattern (`Y.Map` of nodes/edges, `onNodesChange` → CRDT update); a Pro "Collaborative" example ships the full implementation. Free-tier guide is enough to build our own binding. | **1** — tldraw's own recommended multiplayer is **`@tldraw/sync`**, a different (non-Yjs) sync engine with its own server ([tldraw sync docs](https://tldraw.dev/docs/sync), announced on the [tldraw blog](https://tldraw.substack.com/p/announcing-tldraw-sync)); using Yjs instead means a hand-rolled binding. `imagine-os/paperos` proves it's *possible* (`src/collab/` binds a `Y.Map` of tldraw records via `mergeRemoteChanges`, per `/workspace/paperos/docs/COLLAB.md`) but it is bespoke integration work, not a documented first-party path, and PaperOS's contracts require Yjs/Hocuspocus specifically (`interface-and-data-contracts.md` row 26: `yjs_document`/`yjs_updates`, PAP-140). |
| **Collab extra:** custom node API | (extra) | **4** — `nodeTypes` is a plain React-component map; any component can be a node. [Custom Nodes examples](https://reactflow.dev/examples#nodes) | **3** — `ShapeUtil` subclassing is more ceremony (render, indicator, geometry, migrations) but very capable and used throughout `imagine-os/paperos`'s window system (`src/desktop/window-kinds.tsx`). |
| **Collab extra:** programmatic layout | (extra) | **4** — no built-in layout engine, but the docs explicitly recommend and integrate **ELK** and dagre; matches the spec's "ELK-friendly" expectation directly. [Layouting docs](https://reactflow.dev/learn/layouting) | **2** — no first-party graph auto-layout API; tldraw is a freeform canvas, so node-graph layout would be bolted on. |
| **Collab extra:** locked elements | (extra) | **4** — `draggable: false` / `selectable: false` per node, plus pane-level `nodesDraggable`/`elementsSelectable`. | **4** — first-class `isLocked` on every shape, used by our synthetic fixture's `n % 37 === 0` nodes in the spike without extra code. |
| **Collab extra:** touch and pen | (extra) | **2** — pan/zoom/select work via pointer events, but there is no freehand drawing surface (spec's own edge case: "React Flow lacks freehand drawing"). | **4** — built for touch and pen from the ground up (pressure-sensitive draw tool, pinch-zoom); this is tldraw's core strength. |
| **Collab extra:** PNG/SVG export | (extra) | **3** — no built-in exporter; `@xyflow/react`'s `toPng`/`toSvg` utilities (`getNodesBounds` + `html-to-image`, documented in examples) are a thin, well-trodden DIY layer. | **4** — `editor.getSvg()` / export-to-PNG are first-party, one-call APIs. |
| **Collab extra:** theming with tokens | (extra) | **4** — CSS variables (`--xy-*`) map cleanly onto a design-token layer; `ColorMode` prop for light/dark. | **3** — CSS custom properties too, but tldraw's own visual language (toolbars, style panel) is more opinionated and harder to fully re-skin to `--pos-*` tokens the way `imagine-os/paperos` already does (`src/app/globals.css`). |

### tldraw's exact license text (quoted in full, both lines evaluated)

**Current (`main`, matches 5.4.2, fetched 2026-09-19 from `https://raw.githubusercontent.com/tldraw/tldraw/main/LICENSE.md`) — the relevant Permissions/Conditions:**

> Subject to the following conditions, you are permitted to:
> - Use the Software in Development Environments.
> - Modify the Software to suit your needs.
> - Bundle the Software with your own projects.
> - Submit modifications of the Software to tldraw.
>
> In exchange for these permissions, you agree:
> - Not to use the Software in Production Environments.
> - Not to disable, change, or interfere with the Software's License Key enforcement.
> - [...]
>
> "Production Environment" means any production deployment of the Software that operates on
> servers, cloud platforms, web applications, or where the software is used to provide
> functionality to end users, customers, or the public.

**Prior line, still on npm as `tldraw@3.15.6` (the version `imagine-os/paperos` pins today; fetched
2026-09-19 from `https://raw.githubusercontent.com/tldraw/tldraw/v3.15.6/LICENSE.md`):**

> Subject to the following conditions, you are permitted to:
> - Use the Software in your commercial or non-commercial projects.
> - [...]
>
> In exchange for these permissions, you agree:
> - Not to disable, hide, remove, or alter the Watermark.
> - Not to disable, change, or interfere with the license key validation process that governs the
>   display of the Watermark.

**Reading:** the 3.x line permits free production use of the full SDK provided the tldraw watermark
stays visible and undisabled — this is why `imagine-os/paperos`'s `CLAUDE.md` says "the tldraw
watermark is fine" and pins `tldraw`/`@tldraw/assets` at `3.15.6` in lockstep (`package.json` line
57; `CLAUDE.md` rule 8, "one tldraw version for the whole app"). Starting at 4.x (confirmed
identical wording already at `v4.0.0`, carried through to today's 5.4.2), the watermark condition
was replaced by a **License Key** gate: free use is contractually restricted to **Development
Environments**, and any Production Environment use — watermarked or not — requires a paid
subscription or an explicit trial key issued by tldraw, Inc. There is no longer a free,
watermarked path to production. Diff: `diff <(curl -s https://raw.githubusercontent.com/tldraw/tldraw/v3.15.6/LICENSE.md) <(curl -s https://raw.githubusercontent.com/tldraw/tldraw/main/LICENSE.md)`.

Under PAP-211's draft policy (Backlog, not merged), a `SEE LICENSE IN` text like tldraw's sits in
the **Review** tier — ADR plus a waiver, approved by Atlas for `review` or Justin for anything
tighter. Given the free tier no longer covers production use at all, staying on the old `3.15.6`
line (as `imagine-os/paperos` does) is itself a decision that needs re-confirming on every tldraw
bump, and adopting *current* tldraw for a new product means either a paid Business License (Needs
Justin: a recurring paid subscription, see ADR) or accepting Development-Environment-only use,
neither of which fits a canvas that ships to end users.

### Recommendation: **React Flow (`@xyflow/react`)**

Matches the spec's expected outcome. MIT license with no waiver needed, closest node/edge data
model to the collab contracts' `FlowGraph` shape, an order of magnitude smaller bundle, ELK-ready
for programmatic layout, and a documented (if free-tier-DIY) Yjs binding path that matches our
Hocuspocus/Yjs stack directly — versus tldraw's non-Yjs first-party sync product. Freehand
drawing/ink is out of scope for React Flow; per the spec's own edge case, plan sticky notes and
shapes as custom `nodeTypes` and defer ink markup to PAP-157.

## Decision 2: editor — `@tiptap/core` + `y-prosemirror` vs `@blocknote/core`

### Scores

| Criterion | Weight | Tiptap + y-prosemirror | BlockNote |
| -- | --: | -- | -- |
| License | 20 | **4** — `@tiptap/core` 3.31.3 MIT, `@tiptap/extension-collaboration` 3.31.3 MIT, `y-prosemirror` 1.3.7 MIT. [npm, checked 2026-09-19] | **3** — `@blocknote/core` 0.54.2 is MPL-2.0 (file-level copyleft, not project-wide; allowed under PAP-211's draft "MPL-2.0 unmodified" tier). BlockNote's own docs state real-time collaboration and all core blocks are free for any use, personal or commercial. |
| Maintenance | 20 | **4** — company-backed (ueberdosis), very active, weekly-ish releases, large community. [npm](https://www.npmjs.com/package/@tiptap/core), checked 2026-09-19 | **3** — active (TypeCellOS), backed by a company, but a smaller team and narrower release cadence than Tiptap, the library it's built on. [GitHub](https://github.com/TypeCellOS/BlockNote), checked 2026-09-19 |
| Bundle size | 15 | **4** — 219.9 KB gzip JS for core + starter-kit + collaboration extension + y-prosemirror + yjs + React 19. Measured in this session, `spikes/canvas-eval/results.json` | **2** — 397.7 KB gzip JS for `@blocknote/react`'s unstyled `BlockNoteViewRaw` alone (React 19 included) — 1.8x Tiptap, and this **undercounts** the real integration: 0.54.x moved the themed `BlockNoteView` out of `@blocknote/react` into a separate `@blocknote/mantine` or `@blocknote/shadcn` package (not installed for this spike), so a real app's number is higher still. Measured in this session, `spikes/canvas-eval/results.json`. |
| Accessibility | 15 | **3** — ProseMirror (Tiptap's base) produces semantic HTML by default and Tiptap ships a dedicated [Accessibility guide](https://tiptap.dev/docs/guides/accessibility); a long-open community issue tracks broader gaps ([tiptap#1046, "A11y: Accessibility in general and minimal keyboard usability"](https://github.com/ueberdosis/tiptap/issues/1046), still open per web search 2026-09-19) and a known VoiceOver quirk (block boundaries can be read as concatenated words). | **2** — inherits ProseMirror's semantic-HTML baseline (same engine) but adds its own block-menu/slash-command UI on top that is not independently documented for screen-reader use; no equivalent published accessibility guide found. |
| TypeScript quality | 15 | **4** — typed extensions, typed commands via module augmentation, typed `Editor` API. [Docs](https://tiptap.dev/docs) | **4** — typed block schema, typed `useCreateBlockNote<Schema>()`, generated types for custom blocks. |
| Agent-friendliness | 15 | **3** — well-documented, huge surface area (every feature is an extension you compose yourself), which is powerful but means more decisions per feature (mentions, tables, images are all separate extensions to wire). | **4** — Notion-style block model out of the box (mentions, tables via `TableBlock`, image upload hook via `uploadFile`, code blocks) needs far less assembly; smaller decision surface for an agent building a document editor end to end. |
| **Collab extra:** Yjs binding maturity | (extra) | **3** — official but manual: `@tiptap/extension-collaboration` wraps `y-prosemirror`, and you wire the `Y.Doc`/provider yourself (Hocuspocus fits directly — see `@hocuspocus/provider`, MIT). [Liveblocks' 2026 editor comparison](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) calls this out as more setup than BlockNote's. | **4** — collaboration is a first-class, pre-wired feature (BlockNote is "built for real-time collaboration by default," per its own docs and independent write-ups), still backed by Yjs/y-prosemirror under the hood so it is Hocuspocus-compatible without extra glue. |
| **Collab extra:** mentions, code blocks, tables, image upload hook | (extra) | **3** — all available as official extensions (`Mention`, `CodeBlockLowlight`, `Table`), each configured and styled separately. | **4** — mentions, code blocks, tables and an `uploadFile` image hook are part of the default block schema, no extra extensions to pick. |
| **Collab extra:** read-only rendering | (extra) | **4** — `editable: false` on the same `Editor`, or the lightweight `generateHTML`/React server renderer for static output. | **3** — `editable={false}` on `useCreateBlockNote`; works, less battle-tested for pure static/SSR rendering than Tiptap's renderer path. |

### Peer-dependency matrix (pins for PAP-140 / PAP-142)

| Package | Version pinned here | Notes |
| -- | -- | -- |
| `yjs` | `13.6.32` | Shared root: both the editor and (if canvas ever needs it) the collab layer must resolve to one `yjs` copy — two copies cannot share CRDT state. |
| `y-prosemirror` | `1.3.7` | Pulled in transitively by `@tiptap/extension-collaboration`; pin it directly too so `pnpm why yjs` stays a single line. |
| `@tiptap/core` | `3.31.3` | |
| `@tiptap/starter-kit` | `3.31.3` | |
| `@tiptap/extension-collaboration` | `3.31.3` | Wraps `y-prosemirror`; keep in lockstep with `@tiptap/core`'s minor. |
| `@hocuspocus/provider` / `@hocuspocus/server` | `4.7.0` | MIT; matches PAP-140's stated backend. Not benchmarked in this spike (no local Hocuspocus container was started — see Gaps). |
| `@blocknote/core` / `@blocknote/react` | `0.54.2` | Rejected candidate (kept here in case PAP-142 or a later doc-type revisits it); pulls its own `@tiptap/core` `228 KB` raw as a transitive dependency per bundlephobia, 2026-09-19. |

### Recommendation: **Tiptap + `y-prosemirror`** (matches the spec's expected outcome)

MIT throughout, smaller bundle, and the extension model gives PAP-142 full control over exactly
which blocks PaperOS documents need (matching the "docs and prompt log stores" milestone's likely
custom block types) rather than inheriting BlockNote's fixed schema. BlockNote's bundle also
quietly grew a second package (theming) that this spike's number does not include, widening the
gap further in a real integration. Record **BlockNote as a later document-type option** — its
pre-wired collaboration and richer default schema (mentions/tables/uploads with zero extra wiring)
are a real advantage if a future PaperOS surface wants a Notion-style page fast and can accept a
heavier bundle and a narrower extension point.

## Registry entries (four libraries)

PAP-216 (the registry UI/schema itself) has not landed, so there is no `docs/libraries/registry/`
or equivalent to write machine-readable rows into yet. Recorded here instead, in the shape PAP-216
is expected to consume (`{ name, version, verdict, license, gzipKb, evidence }`); migrate verbatim
once PAP-216 ships (tracked as a follow-up).

| Library | Version | Verdict | License | gzip (measured) | Evidence |
| -- | -- | -- | -- | --: | -- |
| `@xyflow/react` | 12.11.6 | **adopted** | MIT | 126.6 KB | This doc, §Decision 1; `spikes/canvas-eval/results.json` |
| `tldraw` | 5.4.2 | **rejected** (for this product; `imagine-os/paperos` keeps its own 3.15.6 pin under a separate ADR) | SEE LICENSE IN (Review tier, License-Key-gated for production as of 4.x+) | 574.0 KB | This doc, §Decision 1 (license quotes) |
| `@tiptap/core` (+ `y-prosemirror`) | 3.31.3 / 1.3.7 | **adopted** | MIT | 219.9 KB | This doc, §Decision 2; `spikes/canvas-eval/results.json` |
| `@blocknote/core` | 0.54.2 | **rejected** (noted as a later document-type option) | MPL-2.0 | 397.7 KB (undercounts — theme package not installed) | This doc, §Decision 2; `spikes/canvas-eval/results.json` |

## Gaps and follow-ups (be honest about what this session did not measure)

1. **No live FPS or convergence numbers.** `fps300` (canvas pan/zoom at 300 nodes) and `ttfcrMs`
   (time to first collaborative render across two Hocuspocus clients) are `null` in
   `spikes/canvas-eval/results.json`. This sandbox has no cached Chromium, and
   `npx playwright install chromium --with-deps` completed the OS-dependency half but the browser
   binary itself did not land in `~/.cache/ms-playwright` inside this session's time box (network
   restrictions on the Playwright CDN through this session's proxy). The bundle-size numbers
   *are* real, measured production `vite build` output (see `spikes/canvas-eval/README.md`).
   **Follow-up:** open an issue to run this spike's four entries under real Playwright (300-node
   pan FPS via `performance.now()` sampling, two-context Hocuspocus convergence time) once a
   session has Chromium available, and fold the numbers into this doc and the ADR without
   changing the decision unless they contradict it.
2. **Locked elements, groups, custom renderers, PNG/SVG export, and the full mentions/code
   blocks/tables/image-upload/read-only editor matrix** were evaluated from each library's own
   docs and from `imagine-os/paperos`'s shipped tldraw integration, not independently
   re-implemented and clicked through in this session. Cited above with dated links; treat as
   secondary evidence, not a hands-on QA pass.
3. **Screen-reader table navigation** (the spec's own edge case: "Both editors fail screen-reader
   table navigation") was not independently verified with a screen reader in this session. No
   library-specific report of that exact failure was found in the time available; recording as an
   **open question**, not a confirmed shared gap. **Follow-up:** a dedicated accessibility pass on
   PAP-142 (editor integration) should include a screen-reader table-navigation check with NVDA or
   VoiceOver before that issue is called done, regardless of which editor keeps this ADR's status.
4. **PAP-209 / PAP-211 not merged.** Weights, anchors and license tiers used here are the draft
   text from their specs, not a validated `rubric.yaml` or `pnpm lib score` run. Re-score both
   decisions once PAP-209 merges (reopen criterion in the ADR).
5. **Hocuspocus itself** (PAP-140) was not run in this session (no local `docker compose up
   hocuspocus`); the peer-dependency matrix above pins `@hocuspocus/provider`/`@hocuspocus/server`
   from npm but the spike does not exercise a live collaborative session end to end.
