# @paperos/pm

The project-management module (pm-linear, PAP-100). **Optional**: `paperos create --without pm`
drops it, so nothing outside this package may import it.

* `src/schema/` — Drizzle tables for project, issue, cycle, milestone, comment and relation.
  They live here, not in `packages/core/src/pm`: core is contract zero and holds no database
  (ADR 0026).
* Boundary: imports `@paperos/core`, `@paperos/db`, `@paperos/ui`, `@paperos/spec`,
  `@paperos/views`, `@paperos/sync`, `@paperos/api-contract`, `@paperos/permissions`,
  `@paperos/jobs`, `@paperos/files`, `@paperos/search`, `@paperos/email` and any
  `@paperos/contract-*`. Never another module: couple through `@paperos/core/events`, a contract
  port or the kernel (`pnpm lint:deps`, rules R3 and R8).
* Owner and allowed imports: `ownership.json`. Prose: `docs/platform/package-boundaries.md`.
