# 0014. Module manifest

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-433](https://linear.app/paperos/issue/PAP-433)
* Deciders: Atlas (contract), Forge and Sentinel (review)

## Context

Justin's question behind the whole Module System is: if we rewrite the shell later, how does
everything else reconnect without a rewrite of its own? The answer only works if every module
declares, in data, what it gives and what it takes. `docs/module-system.md` section 1.2 writes that
declaration in prose. PAP-264 defines a narrower `ModuleManifest` (identity, routes, navItems,
entities, permissions, jobs, `settingsSchema`, integrations, `dependsOn`) for the app shell's
registry, and lands after this issue.

Seventeen `Publish @paperos/contract-<module>` issues, the registry and DI container (PAP-434), the
UI slot runtime (PAP-438), the dependency lint (PAP-439), the compatibility matrix and the swap CLI
all read this one shape. If it is not fixed first, seventeen sessions invent seventeen variants of
it and the swap claim stops being testable.

Four constraints shaped the design:

1. The validator has to run in a Vite config, on the server and in CI, so it must be pure and
   synchronous — PAP-264 requires the same of `loadModules`.
2. CI, the compatibility matrix and the swap CLI gate on the *reason* a manifest failed, so the
   failures need stable identifiers, not prose.
3. Manifests are written by agents as often as by people, and a silently ignored typo in a manifest
   is a swap that fails in production rather than in CI.
4. Round 4 added four fields (`secrets`, `lifecycle`, `resilience`, `issues`) owned by issues that
   land later. They must be legal now, so PAP-444, PAP-546 and PAP-548 do not each need a schema
   migration.

## Decision

**One Zod 4 schema in `packages/core/src/modules/manifest.ts`**, exported from `@paperos/core` and
from the subpath `@paperos/core/modules`. It is contract-zero: every package, including every
`@paperos/contract-*`, may import it.

* **The manifest extends PAP-264, it does not replace it.** The base fields stay and stay optional;
  the swap fields (`provides`, `requires`, `capabilities`, `slots`, `events`, `owner`, `kind`,
  `swapRisk`) are added. Only `id`, `kind`, `version`, `owner`, `provides`, `requires` and
  `swapRisk` are required, so a `process` module with no routes, entities or slots is valid.
* **`additionalProperties: false`.** An unknown field fails. It is the only way a typo in a
  hand-written manifest surfaces at all, and it is why the round-4 fields are reserved now rather
  than left to be added later.
* **`dependsOn` is derived, never authored.** It stays for PAP-264 compatibility; a manifest that
  lists both a `dependsOn` and a `requires` that disagree fails with `DEPENDS_ON_DISAGREES`.
* **Ranges are npm semver ranges**, evaluated with the `semver` package, with npm's pre-1.0
  meaning: `^0.1.0` accepts 0.1.x and rejects 0.2.0, so a minor bump is breaking for the whole
  0.x build.
* **`optional: true` is a real boot property, not a hint.** An unresolved optional requirement is a
  warning, and an optional edge is not an edge for cycle detection.
* **Ten stable diagnostic codes**, listed in `docs/platform/manifest.md`. `validateManifest` returns
  every diagnostic it finds; it never throws and never exits.
* **The validator takes the workspace as data.** `validateManifest(manifest, { others, contracts })`
  reads nothing. The CLI does the walking and passes what it found, which is what keeps the
  validator usable in a Vite config and in the browser.
* **The JSON Schema is generated, committed and drift-checked**, `$id`
  `https://paperos.dev/schema/module-manifest/1`, produced by `z.toJSONSchema` in
  `pnpm --filter @paperos/core gen:schemas`. A test regenerates it and compares bytes, compiles it
  with ajv and validates all eighteen goldens against both it and Zod.
* **Eighteen golden manifests are real `module.manifest.json` files** under
  `packages/core/src/modules/fixtures/modules/`, one per module of table 1.1 plus the kernel, and
  one deliberately broken fixture per diagnostic code under `fixtures/invalid/`.

## Consequences

* Every contract issue has a worked example to copy and a validator that blocks the merge, so the
  seventeen manifests are consistent by construction rather than by review.
* `manifest.ts` is held at 100% coverage. Every branch of it is a rule somebody's manifest will hit,
  and the file is small enough that the cost is one test each.
* Table 1.1's dependency graph is cyclic as written (`identity` ↔ `data-layer`,
  `app-shell` ↔ `spec-builder`, `forge` ↔ `quality`). The goldens mark one edge of each pair
  `optional: true`, which is what the kernel does at boot anyway. `docs/platform/manifest.md`
  records which three and why.
* Table 1.1 lists `@paperos/kernel` as what `module-system` provides. `provides[]` holds contracts,
  so the kernel's golden provides `@paperos/contract-module-system`; `@paperos/kernel` is its
  implementation package.
* `@paperos/core` now depends on `zod` and `semver` at runtime. Both are pure, both were already
  implied by "Zod 4 schemas" in the contracts document; `semver` is 6 KB and has no dependencies.
* PAP-264 must adopt this schema rather than define its own. A comment on PAP-264 says so.
* Adding a diagnostic code is additive; renaming one is breaking and needs a new ADR, because CI
  and the swap CLI match on the code.

## Alternatives rejected

* **JSON Schema as the source of truth, types generated from it.** It is the format the ecosystem
  reads, but it cannot express "this string is a semver range", and TypeScript types generated from
  JSON Schema lose the literal inference `defineModule()` needs for the kernel's typed tokens.
  Generating JSON Schema *from* Zod keeps both, at the cost of one generated file.
* **A throwing validator.** Simple, but a developer fixing a manifest with four problems would see
  them one at a time, and a pure function that returns diagnostics is what the compatibility matrix
  and the swap CLI need anyway.
* **Computing `swapRisk` from the dependency graph.** Attractive and wrong: the risk of swapping the
  shell is about what the swap touches in production, not about how many modules import it. It stays
  declared, and the owner is accountable for it.
* **Putting the manifest in `packages/kernel`.** The kernel is a module like any other; the manifest
  is contract-zero because contract packages and Vite configs both read it, and neither may depend
  on the kernel.
* **Deriving `provides` and `requires` from the import graph.** Explicitly out of scope: the
  manifest is the declaration the lint checks the imports *against* (PAP-439). Generating it from
  the imports would make the lint tautological.
