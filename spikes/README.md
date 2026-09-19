# spikes/

Throwaway experiments. One folder per spike, named `<PAP-n>-<slug>/`, each with a `README.md`
stating the question, the answer and what was thrown away. Spikes are never imported by
`apps/*` or `packages/*`, are excluded from `pnpm check`, and are deleted once their finding
lands in `docs/research/` or an ADR.

## `_kit` — the shared spike harness (PAP-753)

[`_kit/`](_kit/) is not a spike; it is the harness that measures bundle size, wall
time/memory and (when Chromium is cached) in-browser FPS the same way for every
library-comparison spike, and emits a scorecard skeleton in
[`docs/platform/library-rubric.md`](../docs/platform/library-rubric.md) section 9's shape.
Full method, limits and the `null`-means-not-measured convention:
[`_kit/README.md`](_kit/README.md); the design write-up is
[`docs/platform/spike-harness.md`](../docs/platform/spike-harness.md).

Scaffold a new spike from the repo root:

```bash
node scripts/spike-new.mjs PAP-<n> <slug>
cd spikes/PAP-<n>-<slug>
pnpm install --ignore-workspace
pnpm bench   # or pnpm bench:browser
```

Spikes that already exist as one-off harnesses before PAP-753 landed
(`PAP-31-sync-eval`, `canvas-eval`, `crdt-bench`) are unaffected — PAP-753's Dependencies
note says they "build inline if the kit is unmerged, then migrate," and migrating them is
follow-up work, not part of this kit's own scope.
