# spikes/\_kit — shared spike harness (PAP-753)

`_kit` is not a spike itself; it is the harness five spikes were about to write
five times over (PAP-212, PAP-292, PAP-293, PAP-294, PAP-127, per PAP-753's
Goal). It measures **bundle size**, **wall time and memory**, and, when a real
Chromium is available, **in-browser FPS**, in one schema every spike writes
and PAP-209's rubric CLI reads back with `pnpm lib score --facts-from <dir>`.

Like every other folder under `spikes/`, `_kit` is deliberately outside the
pnpm workspace (see the root `spikes/README.md` and `CLAUDE.md` "Adding a
package") — nothing in `apps/*` or `packages/*` may import it, and it is
excluded from `turbo build`/`pnpm check` by construction (its path matches no
glob in the root `pnpm-workspace.yaml`).

## Scaffolding a new spike

From the repo root:

```bash
node scripts/spike-new.mjs PAP-292 table-libraries
# -> spikes/PAP-292-table-libraries/ (package.json, bench.config.ts, candidates/example/, README.md)
cd spikes/PAP-292-table-libraries
pnpm install --ignore-workspace   # standalone; do not run a plain `pnpm install` (see below)
pnpm add @tanstack/react-table    # add each real candidate's own dependency here
```

Edit `bench.config.ts`'s `candidates[]` (one entry per library under test,
pointing at `candidates/<id>/index.html` and/or `candidates/<id>/workload.ts` —
see "Candidate contract" below), then:

```bash
pnpm bench              # bundle + runtime, no browser (fast, no Chromium needed)
pnpm bench:browser       # bundle + runtime + browser FPS (needs Chromium)
pnpm scorecard <id> --issue PAP-292 --out docs/libraries/scorecards/<id>@<version>.yaml
```

`--ignore-workspace` matters: this folder is outside the `apps/*` / `packages/*`
globs in the root `pnpm-workspace.yaml`; a plain `pnpm install` from inside it
resolves against the monorepo root instead and touches the *root*
`pnpm-lock.yaml`, which is PAP-13's file, not a spike's.

## Candidate contract

Each candidate is a folder under the spike's own `candidates/<id>/`:

| File | Required for | What it is |
| -- | -- | -- |
| `index.html` + `index.tsx` (or `.jsx`) | bundle size, browser FPS | A minimal single-entry app mounting the library under test, same shape as `spikes/canvas-eval`'s per-library entries. |
| `workload.ts` | wall time, memory | Exports `runWorkload(): void \| Promise<void>` (timed) and an optional `setup()` (untimed, for seeding fixture data once). |
| `styles.css` (optional, imported from `index.tsx`) | — | Allowed per PAP-753's edge case; note it in the spike's README as a composability finding if the library needs one. |

A candidate that cannot run at all under the framework version in use (for
example, a library without a React 19 peer range) is declared, not measured:
set `expectedFailure: 'peer'` on its `bench.config.ts` entry and the runner
writes `status: "failed:peer"` with every numeric field `null`, instead of the
run crashing.

## What is measured, and how

* **Bundle** (`src/bundle.ts`) — `vite build` (production, esbuild minify) of
  the candidate's `index.html`, gzip(-9) of every emitted `.js` asset, minus
  the same build of the shared `baseline/` entry (React + ReactDOM, nothing
  else). The difference (`gzipBytes - sharedBaselineGzipBytes`, computed by
  `subtractBaseline`) is the library's own weight; the two raw numbers are
  also kept so a later pass can re-derive the diff without re-running Vite.
* **Runtime** (`src/runtime.ts`) — times `workload.ts`'s `runWorkload()` with
  `performance.now()` across 3 runs (default) and samples
  `process.memoryUsage()` around the last one. Reports `unstable` (and sets
  the candidate's overall `status` to `"unstable"`) when the three runs
  disagree by more than 5% of their mean, per PAP-753's "reproducible within 5
  percent across three runs or the script reports unstable."
* **Browser** (`src/browser.ts`) — when
  `PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers` on PaperOS build containers)
  points at an installed Chromium, builds the candidate, serves the `dist/`
  output over plain HTTP (not `file://` — Vite's absolute asset base breaks
  under `file://`), opens it headless, and samples `requestAnimationFrame`
  intervals for 5 seconds to report mean/p5 FPS and a count of frames over
  50ms ("long frames").

  **Deviation from the original PAP-753 spec text**, which describes reading
  Chrome DevTools Protocol `DrawFrame` trace events: this kit samples
  `requestAnimationFrame` timestamps from inside the page instead. A rAF
  sample needs no CDP session, trace category list or event parsing, and
  reports the same mean/p5 FPS a DrawFrame trace would; the cost is not
  separately distinguishing compositor-only frames from main-thread frames, a
  distinction none of PAP-753's five consumer specs (PAP-212, PAP-292,
  PAP-293, PAP-294, PAP-127) rely on. Recorded on the PAP-753 `Session ended`
  comment.

## Declaring "not measured"

Every numeric field in the schema (`src/schema.ts`, `schema/results.schema.json`)
is nullable, and every measuring function returns the module's `empty*()`
helper — `emptyBundle()`, `emptyRuntime()`, `emptyBrowser()` — with a
human-readable `notMeasuredReason` string, rather than a bare `0`. This
mirrors the convention already in `spikes/PAP-31-sync-eval` ("`null` means
*not measured*, never zero") and `spikes/canvas-eval` ("left null with a
note"): **a `0` is always a real zero-byte or zero-frame measurement, never a
stand-in for "couldn't measure it."** A candidate whose Chromium is missing
still gets a complete, schema-valid result; only its `browser.*` fields (and
`notMeasuredReason`) are `null`.

## What this kit does *not* do

* **Score anything.** `src/scorecard.ts` fills a scorecard's `facts` from
  measured numbers; `scores`, `gates` and `verdict` are always emitted as
  placeholders (`null` / `"pending"`). Scoring against the rubric's anchors is
  judgement (`docs/platform/library-rubric.md` section 2), owned by PAP-209's
  `pnpm lib score`, not by this kit.
* **Screenshots or an accessibility scan.** The original PAP-753 spec text
  also asked for `scripts/shots.ts` (375/1024/1920, light/dark, axe) and a
  Tauri secondary-window check. Both are out of this pass's scope (this build
  targeted bundle/runtime/browser-FPS/scorecard, per the PAP-753 build
  session's brief); a future pass can add them as `--shots` and
  `--tauri-window` flags on `src/run.ts` without changing the results schema
  (`browser`/`bundle` already have room, and a `shots`/`a11y` top-level field
  can be added to `CandidateResultSchema` the same nullable way).
* **A root `pnpm spike` command.** The root `package.json` is PAP-13's file
  (`CLAUDE.md` "Touch only your paths"); `scripts/spike-new.mjs` is a plain
  `node` script run directly, not wired into any root `package.json` script.

## Proving it (evidence, not shipped)

This kit was proven end to end by scaffolding a throwaway
`spikes/PAP-753-proof2/` spike (`node scripts/spike-new.mjs PAP-753 proof2`)
with a real workload (sorting a 200k-element `Float64Array`) and mount, then
running `pnpm bench:browser` (bundle + runtime + browser) and `pnpm scorecard`.
It produced `status: "ok"`, `runtime.stable: true` across 3 runs (mean 60.6ms,
p5 59.1ms — well within 5%), a real bundle diff, and real browser FPS
(`meanFps: 60.0`, `longFrames: 0`) against the cached Chromium — then the
scorecard emitter rendered the rubric's YAML shape from those numbers. The
throwaway spike was deleted before this branch was pushed; the captured
output is in the PAP-753 `Session ended` Linear comment, not committed here.
