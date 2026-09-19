# PAP-212 — UI kits and headless libraries: bundle and type measurement

**Question.** What do Select, Dialog, Menu and a Combobox actually cost, in gzipped
bytes and in type soundness, in each of the five candidates for `packages/ui`?

**Answer (2026-09-19).** Radix is the smallest (43.1 KB gzipped for all four),
React Aria the largest (79.7 KB); every candidate lands in the same rubric band
(40–100 KB → `bundle: 2`), so bundle size does not decide this. Type soundness does
split them: under the repo's own compiler settings with `skipLibCheck: false`,
`@base-ui/react` and `radix-ui` produce **zero** declaration errors while
`react-aria-components` and `@ark-ui/react` produce **two each**. Full write-up:
[`docs/research/ui-kits-and-headless-libraries.md`](../../docs/research/ui-kits-and-headless-libraries.md),
decision: [ADR 0029](../../docs/adr/0029-ui-primitives-library.md).

## What is here

* `src/<candidate>/{select,dialog,menu,combobox,all}.tsx` — the same four components
  written five times against each candidate's real API. `all.tsx` is the entry that
  matters: the candidates share internals (positioning, focus, portal) across
  components, so four separate bundles overstate the cost of shipping all four.
* `scripts/measure.mjs` — esbuild bundle (ESM, minified, `NODE_ENV=production`),
  gzip, esbuild metafile. `react`, `react-dom` and the JSX runtime are **external**:
  every candidate shares them, so the numbers are the library's own cost.
* `results/summary.json` — per-component and all-four gzip bytes (committed).
* `results/top-modules.json` — the ten heaviest input modules per candidate (committed).
* `results/*-metafile.json` — full esbuild metafiles (gitignored; `pnpm measure` regenerates).

## Running it

```sh
cd spikes/PAP-212-ui-kits
pnpm install --ignore-workspace   # standalone: never joins the workspace graph
pnpm measure                      # writes results/
npx tsc -p tsconfig.json          # the type check the research doc cites
```

`tsconfig.json` mirrors `@paperos/config-ts/base` (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`) with one deliberate difference: `skipLibCheck: false`,
so the candidates' own `.d.ts` files are checked rather than skipped. The repo ships
`skipLibCheck: true`, which means the four errors this finds do **not** break our
build — they are a signal about the declarations, not a blocker. With
`skipLibCheck: true` all five candidates compile clean.

## What was thrown away

Nothing is imported from here by `apps/*` or `packages/*`; this folder is excluded
from the workspace globs and from `pnpm check`. The Playwright/axe harness and the
five-candidate Vite route app the spec sketched were **not** built: PAP-753's shared
spike kit has not landed, and the decision turned on facts (licence, maintainer
continuity, component inventory, type soundness, agent docs) that a screenshot
matrix would not have moved. The keyboard, axe and seven-width evidence belongs to
PAP-67's real components, where it is a gate rather than a throwaway. See the ADR's
"Consequences — Negative" for the explicit debt this leaves.
