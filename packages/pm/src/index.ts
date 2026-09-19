/**
 * `@paperos/pm` — the project-management module (PAP-100).
 *
 * Scaffold only: it ships the barrel and the schema barrel so PAP-100 has a
 * home. PM entities (project, issue, cycle, milestone, comment, relation) and
 * their Drizzle schema land in `src/schema/`, **not** in
 * `packages/core/src/pm`: `@paperos/core` is contract zero and holds no
 * database (ADR 0026, ownership.json `packages."packages/pm"`).
 *
 * Boundary: `pm` is an optional module. It imports `@paperos/core`,
 * `@paperos/db`, `@paperos/ui`, `@paperos/spec`, `@paperos/views`,
 * `@paperos/sync`, `@paperos/api-contract`, `@paperos/permissions`,
 * `@paperos/jobs`, `@paperos/files`, `@paperos/search`, `@paperos/email` and
 * any `@paperos/contract-*`. It never imports another module (`crm`,
 * `finance`, `import`): those couple through `@paperos/core/events`, a
 * contract port or the kernel (rule R3/R8, `pnpm lint:deps`).
 */

export * from './schema/index.js';

/** Contract version of the PM module's shapes. Bumped by pm-linear only. */
export const PM_MODULE_VERSION = '0.1.0' as const;
