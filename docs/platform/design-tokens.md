# Design tokens (`@paperos/tokens`)

PAP-66. Owner: Iris (Token Keeper). ADR: [0018-design-tokens](../adr/0018-design-tokens.md).

Every visual decision in PaperOS — colour, type, space, radius, shadow, motion, z-index,
breakpoint, sizing — has exactly one source of truth: the DTCG JSON files in
`packages/tokens/tokens/`. Nothing else writes a colour literal, a `px` gap or a `border-radius`
value; components, generated pages and email/PDF templates all read a `--pos-*` CSS custom
property or a `tokens.*` TypeScript reference.

## Files

```
packages/tokens/
  tokens/
    core.tokens.json          Primitives: colour ramps, type scale, space, radius, shadow,
                               motion, z-index, breakpoint, sizing. Never referenced directly
                               from a component -- only from semantic.tokens.json or a theme file.
    semantic.tokens.json      Theme-invariant semantic roles: type.role.*, radius.role.*,
                               motion.role.*, focus.ring.*.
    themes/{light,dark,hc}.tokens.json
                               Theme-varying semantic roles: color.bg/fg/border/accent/*,
                               color.{success,warning,danger,info}.*, color.focus, shadow.role.*.
    reserved/{dataviz,density}.tokens.json
                               Empty namespaces PAP-665 (dataviz palettes) and PAP-669 (density
                               modes) land their tokens in; already wired into the build.
  schema/dtcg-token-file.schema.json
                               JSON Schema every token file validates against (tokens:lint).
  scripts/
    generate-ramps.ts         Design-time tool: prints a fresh OKLCH ramp (culori) for hand-review
                               and paste-back into core.tokens.json. Not run by `build`.
    build.ts                  Compiles the DTCG sources into src/generated/*.
    lint-tokens.ts            tokens:lint.
    check-contrast.ts         tokens:check.
  src/
    lib/                      The resolver: dtcg.ts (parse/merge/resolve/flatten), transform.ts
                               (px->rem, fluid-size->clamp(), cubic-bezier formatting),
                               generate-css.ts, generate-ts.ts, srgb-fallback.ts, theme.ts.
    generated/                tokens.css, theme.css, tokens.ts, raw-tokens.json -- committed,
                               never hand-edited (header says so; `build --check` fails on drift).
    index.ts                  Re-exports tokens.ts.
  swatch/index.html           Static evidence page: every category, all three themes, live
                               contrast table. Not part of the package's exports.
```

## Naming grammar

* CSS custom properties: `--pos-<path>`, path segments kebab-case, joined by `-`
  (`--pos-color-bg-surface`, `--pos-type-role-body-strong-font-size`).
* DTCG JSON keys are lower-kebab-case or a bare number (`"50"`, `"2xl"`); `tokens:lint` enforces
  this against `schema/dtcg-token-file.schema.json`.
* `$type` strings are also kebab-case (`color`, `dimension`, `duration`, `cubic-bezier`,
  `font-family`, `font-weight`, `number`, `shadow`, `fluid-size` — the last one is a PaperOS
  extension, not upstream DTCG).
* A per-tenant theme (PAP-75) overrides these exact variable names — it never introduces new ones
  — so any component built against `--pos-color-accent-default` today is tenant-theme-ready with
  no change.

## Themes

`data-theme="light" | "dark" | "hc"` on `<html>`. An explicit attribute always wins; with none set,
`@media (prefers-color-scheme: dark)` decides between light and dark. `hc` (high contrast) is never
chosen automatically — it is a user setting, matching the forced-colors convention that high
contrast is opt-in, not system-inferred.

```html
<html data-theme="dark">
```

```css
@import url("@paperos/tokens/tokens.css");
```

Colour and shadow roles differ per theme; everything else (type scale, space, radius, motion,
z-index, breakpoints, sizing) is identical in all three and lives once in `:root`.

## Fluid type (360px phone to 3840px TV)

Every font-size token (`font.size.*`, `type.role.*.font-size`) is `$type: "fluid-size"`:
`{"min": "16px", "max": "22px"}`. The build expands it to a `clamp()` that scales linearly with
viewport width between 360px and 3840px (the brief's fallback matrix — see "Known gap" below), then
multiplies the whole thing by `var(--pos-font-scale, 1)`:

```css
--pos-type-role-body-font-size: calc(clamp(1rem, calc(0.9612rem + 0.1724vw), 1.375rem) * var(--pos-font-scale, 1));
```

`--pos-font-scale` has no token of its own — it is a bare CSS custom property convention with a
default of `1`, reserved for PAP-647 (an accessibility text-size preference) to set once, globally,
without touching a single token file.

## sRGB fallback

Every colour is authored in OKLCH. `tokens.css` also emits an
`@supports not (color: oklch(0% 0 0))` block mirroring every colour and shadow declaration in
`rgb()`, generated from the same OKLCH value with `culori`, for the DoD's WebKitGTK/Tauri-Linux
compatibility requirement and any other browser without OKLCH support.

## Validation

| Command | Checks |
| -- | -- |
| `pnpm --filter @paperos/tokens tokens:lint` | JSON Schema (kebab names), every alias resolves, no cycles, every alias-only primitive (font family/size/weight/line-height, motion duration/ease) is referenced by the semantic layer at least once |
| `pnpm --filter @paperos/tokens tokens:check` | WCAG contrast: `fg.default` ≥ 4.5:1 and `fg.muted` ≥ 3:1 on every `bg.*`; status `fg` on its own `bg` ≥ 4.5:1; `fg.on-accent` on `accent.default` ≥ 4.5:1 — in light, dark and hc |
| `pnpm --filter @paperos/tokens build:check` | Drift: regenerates `src/generated/*` in memory and diffs against the committed files; fails if a `.tokens.json` change was not followed by a fresh `build` |
| `pnpm --filter @paperos/tokens test` | Alias resolution and cycle-detection unit tests, transform unit tests (px-to-rem rounding, fluid-size clamp math), `tokens.css`/`tokens.ts` snapshot tests, the `rawTokens` contract (every `TokenPath` has a value in every theme), no hard-coded colour literal outside a `.tokens.json` file |

## Evidence

`docs/evidence/PAP-66/`: `swatch-{1280,3840}-{light,dark,hc}.png` (Chromium via Playwright,
`swatch/index.html` served over HTTP) and `contrast-report.json` (the exact numbers
`tokens:check --report` computed, which the swatch page's contrast table reads instead of
recomputing — so the page can never disagree with the gate that decides pass/fail).

## Known gap: breakpoints are provisional

PAP-14 (device matrix, ADR 0022) had not landed when this was written. `breakpoint.*` and the
360-3840 fluid-type range use the build brief's fallback matrix (360, 390, 768, 1280, 1920, 2560,
3840), not a landed research doc. When PAP-14 lands, update `tokens/core.tokens.json`'s
`breakpoint` group and `DEFAULT_FLUID_RANGE` in `src/lib/generate-css.ts`, then re-run
`pnpm --filter @paperos/tokens build`.

## Consuming the tokens

```ts
import { tokens } from '@paperos/tokens';

tokens.color.bg.surface; // "var(--pos-color-bg-surface)"
```

```css
.card {
  background: var(--pos-color-bg-surface);
  border-radius: var(--pos-radius-role-card);
  box-shadow: var(--pos-shadow-role-2);
}
```

Tailwind v4 (once an app installs it): `@import "@paperos/tokens/theme.css";` before Tailwind's own
`@import "tailwindcss";` — the `@theme` block there disables Tailwind's default palette
(`--color-*: initial`) and maps its namespaces onto these same variables, so `bg-canvas` and
`var(--pos-color-bg-canvas)` are always the same value.
