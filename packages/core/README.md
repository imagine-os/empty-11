# @paperos/core

Contract-zero primitives. Pure TypeScript: **no database, no network, no env reads**, and no React
outside the one documented exception below (`shell/`). Every other package (including every
`@paperos/contract-*`) may import this one.

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
| `devices/` | app-shell | breakpoint / device-class matrix (ADR 0022, PAP-14) |
| `shell/` | app-shell | `AppShell`, slot registry, layout hooks (PAP-16) — **the one documented exception to "no React"**: it ships React components and hooks because the Interface & Data Contracts (PAP-16) name `@paperos/core/shell` as their import path. It is exported from its own `package.json` subpath (`"./shell"`), not from the root barrel, so importing plain `@paperos/core` never pulls in React. `react` is a peer dependency; nothing outside `shell/` may import React. PAP-447 lifts this into `@paperos/contract-app-shell` and this note goes with it. |

`events/` and `shell/` exist so far (PAP-555, PAP-16); the rest land with their issues.

## Subpath exports

| Specifier | What |
| -- | -- |
| `@paperos/core` | the barrel: `PAPEROS_VERSION` and everything re-exported from the sub-folders |
| `@paperos/core/events` | domain events: envelope, `defineTopic`, `publish`, `on`, catalogue |
| `@paperos/core/events/testing` | `collectEvents`, `expectEvent`, the in-memory outbox driver |
| `@paperos/core/shell` | the app-shell runtime: `AppShell`, slot registry, layout hooks (PAP-16) |
| `@paperos/core/shell/shell.css` | the shell's stylesheet (import once, e.g. from `main.tsx`) |

`events/` keeps the package's purity rule: it depends on Zod and nothing else. `publish()` writes
through an `OutboxDriver` port that `@paperos/db` registers at boot, so no database type crosses
this boundary. `shell/` is the one folder that breaks the rule on purpose (see the table above) —
everything else stays free of React and the DOM.
