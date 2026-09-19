# @paperos/core

Contract-zero primitives. Pure TypeScript: **no React, no database, no network, no env reads.**
Every other package (including every `@paperos/contract-*`) may import this one.

## Sub-folder ownership

`src/index.ts` is the barrel and is owned by **app-shell**. Other projects add a sub-folder and
export it through the barrel **only with an app-shell review** (Interface & Data Contracts §5).

| Sub-folder | Owner project | Lands with |
| -- | -- | -- |
| `types/` | data-layer | shared value types (ADR 0011) |
| `filter/` | data-layer | filter grammar (ADR 0012) |
| `events/` | data-layer | event envelope, topic registry and `publish()` (ADR 0013) — **landed**, PAP-555 |
| `audience/` | identity | audience model (ADR 0017) |
| `principal.ts` | identity | `Principal` |
| `modules/` | app-shell | module manifest + generated JSON Schema (ADR 0014) |
| `pwa/`, `windows/`, `native/`, `flags/` | app-shell | shell capabilities |
| `i18n/` | app-shell | message catalog (EN + ES) |

Only `events/` exists so far (PAP-555); the rest land with their issues.

## Subpath exports

| Specifier | What |
| -- | -- |
| `@paperos/core` | the barrel: `PAPEROS_VERSION` and everything re-exported from the sub-folders |
| `@paperos/core/events` | domain events: envelope, `defineTopic`, `publish`, `on`, catalogue |
| `@paperos/core/events/testing` | `collectEvents`, `expectEvent`, the in-memory outbox driver |

`events/` keeps the package's purity rule: it depends on Zod and nothing else. `publish()` writes
through an `OutboxDriver` port that `@paperos/db` registers at boot, so no database type crosses
this boundary.
