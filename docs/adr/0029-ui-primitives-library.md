---
id: "0029"
title: "UI primitives library for packages/ui"
status: Accepted
date: 2026-09-19
deciders: ["Scout", "Iris", "Atlas"]
issue: PAP-212
supersedes: []
supersededBy: null
tags: ["library", "design-system", "ui"]
reviewDate: 2026-12-18
---

# 0029. UI primitives library for `packages/ui`

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-212](https://linear.app/paperos/issue/PAP-212)
* Deciders: Scout (evaluation), Iris (design system owner), Atlas (arbiter); Sentinel reviews
* Review date: 2026-12-18

## Context

`packages/ui` is empty and PAP-67 starts on 2026-09-22 with twenty components to build, three
children (PAP-236, PAP-237, PAP-238) working in parallel, and a standing fallback rule in Iris's
memory: *proceed with Base UI if PAP-212 has not decided by 2026-09-19*. This ADR decides before
that rule fires, so the fallback is a confirmed choice rather than a default nobody examined.

The forces:

* **Everything downstream is generated.** Page specs (PAP-114) reference components by `ui.*` id
  and codegen (PAP-120) emits them. Twenty Claude sessions write the pages. A primitive whose API a
  session gets wrong on the first try costs more than a primitive that is 30 KB larger.
* **Our own compiler settings are strict.** `@paperos/config-ts/base` sets `strict`,
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
* **Tokens are already decided.** ADR 0018 (PAP-66) ships DTCG tokens compiled to CSS variables,
  consumed through Tailwind v4. Iris's escalation rules make any CSS-in-JS runtime an Atlas
  decision, which rules out a styled kit arriving by the back door.
* **The input surface is wide and getting wider.** Keyboard, mouse, trackpad, touch and pen today;
  TV remote / gamepad d-pad and voice next (ADR 0019, PAP-150). 44 px targets, nothing hover-only
  or drag-only, 360 → 3840 px with 10-foot legibility at the top end (ADR 0022, PAP-14).
* **We ship in Tauri WebViews**: `webkit2gtk` on Linux, `WKWebView` on Apple platforms, with
  detached windows (PAP-24) where a portal can attach to the wrong document.
* **English and Spanish from the start**, with the data model multiplayer-ready.
* **The plan names a package that no longer exists.** PAP-212 and PAP-67 were written against
  `@base-ui-components/react` 1.x. Base UI released 1.0.0 on 2025-12-11 under the new name
  `@base-ui/react` and is at 1.8.0 (2026-09-04); the old name's last publish is a release candidate
  from 2025-12-04.

Full evidence, measurements and per-criterion arithmetic:
[`docs/research/ui-kits-and-headless-libraries.md`](../research/ui-kits-and-headless-libraries.md).
Rubric: [`docs/platform/library-rubric.md`](../platform/library-rubric.md) (ADR 0009). Licence
tiers are the rubric's **draft** tiers — `ops/licenses/policy.yaml` (PAP-211) is not on `main`, so
every scorecard records `licensePolicySource: draft` and is re-checked when it lands.

## Decision

We adopt **Base UI, `@base-ui/react`, pinned at `1.8.0`**, as the headless primitive foundation for
`packages/ui`, with **`react-aria-components` `1.21.1` adopted scoped to date and time**.

Specifically:

* **The package name is `@base-ui/react`.** Not `@base-ui-components/react`, which is the name in
  PAP-212's and PAP-67's descriptions and in this model's training data, and which resolves to a
  nine-month-old release candidate. PAP-67's description is updated to match; a session that reads
  the old name anywhere should treat this ADR as the correction.
* **Imports are confined to `packages/ui`.** No app, page or other package imports a primitive
  library directly. `@paperos/ui` exports our own components with our own props, tokens and
  `meta.ts`, so a future swap touches one package (PAP-67's "the public API is ours" rule).
* **`react-aria-components` may be imported only by the date and time components**
  (`calendar`, `date-picker`, `date-range-picker`, `date-field`, `time-field`), because Base UI has
  no calendar at all and React Aria's date stack brings `@internationalized/date` with locale-aware
  parsing and 13 calendar systems. Enforced by the PAP-668 design lint. Everything else is Base UI.
* **Banned by this decision**: `cmdk` (Base UI ships Autocomplete and Combobox), `sonner` (Toast),
  `vaul` (Drawer), and any styled kit or CSS-in-JS runtime. Adding one needs a scorecard and an ADR
  that supersedes this one.
* **shadcn/ui is a reading source, not a dependency.** Its recipes are worth copying as *patterns*;
  its code is Radix-based and assumes its own theming conventions. We do not run its CLI into
  `packages/ui`.
* **The contract package** that carries component shapes across the module boundary is
  `@paperos/contract-design-system` (PAP-459). Primitive libraries never appear in a contract
  package's types.
* **Gaps and fallbacks** are tracked in
  [`docs/libraries/primitives-gaps.md`](../libraries/primitives-gaps.md).

## Consequences

**Positive.** The largest inventory match to PAP-67's twenty, including a **virtualized Combobox
built in** — PAP-238's 5,000-option requirement is a prop, not a TanStack Virtual integration — plus
Autocomplete, NumberField, OTP Field, Drawer, Menubar, NavigationMenu and Toast that Radix would
have had us build or source. Zero declaration errors at our compiler settings with `skipLibCheck`
off, and zero CSS shipped, so PAP-66's tokens stay the single source of truth. The library is built
by the people who built Radix and Floating UI, on a monthly cadence, with `llms.txt` and a markdown
twin of every docs page for the sessions that will write against it.

**Negative.** Four things we now owe:

1. **Two primitive libraries.** React Aria for dates is a second dependency with a second mental
   model (render props rather than `data-*` attributes) and the heaviest bundle in the comparison.
   It is scoped and lint-enforced, but it is not free.
2. **A rename trap that outlives this ADR.** Every model in the fleet believes the package is
   `@base-ui-components/react`. Expect wrong imports; the fix is this ADR, the registry entry and a
   pinned line in Iris's memory file.
3. **An untested WebView gate.** The `webviewIncompatible` gate passes on static analysis — no
   candidate uses CSS anchor positioning, the native Popover API, `showModal` or view transitions,
   and Base UI feature-detects `checkVisibility()` — but nothing was executed inside `webkit2gtk`,
   and the PAP-24 detached-window portal question is open. PAP-237 runs the real check when it
   builds the overlay components; if a portal attaches to the wrong document and no container prop
   fixes it, that is a re-open condition, not a bug report.
4. **Bundle weight.** 78.5 KB gzipped for four components against Radix's 43.1 KB. We are paying
   roughly 35 KB for components Radix does not have. If the twenty-component package exceeds
   250 KB gzipped, that is a re-open condition.

**Neutral.** All five candidates are MIT or Apache-2.0, all tree-shake, all support RTL, all ship
hand-written types, and none ships CSS we must neutralise. The accessibility, keyboard and 44 px
work stays ours in every branch of this decision: a headless library gives us correct roles and
focus order, not a visible focus ring or a touch target.

## Alternatives rejected

**Radix Primitives `radix-ui` 1.6.7 (80).** The blueprint's other named option and still excellent:
smallest bundle, zero declaration errors, the most familiar API in the fleet. It loses on two facts.
It has **no combobox** — the answer is Popover plus `cmdk` plus a virtualizer, three dependencies to
replace one prop — and its authors, Colm Tuite and Jenna Smith, now build Base UI. With 204 open
issues, 151 open pull requests, no GitHub releases and no published roadmap, adopting it in
September 2026 is adopting the predecessor. *The fact that would change the answer:* a published
Radix roadmap with a combobox on it, or Base UI going two quarters without a release.

**React Aria Components 1.21.1 (84).** The accessibility and input leader, and the only candidate
scoring 4 on `inputBreadth`: a documented pointer abstraction (drag-off-to-cancel, long press,
multi-touch, scroll locking) that reads like PAP-150's event model already implemented, plus 30+
locales and 13 calendar systems. It loses the foundation slot on ergonomics, not on quality — two
parallel APIs (hooks and components), render-prop styling that is wordier against Tailwind v4, two
declaration errors at `exactOptionalPropertyTypes`, an export map publint flags, and a docs domain
that moved mid-2026 (the old `react-aria/llms.txt` is a 404). It is adopted where it is strongest.
*The fact that would change the answer:* Base UI shipping a calendar, which would remove our second
dependency — or React Aria fixing its export map and collapsing to one API surface.

**shadcn/ui 4.21.0 (83).** The best agent surface in the field by a distance: `llms.txt`, an
official MCP server, official Claude Code Skills, a registry schema, and saturation in training
data — for a platform whose pages are written by twenty Claude sessions, that is worth real points,
and it scored them. It is still not a foundation: it distributes **Radix-based** source, so
choosing it is choosing Radix with extra steps, and its recipes carry theming conventions that
would fight PAP-66's tokens, the i18n rule and the actions registry in twenty places. We read it.
*The fact that would change the answer:* shadcn shipping a Base UI registry as its default.

**Ark UI 5.39.2 (81).** Strong, well-maintained, and the best doc plumbing for agents after shadcn
(per-page markdown at `/llms.txt/{slug}`, per-framework bundles). Its Zag.js state machines are a
genuinely good way to encode WAI-ARIA. It loses on three small things that add up: two declaration
errors at our settings, the thinnest in-weights coverage of the five (a session will fetch docs for
every non-trivial use), and a collection API that is more ceremony than Base UI's. Its
multi-framework reach — React, Vue, Svelte, Solid — is value PaperOS does not need.
*The fact that would change the answer:* PaperOS needing a non-React surface.

**Quick rejects** (one paragraph each in the research doc §7): **Headless UI** (inventory too thin,
five months between releases), **Mantine** (styled kit, ships CSS, owns its theme), **MUI Material**
(Material Design plus an Emotion CSS-in-JS runtime — and MUI's own answer to this problem is Base
UI), **Chakra UI v3** (Ark and Zag underneath, with a style layer we would have to neutralise),
**Ant Design** (an enterprise design language with 48 runtime dependencies and a visual identity
that is not ours).

### The rendered table

Hand-computed — `pnpm lib score` (PAP-218) does not exist yet — with the arithmetic shown in
research §6 so the tool can be diffed against it. Weights are the rubric's six rescaled to 80 by
three extras applied identically to all five candidates: the standard `packaging` (5) and two
domain extras, `inputBreadth` (10) and `themingFit` (5), whose anchors are written out below.

| Candidate | Version | Lic. | Maint. | Bundle | A11y | TS | Agent | Pack. | Input | Theme | Total | Gates | Migration (h) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **`@base-ui/react`** | 1.8.0 | 4 | 4 | 2 | 4 | 4 | 3 | 3 | 3 | 4 | **87** | pass | 26 | **adopt** |
| `react-aria-components` | 1.21.1 | 4 | 4 | 2 | 4 | 3 | 3 | 2 | 4 | 3 | **84** | pass | 28 | **adopt (date & time only)** |
| `shadcn` | 4.21.0 | 4 | 3 | 2 | 3 | 4 | 4 | 3 | 3 | 4 | 83 | pass | 28 | adopt-eligible, not chosen |
| `@ark-ui/react` | 5.39.2 | 4 | 4 | 2 | 3 | 3 | 3 | 3 | 3 | 4 | 81 | pass | 30 | adopt-eligible, not chosen |
| `radix-ui` | 1.6.7 | 4 | 3 | 2 | 3 | 4 | 3 | 3 | 3 | 4 | 80 | pass | 34 | adopt-eligible, not chosen |

Scorecards: `docs/libraries/scorecards/{base-ui-react@1.8.0,react-aria-components@1.21.1,shadcn@4.21.0,ark-ui-react@5.39.2,radix-ui@1.6.7}.yaml`.

All five clear the 75-point `adopt` threshold and no gate fails, so the thresholds do not decide
this: the top four sit inside rubric §7's 5-point tie band. Step 1 (lower `migrationCostHours`)
puts Base UI first at 26 h against 28 h, a margin inside the estimate's own noise, so step 2 —
the owning character's written judgement — carries it, recorded above and in research §6.7:
inventory fit (the only virtualized combobox), soundness at our compiler settings, and maintainer
continuity (Radix's authors are Base UI's authors). No score was re-cut to produce that ordering;
the scorecards record both the rubric `verdict` and a separate `decision` field, because writing
`reject` on an 80-point library would misstate the measurement.

**Anchors for the two domain extras** (applied identically to all five, rubric §3):

*`inputBreadth`, weight 10.* **4** — a documented pointer abstraction covering mouse, touch and pen
including long-press and drag-cancel; documented keyboard model with roving focus and typeahead;
locale-aware direction; upstream testing on touch devices and screen readers; nothing that blocks
arrow-key (d-pad) traversal. **3** — keyboard and touch solid, RTL supported, pen and long-press
undocumented. **2** — keyboard solid, touch works, no pen story, RTL only via a provider we wire.
**1** — keyboard only. **0** — a hover-only or drag-only path in a core component.

*`themingFit`, weight 5.* **4** — unstyled, ships no CSS, no styling runtime, component state
exposed as `data-*` attributes that Tailwind v4 variants and CSS variables target directly, with
documented Tailwind guidance. **3** — unstyled but with an optional stylesheet or a styling API
wordier than `data-*`. **2** — ships CSS we must neutralise, or owns a theme object. **1** —
requires its own styling runtime configuration. **0** — a CSS-in-JS runtime is mandatory.

## Re-open criteria

- **Date.** `reviewDate` 2026-12-18 passes while this ADR is `Accepted` (90 days, the rubric's
  ceiling for a decision this load-bearing).
- **Fact — maintainer continuity.** Base UI goes 120 days without a release, or the MUI/Radix/
  Floating UI team publicly stops work on it.
- **Fact — the gap closes.** Base UI ships a Calendar/DatePicker; we drop `react-aria-components`
  and this ADR is superseded by a one-library decision.
- **Fact — the WebView gate fails for real.** PAP-237's `webkit2gtk` run shows a Dialog or Menu
  portal attaching to the wrong document in a detached window (PAP-24) and no container prop fixes
  it. Then Base UI is re-scored with `webviewIncompatible: fail` and this ADR is reversed.
- **Budget.** `@paperos/ui` exceeds 250 KB gzipped for the twenty components, or Base UI's share
  alone exceeds 120 KB gzipped, measured by PAP-238's `size-limit` entry.
- **Advisory.** A critical advisory against `@base-ui/react` or `react-aria-components` with no
  patched version within 14 days.
- **Licence.** Either package changes tier under `ops/licenses/policy.yaml` once PAP-211 lands —
  which is also the trigger for re-checking every scorecard scored against draft tiers.

## References

- Linear issue: PAP-212; consumers PAP-67 (PAP-236, PAP-237, PAP-238), PAP-233, PAP-659, PAP-152, PAP-150
- Research: `docs/research/ui-kits-and-headless-libraries.md`
- Gaps and fallbacks: `docs/libraries/primitives-gaps.md`
- Spike and measurements: `spikes/PAP-212-ui-kits/`, `results/summary.json`, `results/top-modules.json`
- Rubric: `docs/platform/library-rubric.md`; machine-readable `packages/agents/src/rubric/library-rubric.json` (ADR 0009)
- Licence policy: `ops/licenses/policy.yaml` (PAP-211, not yet merged — draft tiers used)
- Tokens: ADR 0018 (PAP-66) · Input events: ADR 0019 (PAP-150) · Device matrix: ADR 0022 (PAP-14)
- Base UI 1.0.0 release and rename: <https://base-ui.com/react/overview/releases>, <https://base-ui.com/react/overview/about.md> (both 2026-09-19)
