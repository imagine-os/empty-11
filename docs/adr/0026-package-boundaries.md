---
id: "0026"
title: "Machine-checked package boundaries generated from ownership.json"
status: Accepted
date: 2026-09-19
deciders: ["Atlas", "Forge"]
issue: PAP-305
supersedes: []
supersededBy: null
tags: ["monorepo", "module-boundary", "lint", "tooling"]
reviewDate: null
---

# 0026. Machine-checked package boundaries generated from `ownership.json`

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-305](https://linear.app/paperos/issue/PAP-305)
* Deciders: Atlas (decision), Forge (build), Sentinel (review)

## Context

Twelve issues across six projects write into `packages/core` in the next two weeks, and sixteen
builder sessions run in parallel. Interface & Data Contracts §5 says in prose who owns which
package and which imports are allowed; Module System §3 adds rules R7-R11 and asks for
`pnpm gen:dep-map`. Prose does not stop a session from putting the PM schema in
`packages/core/src/pm` (PAP-100 currently says it does), from importing `@paperos/crm` inside
`packages/finance`, or from creating `packages/foo` that nobody owns. ADR 0001 deferred the
cycle and boundary rules to this issue after choosing Biome, whose rule set cannot express
path-to-path constraints.

Constraints: Biome stays the formatter and fast linter; the root files (`package.json`,
`turbo.json`, `biome.json`, `pnpm-workspace.yaml`) have one owner and parallel sessions collide on
them; Gate 1 (PAP-78) is not merged yet, so `pnpm check` is the gate today; PAP-46 plans a
generated `paths` section in the same `ownership.json`.

## Decision

We will keep **one source of truth**, `ownership.json` at the repo root, and generate everything
else from it.

* `ownership.json` `packages` has an entry per `apps/*`, per `packages/*` and per
  `packages/core/src/<folder>`: `owner` (a project key), `issues` (`PAP-<n>`), `kind`
  (`core | runtime | module | contract | tooling`), `optional`, and `allowedDeps` — the whole
  allowed graph, with the single wildcard `packages/contracts/*`. A `contracts` section mirrors
  Module System §1.1 (path, owner project, owner agent, `requires`, swap risk) so the owner who may
  bump a contract version is written down.
* Its schema is `@paperos/core/modules/ownership.ts`: types plus a dependency-free validator that
  reports every problem at once (unknown owner, unknown kind, unknown `allowedDeps` target, a
  cyclic allowed graph).
* `pnpm gen:deps-rules` writes `.dependency-cruiser.cjs` (rules R1-R12, one allow-list rule per
  source directory and one cross-module rule per module so the message can name the owner of the
  package being imported) and the `overrides` block of `packages/config-biome/preset.json`
  (`style/noRestrictedImports`, the same ban for editor feedback).
* `pnpm gen:dep-map` writes `docs/platform/dependency-map.json` and `.md` (Mermaid plus owner and
  allowed-graph tables) from the map and the real import graph; an import no `allowedDeps` entry
  covers is an *undeclared dependency* and fails.
* `pnpm lint:deps` validates the map, cruises `apps/` and `packages/`, then fails on any stale
  generated file. It is wired into `pnpm check` as the turbo root task `//#lint:deps`; Gate 1
  (PAP-78) runs the same command.
* **R8 wins over Contracts §5 on type-only imports**: a cross-module `import type` is banned too
  (`tsPreCompilationDeps`). Shared DTOs go in the provider's contract package.
* **PM lands in `packages/pm`**, not `packages/core/src/pm`. This ADR scaffolds the package with
  its schema barrel; PAP-100 fills it.
* Adding a package is only ever done by an issue whose project owns it, and the coverage test
  fails an unowned directory with the fix in the message.

## Consequences

**Positive.** The boundary is a command, not a habit: a violation names the rule, the import and
the owner to ask, in one line. Twelve issues can write into `packages/core` without collisions
because the barrel re-exports folder indexes (R12) and each folder has one owner. `paperos create
--without <module>` (PAP-22) has a machine-readable `optional` flag. The Blueprint's dependency
views, the orchestrator's promotion graph and the lint all read one graph.

**Negative.** Two generated files must be regenerated and committed whenever an import or an
ownership entry changes, and a session that forgets gets a stale-file failure. The rule set is
~1,500 generated lines nobody reads; the readable version is `ownership.json` and
`docs/platform/package-boundaries.md`. dependency-cruiser is a new devDependency (18.3.1) and adds
roughly two seconds to `pnpm check`. `ownership.json` now has two authors (this issue by hand,
PAP-46 by generator) and they must merge rather than overwrite.

**Neutral.** The Biome mirror is a subset (it matches package names, not paths), so
dependency-cruiser stays the gate and Biome is only the fast editor hint.

## Alternatives rejected

**ESLint with `import/no-restricted-paths` or `eslint-plugin-boundaries`.** Rejected in ADR 0001:
adding ESLint back alongside Biome doubles the lint toolchain for one rule family, and neither
plugin expresses "type-only edges count" or the acyclic-contract-graph check as directly.

**Hand-written `.dependency-cruiser.cjs`.** Rejected: the ownership table and the rules would drift
within a week of parallel sessions, and the violation message could not name the owner without a
lookup table that is itself a second source of truth.

**`ownership.json` as a Zod schema in `packages/core`.** The spec asked for Zod. Zod is not in the
`pnpm-workspace.yaml` catalog and that file has one owner (PAP-13), so the validator is
hand-written with the same `safeParse` shape. PAP-264 / PAP-433 swap the body for
`z.object(...)` when zod enters the catalog; the exported types and the `parseOwnership` signature
do not change.

**Per-package `dependencies` in each `package.json` as the boundary.** Rejected: workspace
`dependencies` do not stop a deep relative import (`../../crm/src/...`), do not distinguish
type-only edges, and say nothing about `packages/core` sub-folders, which is where most of the
collision risk actually is.

## Re-open criteria

- **Fact.** Biome ships a path-to-path import rule (`noRestrictedImports` with glob sources) that
  expresses R1-R12; then the dependency-cruiser dependency can go.
- **Fact.** The module manifests (PAP-433) land and become the better source for `requires` edges;
  `pnpm gen:dep-map` then reads manifests instead of inferring, and this ADR is amended, not
  replaced.
- **Budget.** `pnpm lint:deps` exceeds 30 s on the full repo.
- **Date.** None set: this is a convention, not a library adoption.

## References

- Linear issue: PAP-305
- Prose: [`docs/platform/package-boundaries.md`](../platform/package-boundaries.md)
- Where code goes: [`docs/template-guide.md`](../template-guide.md)
- Interface & Data Contracts §5; Module System §3 (R7-R11) and §7
- Supersedes nothing; extends [ADR 0001](0001-monorepo-stack.md) (the deferred cycle and boundary
  rules) and is consumed by PAP-24, PAP-28, PAP-100, PAP-264, PAP-439, PAP-22
- Tooling: [`packages/boundaries`](../../packages/boundaries/README.md), `dependency-cruiser` 18.3.1
