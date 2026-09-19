# @paperos/core

Contract-zero primitives. Pure TypeScript: **no React, no database, no network, no env reads.**
Every other package (including every `@paperos/contract-*`) may import this one.

## Sub-folder ownership

`src/index.ts` is the barrel and is owned by **app-shell**. It is *curated*: it re-exports
`./<folder>/index.js` and nothing deeper (rule R12), so each sub-folder owner decides what leaves
their folder by editing their own `index.ts` and the barrel stays a one-line change. Other
projects add a sub-folder and export it through the barrel **only with an app-shell review**
(Interface & Data Contracts §5).

The table below is mirrored, and enforced, in [`ownership.json`](../../ownership.json): a
sub-folder with no entry there fails `pnpm lint:deps`
([`docs/platform/package-boundaries.md`](../../docs/platform/package-boundaries.md), ADR 0026).

| Sub-folder | Owner project | Lands with |
| -- | -- | -- |
| `types/` | data-layer | shared value types (ADR 0011) |
| `devices/` | app-shell | device and breakpoint matrix (PAP-14, ADR 0022) |
| `filter/` | data-layer | filter grammar (ADR 0012) |
| `events/` | data-layer | event envelope, topic registry and `publish()` (ADR 0013) — **landed**, PAP-555 |
| `audience/` | identity | audience model (ADR 0017) |
| `principal.ts` | identity | `Principal` |
| `modules/` | app-shell | module manifest + generated JSON Schema (ADR 0014) — **landed**, PAP-433 |
| `pwa/`, `windows/`, `native/`, `flags/` | app-shell | shell capabilities |
| `nav/` | app-shell | router and navigation primitives (PAP-16) |
| `i18n/` | app-shell | message catalog (EN + ES) |

Only `events/`, `devices/` and `modules/` exist so far; the rest land with their issues.

## Subpath exports

| Specifier | What |
| -- | -- |
| `@paperos/core` | the barrel: `PAPEROS_VERSION` and everything re-exported from the sub-folders |
| `@paperos/core/events` | domain events: envelope, `defineTopic`, `publish`, `on`, catalogue |
| `@paperos/core/events/testing` | `collectEvents`, `expectEvent`, the in-memory outbox driver |
| `@paperos/core/modules` | module manifest schema, `defineModule`, `validateManifest`, ownership |

`events/` keeps the package's purity rule: it depends on Zod and nothing else. `publish()` writes
through an `OutboxDriver` port that `@paperos/db` registers at boot, so no database type crosses
this boundary.

`modules/ownership.ts` (PAP-305) is the schema and validator of `ownership.json` itself: pure
TypeScript, no `node:*`, so any package can read the types. There is deliberately **no `pm/`
folder** — PM entities and their Drizzle schema live in
[`packages/pm`](../pm/README.md), because core holds no database (ADR 0026).

`modules/manifest.ts` (PAP-433, ADR 0014) is the module manifest: the Zod schema, `defineModule()`,
`validateManifest()`, the generated `manifest.schema.json` and the eighteen golden manifests under
`modules/fixtures/`. `pnpm --filter @paperos/core gen:schemas` regenerates the JSON Schema (never
hand-edit it; `packages/core/biome.json` excludes it from formatting so generating it cannot fail
the linter) and `pnpm --filter @paperos/core modules:validate` validates every
`module.manifest.json` in the workspace. Field reference:
[`docs/platform/manifest.md`](../../docs/platform/manifest.md).
