# Package boundaries

Who owns which directory in this monorepo, which imports are allowed, and what fails when you
cross a line. Prose for Interface & Data Contracts §5 and Module System §3; the machine-checked
version is [`ownership.json`](../../ownership.json) plus `pnpm lint:deps`.

*Owner: app-shell (PAP-305). Decision: [ADR 0026](../adr/0026-package-boundaries.md).*

## The one-minute version

```
ownership.json          the only source of truth: owners, kinds, allowedDeps, contracts
  ├─ pnpm gen:deps-rules  →  .dependency-cruiser.cjs        (generated, committed)
  │                       →  packages/config-biome/preset.json `overrides` (generated block)
  └─ pnpm gen:dep-map     →  docs/platform/dependency-map.json + .md (generated, committed)

pnpm lint:deps    validate the map → cruise apps/ and packages/ → fail on a stale generated file
pnpm check        runs it (turbo task `//#lint:deps`); Gate 1 runs the same command
```

Change a boundary in `ownership.json`, run both generators, commit all of it in one commit. The
lint blocks a half-done migration: the map and the code cannot disagree for longer than one commit.

## Ownership

`ownership.json` `packages` has one entry per `apps/*`, per `packages/*` (including
`packages/contracts/*`) and per `packages/core/src/<folder>`:

```json
"packages/pm": {
  "owner": "pm-linear",
  "issues": ["PAP-100", "PAP-305"],
  "kind": "module",
  "optional": true,
  "allowedDeps": ["packages/core", "packages/db", "..."]
}
```

* **`owner`** is a project key — one of the 23 in the `owners` list (the 17 plan projects, the five
  round-4 projects and the `module-system` kernel). It means: the project whose issues may create
  files there. Another project adds files only through the owner's registration API.
* **`issues`** are the Linear identifiers that build it; format-checked today, checked against
  `linear-workspace.json` when PAP-91 lands it.
* **`kind`** is `core`, `runtime`, `module`, `contract` or `tooling`.
* **`optional: true`** marks a module `paperos create --without <module>` (PAP-22) can drop, and
  mirrors the module manifest's `optional` flag (PAP-264).
* **`allowedDeps`** is the whole allowed graph: the workspace paths this directory may import,
  plus the wildcard `packages/contracts/*`. Everything else is a violation. A missing
  `allowedDeps` (the `packages/core/src/*` entries) means "inherits its parent's".

A package may be created **only by an issue whose project owns it**. A new `packages/foo` with no
entry fails the coverage test in `@paperos/boundaries` with the fix spelled out.

## The rules

| Rule | Statement | Where it comes from |
| -- | -- | -- |
| R1 | `packages/core/**` imports no workspace package at all — not even a contract. It is contract zero, so everyone may import it. | Contracts §5 |
| R2 | `packages/db` imports only `@paperos/core` among implementation packages. Other modules contribute `src/schema/<module>.ts` through the generator. | Contracts §5 |
| R3 | An optional module imports `core`, `db`, `ui`, `spec`, `views`, `sync`, `api-contract`, `permissions`, `jobs`, `files`, `search`, `email` and any contract — **never another module**. | Contracts §5 |
| R4 | `apps/*` import packages, never another app, and compose modules through the kernel (`composeRoutes`, UI slots). | Contracts §5 |
| R5 | Nobody imports a generated file or `drizzle/**/*.sql`. Import the generator's typed output. | Contracts §5 |
| R6 | React only in `tokens`, `ui`, `views`, `spec`, `collab` and `apps/*`. Everything else runs in a worker, in the API and in a test without a DOM. | Contracts §5 |
| R7 | Any package may import any `@paperos/contract-*` (core excepted, by R1). | Module System §3 |
| R8 | No package imports another module's implementation package, **type-only imports included**. | Module System §3 |
| R9 | `packages/contracts/**` imports only core and other contracts, and the graph is acyclic. | Module System §3 |
| R10 | `packages/kernel` imports core and contracts, never a module. It is the one place a cross-module dependency may exist. | Module System §3 |
| R11 | A module imports its own contract's `conformance/` only from test files. | Module System §3 |
| R12 | `packages/core/src/index.ts` is a curated barrel: it re-exports `./<folder>/index.js` and nothing deeper. | ADR 0026 |

### Where the two documents disagree

Contracts §5 predates the Module System. Where they differ, **R8 wins**:

* Contracts §5 allowed a type-only import across optional modules ("so shared DTOs do not force a
  package split"). R8 bans it, because a type-only import is still a compile-time coupling and it
  survives into every consumer's build graph. Put the shared DTO in the module's
  `@paperos/contract-*` package, which is exactly what contracts are for, and keep the
  `import type`. The lint runs with `tsPreCompilationDeps`, so it sees type-only edges.
* Contracts §5 listed the shared platform packages a module may import; those are `runtime`
  packages, not modules, so R3 and R8 do not conflict: R3 is the allow-list, R8 is the ban.

### Exemptions

| Exemption | Effect |
| -- | -- |
| `exempt.testFiles` (`**/*.test.ts`, `**/test/**`, …) | Test files may import another module's fixtures (R11 still bans importing `conformance/` from shipped code). They are also left out of the dependency map's import graph. |
| `exempt.notCruised` (`spikes/**`, `scripts/**`, `**/*.config.ts`, `packages/boundaries/test/fixtures/**`, build output) | Never cruised. Storybook and Playwright configs are `tooling` and cross packages freely. |
| `exempt.generated` | Each entry names the glob **and the issue that generates it**, so R5's message says who to ask. |
| `exempt.react` | The directories R6 lets import React. |

## Reading a failure

```
  error R3-cross-module-packages-pm: packages/views/src/index.ts → packages/pm/src/index.ts
    R3/R8 -> packages/pm: optional modules must couple via @paperos/core/events, a
    @paperos/contract-* port or the kernel, never by importing another module's
    implementation (type-only imports included). Owner: pm-linear — ask them for a
    contract port (ownership.json packages."packages/pm", issues PAP-100, PAP-305).
```

Rule id, the offending import, what to do instead, and the owner to talk to. Three ways out, in
order of preference:

1. **Ask for a port.** Open a Spec issue on the owner's project for the port you need in their
   `@paperos/contract-*`, resolve it from the kernel. Never a workaround import.
2. **Publish an event.** `@paperos/core/events` topics are the loose coupling; the subscriber does
   not import the publisher.
3. **Widen the boundary.** If the dependency is genuinely platform-wide, the owner of *both*
   directories agrees, `allowedDeps` changes, both generators re-run, all in one commit.

The Biome mirror (`style/noRestrictedImports`, generated into the shared preset) underlines the
same import in the editor before you ever run the lint. It sees package names only, so it is a
subset: dependency-cruiser is the gate.

## `packages/core` sub-folders

`packages/core` is one package with many owners, so the sub-folder table is part of the boundary
map. Anything in `packages/core/src/` without an entry fails the coverage test.

| Sub-folder | Owner | Lands with |
| -- | -- | -- |
| `audience/` | identity | PAP-55, ADR 0017 |
| `devices/` | app-shell | PAP-14, ADR 0022 |
| `events/` | data-layer | PAP-555, ADR 0013 |
| `filter/` | data-layer | PAP-279, ADR 0012 |
| `flags/` | app-shell | PAP-366 |
| `i18n/` | app-shell | PAP-27 |
| `modules/` | app-shell | PAP-264, PAP-305, PAP-433 |
| `native/` | app-shell | PAP-259 |
| `nav/` | app-shell | PAP-16 |
| `pwa/` | app-shell | PAP-18 |
| `types/` | data-layer | PAP-302, ADR 0011 |
| `windows/` | app-shell | PAP-21 |

The barrel `src/index.ts` is owned by app-shell and re-exports sub-folder indexes only (R12): each
owner decides what leaves their folder by editing their own `index.ts`, and the barrel stays a
one-line change that rarely conflicts between parallel sessions.

**`packages/core/src/pm` does not exist and will not.** PAP-100's PM entities and their Drizzle
schema live in [`packages/pm`](../../packages/pm/README.md): core is contract zero and holds no
database. See ADR 0026.

## Contracts

`ownership.json` `contracts` mirrors Module System §1.1: one entry per `@paperos/contract-*` with
its path, owner project, owner agent and swap risk. The owner alone may bump a contract version
(Module System §7); CODEOWNERS routes a contract change to the owner plus Atlas.

## `ownership.json` has two sections and two authors

PAP-46 plans a `paths` section **generated from `.github/CODEOWNERS`** for the orchestrator's
file-lock hints. The `packages` and `contracts` sections here are hand-maintained. A generator that
writes `paths` merges into the file; it never rewrites the other sections. The `sections` key in
the file says so, for whoever automates it.

## Commands

| Command | Does |
| -- | -- |
| `pnpm lint:deps` | The gate: validate the map, cruise `apps/` and `packages/`, fail on a stale generated file. |
| `pnpm gen:deps-rules` | Regenerate `.dependency-cruiser.cjs` and the Biome `overrides` block. `--check` to verify only. |
| `pnpm gen:dep-map` | Regenerate `docs/platform/dependency-map.json` and `.md`. `--check` to verify only. |
| `pnpm --filter @paperos/boundaries test` | Schema fixtures, rule snapshots, coverage, staleness and the fixture-violation integration test. |
