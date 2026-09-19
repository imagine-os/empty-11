# The PaperOS spike harness

Status: v1, 2026-09-19. Owner: Scout (Library Evaluator). Issue: PAP-753.

Five research issues — PAP-212, PAP-292, PAP-293, PAP-294 and PAP-127 — each
described the same harness: measure a handful of library candidates the same
way, write the numbers to one schema, and feed a scorecard. `spikes/_kit/`
builds it once so those five spikes (and any later library comparison) measure
like with like, and PAP-209's rubric CLI (`pnpm lib score --facts-from <dir>`,
[`docs/platform/library-rubric.md`](library-rubric.md) section 8) reads any of
them without a per-spike adapter.

## Where it lives, and why it is not a workspace package

`spikes/_kit/` is a standalone package next to the spikes it serves — outside
the pnpm workspace (`spikes/**` matches no glob in the root
`pnpm-workspace.yaml`), so `pnpm check`, `turbo build` and the root Vitest
workspace never see it, the same way every other folder under `spikes/`
already works (`spikes/README.md`). It ships its own `package.json`,
`vitest.config.ts` and `tsconfig.json`, and is installed with
`pnpm install --ignore-workspace` from inside it.

A scaffolded spike does **not** vendor a copy of the harness. Its `package.json`
scripts shell out to `tsx ../_kit/src/run.ts .` and `tsx ../_kit/src/scorecard.ts .`
— a relative import into the one `_kit/` copy of the measuring code, resolved
against `_kit/node_modules` the normal Node way. This means:

* The Vite, Playwright and Zod versions, and every bug fix to the measuring
  code, live in exactly one `package.json` and one set of source files.
* A scaffolded spike's own `package.json` only needs the candidate libraries'
  own dependencies (`pnpm add @tanstack/react-table`, etc.) — not Vite,
  Playwright or Zod again.
* `_kit/` must not move or be renamed without updating every spike's
  `../_kit/...` script paths (there is no version negotiation between a spike
  and the kit; they are siblings by convention, matching the PAP-13 spike
  directory convention `<PAP-n>-<slug>/`).

## What is measured

See [`spikes/_kit/README.md`](../../spikes/_kit/README.md) "What is measured,
and how" for the full method (bundle via `vite build` + gzip minus a shared
React baseline; wall time via `performance.now()` and memory via
`process.memoryUsage()` across 3 runs, reporting `unstable` outside 5%;
browser FPS via a `requestAnimationFrame` sample in headless Chromium when
`PLAYWRIGHT_BROWSERS_PATH` has a cached build) and its two documented
deviations from the original PAP-753 spec text (rAF sampling instead of a
Chrome DevTools Protocol `DrawFrame` trace; scanning for any cached
`chromium-<revision>/chrome-linux/chrome` binary and launching it via
`executablePath` instead of trusting `@playwright/test`'s own expected
revision, because the two are cached and installed independently on a build
container and can drift apart).

## The results schema

One Zod schema, `spikes/_kit/src/schema.ts`, generates
`spikes/_kit/schema/results.schema.json` (`pnpm --filter . gen:schema`, run
from inside `_kit/`; `gen:schema:check` fails on drift). A spike's
`pnpm bench` writes `results/<candidate-lib>.json` per candidate plus
`results/summary.json` (the aggregate PAP-209's `--facts-from <dir>` reads)
and a rendered `results.md` table.

**Declaring "not measured."** Every numeric field is nullable, and every
measuring function returns `null` with a `notMeasuredReason` string rather
than a bare `0` — the same convention `spikes/PAP-31-sync-eval` and
`spikes/canvas-eval` already used ("`null` means *not measured*, never
zero"). This is why `subtractBaseline()`, `measureRuntime()` and
`measureBrowserFps()` each have an `empty*()` counterpart in
`spikes/_kit/src/schema.ts`: every failure path returns one of those, never a
partially-filled object with stray zeros.

## The scorecard emitter

`pnpm scorecard <candidate-id> --issue PAP-<n> [--out path.yaml]` (from a
scaffolded spike) fills a scorecard's `facts` from that candidate's measured
`results/<id>.json` and emits the rest of
[`docs/platform/library-rubric.md`](library-rubric.md) section 9's YAML shape
as placeholders (`score: null`, `result: "pending"`, `verdict: "pending"`).
**It never scores anything** — the rubric's anchors (section 2) are judgement,
owned by PAP-209's `pnpm lib score`, and nudging a number to change a verdict
is explicitly a review failure there. The emitted file is meant to be edited
by hand (or by the character doing the evaluation) and then moved into
`docs/libraries/scorecards/<candidate>@<version>.yaml`.

## Scaffolding

```bash
node scripts/spike-new.mjs PAP-<n> <slug>
```

is a plain root-level `node` script (allowed under PAP-753's paths; **not**
wired into the root `package.json`, which stays PAP-13's file — see
`CLAUDE.md` "Touch only your paths"). It writes
`spikes/<PAP-n>-<slug>/{package.json,bench.config.ts,README.md,candidates/example/*}`
from the template embedded in the script; see
[`spikes/_kit/README.md`](../../spikes/_kit/README.md) "Candidate contract" for
what each candidate folder needs.

## What was proven, and how

The kit was proven end to end during the PAP-753 build session: a throwaway
`spikes/PAP-753-proof2/` was scaffolded with `spike-new.mjs`, its `example`
candidate (a real workload: sorting a 200k-element `Float64Array`) ran
`pnpm bench:browser` (bundle + runtime + browser FPS, against the real cached
Chromium at `/opt/pw-browsers`) end to end, producing `status: "ok"`,
`runtime.stable: true` across the 3 required runs, a real bundle diff and real
FPS numbers (`meanFps: 60.0`); the result validated against the Zod schema,
`pnpm scorecard` rendered the rubric's YAML shape from the measured numbers,
and the throwaway spike was deleted before this branch was pushed — captured
output is in the PAP-753 `Session ended` Linear comment, not committed to the
repo (it was never a real finding).

## What this pass did not build

The original PAP-753 spec text also asked for a `scripts/shots.ts`
(screenshots at 375/1024/1920, light/dark, plus an axe accessibility scan) and
a `scripts/tauri-window.ts` secondary-window check for PAP-212's portal test.
Neither is in this pass — the results schema and `run.ts`'s flag pattern
(`--bundle`/`--runtime`/`--browser`) have room to add `--shots`/`--tauri-window`
without a breaking schema change (a nullable `shots`/`a11y` field on
`CandidateResultSchema`, following the same "empty helper, never a bare `0`"
convention as the three fields that exist today). Filed as follow-up scope,
not built here — see the PAP-753 `Session ended` comment.

## Migrating the pre-existing one-off spikes

`spikes/PAP-31-sync-eval`, `spikes/canvas-eval` and `spikes/crdt-bench` were
built before this kit merged (per PAP-753's Dependencies note: "they build
inline if the kit is unmerged, then migrate"). Migrating them to `_kit` is
follow-up, not part of this issue — none of the three needs to change for
existing consumers (PAP-31, PAP-127, PAP-139) to keep working.
