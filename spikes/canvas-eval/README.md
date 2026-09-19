# Spike: canvas and editor library bundle size (PAP-127)

Throwaway spike backing `docs/adr/0006-canvas-and-editor-libraries.md`. Not imported by any app
or package; never wired into `pnpm check`.

## What this measures

A production `vite build` of four minimal single-entry apps, one per candidate:

| Entry | Library under test |
| -- | -- |
| `canvas-xyflow.html` / `src/canvas-xyflow.jsx` | `@xyflow/react` 12.11.6, rendering the 300-node / 600-edge synthetic `FlowGraph` fixture (`fixtures/flowgraph.mjs`, standing in for PAP-123) |
| `canvas-tldraw.html` / `src/canvas-tldraw.jsx` | `tldraw` 5.4.2, seeding the same 300-node fixture as locked/unlocked `geo` shapes |
| `editor-tiptap.html` / `src/editor-tiptap.jsx` | `@tiptap/core` + `@tiptap/starter-kit` + `@tiptap/extension-collaboration` (wraps `y-prosemirror`) over a local `Y.Doc` |
| `editor-blocknote.html` / `src/editor-blocknote.jsx` | `@blocknote/react` 0.54.2 (`BlockNoteViewRaw` — see note in that file: 0.54.x moved the themed `BlockNoteView` into separate `@blocknote/mantine` / `@blocknote/shadcn` packages, not installed here) |

`node scripts/measure.mjs` (or `pnpm bench`) builds each with `vite build --config vite.<entry>.config.js`,
gzips (`-9`) every `.js` asset the build emits, and writes `results.json` in the shape PAP-127's
interface contract specifies (`{ canvas: {...}, editor: {...} }`).

React 19 + ReactDOM 19 are bundled into every one of the four numbers, so the totals are apples to
apples with each other — but not directly comparable to a vendor's own "gzip size" badge, which
usually excludes React.

## Results (measured 2026-09-19, this sandbox, Vite 7.3.6 / esbuild minify)

| Candidate | gzip JS (KB) | vs. baseline |
| -- | --: | -- |
| `@xyflow/react` 12.11.6 | 126.6 | 1x (smallest canvas option) |
| `tldraw` 5.4.2 | 574.0 | 4.5x React Flow |
| `@tiptap/core` + `y-prosemirror` 3.31.3 / 1.3.7 | 219.9 | 1x (smallest editor option) |
| `@blocknote/react` 0.54.2 (raw view) | 397.7 | 1.8x Tiptap, and undercounts the real BlockNote bundle since the theme package (`@blocknote/mantine`, typically +30-60 KB gzip) isn't installed |

Full machine-readable numbers: [`results.json`](./results.json).

## What this spike does *not* measure, and why

* **`fps300` (canvas pan/zoom FPS at 300 nodes) and `ttfcrMs` (time to first collaborative
  render)** are `null` in `results.json`. Both need a real browser: this sandbox has no cached
  Chromium and the Playwright Chromium download did not complete over the proxy in the time
  budgeted for this issue (`npx playwright install chromium` ran but no browsers landed in
  `~/.cache/ms-playwright`). No FPS or convergence numbers in this ADR are measured; they are
  either cited from a source (with a date) or explicitly marked as unverified.
* **Locked elements, groups, custom renderers, touch/pen, PNG/SVG export, mentions, code blocks,
  tables, image upload hook, read-only rendering, and the two-browser-context Hocuspocus
  convergence test** the full PAP-127 spec asks for were evaluated from each library's own docs,
  changelog and GitHub issues (cited in the research doc) and from `imagine-os/paperos`'s existing,
  shipped tldraw + Yjs integration (`/workspace/paperos/docs/COLLAB.md`), not re-implemented here.
  Building a second, from-scratch multiplayer spike (Docker Hocuspocus + two Playwright contexts)
  was out of this session's time box once the license finding below made the canvas decision clear
  without it; see "Gaps and follow-ups" in the research doc and the ADR's reopen criteria.

## Reproduce

```bash
cd spikes/canvas-eval
pnpm install --ignore-workspace   # standalone; NOT part of the repo's pnpm workspace
pnpm bench                        # builds all four, writes results.json
```

`--ignore-workspace` matters: this folder is deliberately outside the `apps/*` / `packages/*`
globs in `pnpm-workspace.yaml`, and running a plain `pnpm install` from inside it resolves against
the monorepo root instead and regenerates the *root* `pnpm-lock.yaml` / `node_modules` as a side
effect (harmless — it only reinstalls what the root `package.json` already declares — but it's
PAP-13's file to own, not this spike's, so don't do it).
