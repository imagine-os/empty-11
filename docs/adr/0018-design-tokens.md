# 0018. Design tokens

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-66](https://linear.app/paperos/issue/PAP-66)
* Deciders: Iris (Token Keeper, build), Sentinel (Visual Inspector, review)

## Context

Every PaperOS surface (the portal, the console, generated spec pages, email and PDF output) has to
read from one set of colour, typography, spacing, radius, shadow, motion, z-index, breakpoint and
sizing values, in three themes (`light`, `dark`, `hc`), or twenty agents building sixty components
in parallel will each invent slightly different blues and slightly different 8px-ish gaps. The
values also have to survive a per-tenant theme (PAP-75, later) overriding the *same variable
names*, a text-size preference (PAP-647) scaling the whole type ramp from one knob, and a screen
that runs from a 360px phone to a 3840px TV watched from ten feet away.

`packages/ui` already exists (PAP-13, wired but empty). Interface & Data Contracts §5 lists
`packages/ui`, `packages/tokens` under the design-system module, so tokens get their own package
rather than a subfolder of `packages/ui` — a components package with no tokens dependency would be
a circular risk once PAP-67 needs to import token types for its `meta.ts` prop schemas, and a
published `@paperos/tokens` (versioned independently from components, per the module-versioning
gap `r4/design-system/ui-package-versioning-and-deprecation`) is easier to consume from `apps/api`
for server-rendered email/PDF theming (PAP-235) than reaching into `@paperos/ui`'s internals would
be.

## Decision

| Concern | Choice |
| -- | -- |
| Source format | W3C DTCG JSON (`$type`/`$value`/`{alias}`) in `packages/tokens/tokens/`: `core.tokens.json` (primitives), `semantic.tokens.json` (theme-invariant roles: type, radius, motion, focus), `themes/{light,dark,hc}.tokens.json` (colour roles + shadow elevation, which do vary by theme), `reserved/{dataviz,density}.tokens.json` (empty namespaces PAP-665 and PAP-669 land in) |
| Colour space | OKLCH, generated per family (neutral, accent, success, warning, danger, info; 11 steps, 50-950) by `scripts/generate-ramps.ts` using `culori`'s `clampChroma` to fit sRGB, then hand-committed into `core.tokens.json` — ramp generation is a design-time tool a person re-runs when a hue changes, not a build-time step (see "Alternatives rejected") |
| Naming | Kebab-case only (`font-family`, not `fontFamily`; `on-accent`, not `onAccent`) so every path segment maps 1:1 onto a CSS custom property segment; enforced by `tokens:lint`'s JSON Schema (`schema/dtcg-token-file.schema.json`) |
| Build | A ~500-line hand-written resolver (`src/lib/dtcg.ts`, `transform.ts`, `generate-css.ts`, `generate-ts.ts`) run by `scripts/build.ts`, not the `style-dictionary` npm package — see "Alternatives rejected" |
| CSS output | `src/generated/tokens.css`: shared tokens once in `:root`; colour-role and shadow tokens (the ones that vary by theme) in `:root` (light default) + `@media (prefers-color-scheme: dark)` (guarded by `:root:not([data-theme])`) + `[data-theme="light\|dark\|hc"]`; every declaration prefixed `--pos-`; an `@supports not (color: oklch(0% 0 0))` block mirrors every colour/shadow declaration in sRGB for browsers without OKLCH |
| Tailwind | `src/generated/theme.css`: a Tailwind v4 `@theme` block (`--color-*: initial` first, then `--color-canvas: var(--pos-color-bg-canvas)` etc.) mapping tokens into Tailwind's namespaces. Inert today — no app in this repo has installed Tailwind v4 yet — and only a starting point for whoever wires it in (Forge); the exact namespace choices are not frozen by this ADR |
| Fluid type | Every `font.size.*` and `type.role.*.font-size` token is `$type: "fluid-size"`, `$value: {min, max}` in px; the build expands it to `clamp(minRem, calc(interceptRem + Nvw), maxRem)`, scaling between 360px and 3840px viewport width (PAP-14's device matrix had not landed when this was written — see "Consequences"), and multiplies the whole clamp by `var(--pos-font-scale, 1)` so PAP-647 can move the entire scale from one variable with no token change |
| TypeScript | `src/generated/tokens.ts` exports `tokens` (every path as a `var(--pos-*)` string, theme-agnostic), `rawTokens.{light,dark,hc}` (literal resolved values, for contexts that cannot read a CSS custom property) and the `TokenPath` union; `src/generated/raw-tokens.json` is the same `rawTokens` data as plain JSON for non-bundled consumers (the evidence swatch page) |
| Validation | `tokens:lint` (JSON Schema + alias resolvability + cycle detection + "every alias-only primitive — font family/size/weight/line-height, motion duration/ease — is referenced by the semantic layer at least once"); `tokens:check` (culori `wcagContrast` — `fg.default` ≥ 4.5:1 and `fg.muted` ≥ 3:1 on every `bg.*`, status `fg`/`bg` pairs ≥ 4.5:1, `fg.on-accent` on `accent.default` ≥ 4.5:1, in all three themes); `build --check` (drift: regenerates in memory and diffs against the committed `src/generated/*`, for CI) |
| Theme switching | `data-theme="light\|dark\|hc"` on `<html>`; explicit attribute always wins; with no attribute, `prefers-color-scheme` decides between light and dark (`hc` is never chosen automatically — it is a user setting, matching forced-colors conventions) |

## Consequences

* A component never writes a colour, a `px` gap, a `border-radius` or a `transition` literal — it
  reads a `--pos-*` variable (or, in a React/JS context, `tokens.*` from `@paperos/tokens`). PAP-67
  onward, and the design-lint gap (`r4/design-system/design-lint-rules`), can enforce this
  mechanically.
* The breakpoint tokens (`breakpoint.xs`…`breakpoint.3xl` = 360/390/768/1280/1920/2560/3840, and
  the fluid-size 360→3840 range) use the brief's fallback matrix, **not** a landed device-matrix
  research doc — PAP-14 (ADR 0022) had not merged when this was written. Whoever lands PAP-14
  should treat `tokens/core.tokens.json`'s `breakpoint` group and `src/lib/generate-css.ts`'s
  `DEFAULT_FLUID_RANGE` as the two places to reconcile against the real matrix, and re-run
  `pnpm --filter @paperos/tokens build`.
* `theme.css`'s Tailwind v4 mapping is unvalidated against a real Tailwind install (none exists in
  this repo yet). Forge should treat it as a draft to correct once an app actually consumes it,
  not as settled API.
* Colour ramp steps (`color.<family>.<step>`) are intentionally exempt from `tokens:lint`'s
  "no unused alias" rule — they are a public, directly-usable palette (badges, one-off borders),
  not an alias-only layer, unlike the font/motion primitives which must all be reachable through
  a semantic role.
* `packages/tokens` has no `@paperos/ui` dependency and `@paperos/ui` will depend on
  `@paperos/tokens` once PAP-67 starts — the dependency direction is enforced only by convention
  until the module dependency lint (PAP-439) exists.

## Alternatives rejected

* **Style Dictionary 4.x** (the tool the spec names) — its plugin API (custom transforms for
  `color/oklch-css`, `size/px-to-rem`, `css/tailwind-theme`, plus the `fluid-size` expansion this
  token set specifically needs) is a large surface for four transforms this token set actually
  uses; a ~500-line hand-written resolver is easier for the next person to read end to end and to
  change (e.g. when PAP-14 lands new breakpoints) than a Style Dictionary config plus four custom
  plugin files. If a second module needs the same DTCG-to-CSS pipeline, revisit — shared plugin
  code across two token sets is a better argument for adopting the library than one token set
  alone.
* **Generating colour ramps at build time from a hue/chroma recipe** — considered so `culori`'s
  ramp math ran on every `build`, not just when someone runs `pnpm ramps` by hand. Rejected because
  a design system's palette changes rarely and deliberately; baking ramp generation into the hot
  build path means every `pnpm check` depends on `culori`'s exact rounding being stable forever,
  and a hand-tuned single step (say, nudging `warning.500`'s chroma after a real-device check)
  would require reverse-engineering the recipe instead of just editing one line of committed JSON.
* **`theme.css` as the only stylesheet, no `tokens.css`** — rejected because no app in this
  template has Tailwind v4 installed yet; a plain `tokens.css` of `--pos-*` custom properties works
  today (imported by anything, including the evidence swatch page) and `theme.css` becomes useful
  the day an app adds Tailwind, without the tokens package needing to know which app.
* **CSS-in-JS token objects instead of CSS custom properties** — rejected per the org standard
  (no CSS-in-JS runtime) and because per-tenant theming (PAP-75) and the `data-theme` switch both
  need a value that changes without a re-render, which CSS custom properties do for free.
