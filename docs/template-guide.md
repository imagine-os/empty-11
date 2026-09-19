# Template guide

How to work in `paperos-template`. PAP-24 owns this guide and writes the rest of it (setup, the
ten-minute golden path, the agent workflow). This pass (PAP-305) adds the one section the
boundary map needs: **where code goes**.

## Where code goes

Find the row, put the file there, and `pnpm lint:deps` stays green. Every destination has an
owner in [`ownership.json`](../ownership.json); if the row says "the owner's package" and that is
not your project, open a Spec issue on their project instead of writing the file.

| You are adding | It goes in | Also do | Rule |
| -- | -- | -- | -- |
| **A new entity** (a table plus its shapes) | The owning module: `packages/<module>/src/schema/<entity>.ts`, registered with `@paperos/db` through the schema generator | Its public shape goes in `@paperos/contract-<module>`; UUIDv7 `id` and `updated_at` on every row | R2, R8 |
| **A new page** | `apps/web/src/routes/...` for a shell page; a module contributes its pages through `composeRoutes` in its manifest, never by importing another app | Declare the page's actions (id, intent phrase, permission) in the actions registry; add a page doc | R4 |
| **A new component** | `packages/ui` if any module may use it; `packages/<module>/src/components` if it is the module's own | A shared component gets a registered component id (PAP-74); React is allowed only where R6 says | R6 |
| **A new job** | `packages/jobs` for the runner; the job **definition** lives in the module that owns the work (`defineJob` in `packages/<module>`) | Jobs are idempotent on `event.id`; schedule and retries in the definition | R3 |
| **A new event** | Topic and payload schema in `@paperos/core/events` (envelope) plus the owning contract's `topics`; publish from the module | Subscribers never import the publisher — that is the whole point of the topic | R3, R7, R8 |
| **A new module** | `packages/<module>/` **and** an `ownership.json` entry (`owner`, `issues`, `kind: module`, `optional: true`, `allowedDeps`), then `pnpm gen:deps-rules` | A manifest (`module.ts`), a contract package under `packages/contracts/`, a conformance suite | R3, R8, R9 |
| **A shared primitive** (a value type, a filter shape) | `packages/core/src/<folder>` owned by the project in the sub-folder table, re-exported through that folder's `index.ts` | Adding a *new* sub-folder needs an app-shell review and an `ownership.json` entry | R1, R12 |
| **A port another module needs** | The provider's `@paperos/contract-<module>`: an interface, not an implementation | Bump the contract version on any shape change (ADR, PAP-130); consumers resolve it from the kernel | R7, R9, R10 |
| **A script or config** | `scripts/` (repo-wide) or the package's own `*.config.ts`; both are exempt from the boundary lint | A generator writes a header saying the file is generated and a `--check` mode for CI | R5 |
| **A spike** | `spikes/<slug>/` — never imported by anything | Throwaway by definition; the lint does not cruise it | — |

Two things that are never right:

* **Importing another module's implementation** (`packages/crm` from `packages/finance`), even
  `import type`. Ask its owner for a contract port, or publish an event.
* **Putting a module's tables in `packages/core`.** Core is contract zero: pure TypeScript, no
  React, no database, no env reads, and it imports no workspace package. PM entities live in
  `packages/pm`, not `packages/core/src/pm` (ADR 0026).

Full prose and the failure messages: [`docs/platform/package-boundaries.md`](platform/package-boundaries.md).
