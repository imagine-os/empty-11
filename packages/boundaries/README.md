# @paperos/boundaries

The tooling behind the package boundary map (PAP-305, [ADR 0026](../../docs/adr/0026-package-boundaries.md)).
`tooling` kind: nothing ships it, and nothing imports it except its own tests.

| Piece | What it does |
| -- | -- |
| `src/repo.ts` | Finds the repo root and loads `ownership.json` through `@paperos/core`'s validator. |
| `src/rules.ts` | Generates the dependency-cruiser rule set and the Biome `noRestrictedImports` mirror from the map. |
| `src/map.ts` | Walks the import graph and builds `dependency-map.json` plus its Mermaid rendering. |
| `src/check.ts` | Says which generated file is stale, and how to refresh it. |
| `src/glob.ts` | The one glob dialect the map uses (`**`, `*`, `?`), converted to regexes dependency-cruiser accepts. |
| `scripts/lint-deps.ts` | `pnpm lint:deps`. |
| `scripts/gen-deps-rules.ts` | `pnpm gen:deps-rules` (`--check`). |
| `scripts/gen-dep-map.ts` | `pnpm gen:dep-map` (`--check`). |

The *schema* of `ownership.json` lives in `@paperos/core/modules/ownership.ts`, not here: it is
pure TypeScript with no `node:*`, so any package can read the types. This package is the half that
touches the file system.

`test/fixtures/violation/` is a fake two-module tree used by the integration test; it is excluded
from the cruise (`exempt.notCruised`) so its deliberate violation never fails the real lint.

Prose: [`docs/platform/package-boundaries.md`](../../docs/platform/package-boundaries.md).
