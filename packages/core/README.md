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
| `types/` | data-layer | **landed** — shared value types, PAP-302 ([ADR 0011](../../docs/adr/0011-shared-value-types.md), [reference](../../docs/platform/types.md)) |
| `filter/` | data-layer | filter grammar (ADR 0012) |
| `events/` | data-layer | event envelope, topic registry and `publish()` (ADR 0013) — **landed**, PAP-555 |
| `audience/` | identity | audience model (ADR 0017) |
| `principal.ts` | identity | `Principal` |
| `modules/` | app-shell | module manifest + generated JSON Schema (ADR 0014) |
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

`events/` keeps the package's purity rule: it depends on Zod and nothing else. `publish()` writes
through an `OutboxDriver` port that `@paperos/db` registers at boot, so no database type crosses
this boundary.

`modules/ownership.ts` (PAP-305) is the schema and validator of `ownership.json` itself: pure
TypeScript, no `node:*`, so any package can read the types. There is deliberately **no `pm/`
folder** — PM entities and their Drizzle schema live in
[`packages/pm`](../pm/README.md), because core holds no database (ADR 0026).
`types/` has landed and is re-exported from the barrel and from the subpath `@paperos/core/types`.
The rest of the list is still to come.

## Environment

The one exception to "no env reads": `signCursor` / `verifyCursor` read `CURSOR_SECRET` and
`CURSOR_SECRET_PREVIOUS` **at the call site** when no `CursorSecrets` argument is passed, never at
import. Importing this package can never fail on a missing variable.
