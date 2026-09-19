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
| `events/` | data-layer | event envelope and topics |
| `audience/` | identity | audience model (ADR 0017) |
| `principal.ts` | identity | `Principal` |
| `modules/` | app-shell | module manifest + generated JSON Schema (ADR 0014) |
| `pwa/`, `windows/`, `native/`, `flags/` | app-shell | shell capabilities |
| `i18n/` | app-shell | message catalog (EN + ES) |

Nothing in this list exists yet; this scaffold ships the barrel and `PAPEROS_VERSION` only.
