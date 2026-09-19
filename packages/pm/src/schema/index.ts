/**
 * PM Drizzle schema barrel (PAP-100).
 *
 * Empty until PAP-100 lands `project.ts`, `issue.ts`, `cycle.ts`,
 * `milestone.ts`, `comment.ts` and `relation.ts` here. Tables carry a UUIDv7
 * `id` and `updated_at` like every PaperOS table, and are registered with
 * `@paperos/db` through the schema generator rather than by importing another
 * module's tables.
 */

/** Table names this module owns, so `@paperos/db` can check for collisions. */
export const PM_TABLE_PREFIX = 'pm_' as const;
