# 0022. Device matrix: seven breakpoints, six device classes

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-14](https://linear.app/paperos/issue/PAP-14)
* Deciders: Scout (research), Forge (feasibility)

## Context

Every DoD in the PaperOS plan needs a shared vocabulary for "what widths and device classes does this have to work on": PAP-21 implements it as container queries, PAP-82 screenshots against it, PAP-84 replays videos against it, and PAP-70/154/158 design against it. PAP-14 was asked to research and decide that vocabulary: the width tiers, the device classes (phone, tablet, laptop, desktop, TV/kiosk, foldable), DPR/pointer/hover/safe-area assumptions per tier, and test-device recommendations — as one machine-readable file, so downstream code never hand-copies numbers.

The issue proposed a starting point to confirm or overturn with data: `320/375/768/1024/1280/1536/1920` plus an optional eighth `tv 3840`. Current traffic data (StatCounter, Steam Hardware Survey, Apple/Samsung device specs — see `docs/research/device-matrix.md` for full citations) shows the dominant real-world widths have moved since that starting point was written, and the org's other build documents already assume a different seven-width set.

## Decision

Adopt seven width tiers — `xs 360`, `sm 390`, `md 768`, `lg 1280`, `xl 1920`, `2xl 2560`, `3xl 3840` — as `BREAKPOINTS: readonly Breakpoint[]` in `packages/core/src/devices/matrix.ts` (pure TypeScript, no `node:*` imports, keeping `@paperos/core`'s contract-zero purity), whose `toBreakpointsJson()` is written to `ops/ci/breakpoints.json` (schema `{ version, breakpoints: [{ name, width, height, deviceScaleFactor, hasTouch, isMobile }] }`) by the `scripts/gen-breakpoints.ts` CLI (`node scripts/gen-breakpoints.ts [--check]`; wiring it as `pnpm gen:breakpoints` needs a package.json script, a wave-0 follow-up — see Consequences). `BreakpointName` is the exhaustive union `'xs'|'sm'|'md'|'lg'|'xl'|'2xl'|'3xl'`.

Adopt six device classes — phone, tablet, laptop, desktop, TV/kiosk, foldable — as `DEVICE_CLASSES: readonly DeviceClass[]` in the same file, each anchored to a breakpoint tier but carrying its own `pointer`/`hover`/`orientation`/`safeArea` overrides, because two pairs of classes share a width tier but not an input model: tablet and foldable-unfolded both sit at `md`; desktop-4K and TV/kiosk both sit at `3xl`.

`PLAYWRIGHT_DEVICES` gives PAP-82 a `{ viewport, deviceScaleFactor, hasTouch, isMobile }` config per tier as explicit values rather than named Playwright presets, so the exact widths are guaranteed regardless of the installed Playwright version.

A `MATRIX_VERSION` constant is carried into the generated JSON's `version` field; bumping it is the signal that PAP-82's screenshot baselines need regeneration.

Full rationale, every numeric claim's dated source, the rejected alternatives and the physical/emulated test-device recommendations are in `docs/research/device-matrix.md` (this ADR is the decision record; that file is the research).

## Consequences

- PAP-21 implements container queries and any remaining viewport media queries against these seven names; it must not invent new tier names or widths.
- PAP-82's Playwright visual-regression project and PAP-84's video replays read `ops/ci/breakpoints.json` (or `PLAYWRIGHT_DEVICES`) rather than hard-coding widths, and must regenerate baselines whenever `MATRIX_VERSION` bumps.
- TV/kiosk and desktop share the `3xl` width but diverge sharply in input and legibility rules (§7 of the research doc) — any code branching on device class, not just width, needs `DEVICE_CLASSES`, not `BREAKPOINTS`, as its source.
- The `packages/core` barrel (`src/index.ts`, owned by app-shell per its own `README.md`) does not yet re-export `./devices`, and `packages/core/package.json` has no `"./devices"` subpath export, so `@paperos/core/devices` (the import path the interface contract names) does not resolve yet — a follow-up (app-shell review) adds both once a second consumer needs the package import rather than a relative one.
- `node scripts/gen-breakpoints.ts` and `--check` work today but are not wired into a named `pnpm` script or a `turbo.json`/CI task, since both require a root-file edit out of this issue's wave-0 scope; a follow-up adds the script name and the CI staleness gate.
- Review date 2027-01: re-confirm the seven widths against fresh StatCounter/Steam data and re-check whether the W3C Device Posture API has shipped outside an origin trial.

## Alternatives rejected

- **Keep the issue's original starting widths** (`320/375/768/1024/1280/1536/1920` + optional `tv 3840`): rejected — 320/375 undercount the current dominant phone viewports (360/390), and folding 1440p into "≥1920" ignores its now-sizable and growing desktop share. See research doc §10 for the full comparison.
- **An eighth `tv` breakpoint** distinct from `3xl`: rejected — the interface contract fixes `BreakpointName` at seven names, and TV/4K-desktop share a CSS width; `DEVICE_CLASSES` is the right place for their differences, not another width tier.
- **Named Playwright device presets**: rejected for the generated config — they drift with the Playwright version installed and don't guarantee the exact seven widths this ADR commits to.
