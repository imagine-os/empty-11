/**
 * `@paperos/core/audience` — the audience model (PAP-55, ADR 0017).
 *
 * The single vocabulary every page spec, policy, view and campaign uses to say *who*:
 * `Principal` (the canonical actor), tenant roles and permission strings, the segment
 * expression language, named audiences (built-in and app-declared), the surface map,
 * and `matches` / `describe` / `validateAudiences`.
 *
 * Owner: identity. Consumers: PAP-59 policies, PAP-116/117 spec validation, PAP-63
 * `AudienceFilter`, PAP-64 fixtures, PAP-240 test users, PAP-195 segments, PAP-103 agents.
 */

/** Bump only through an ADR that supersedes 0017. */
export const AUDIENCE_MODEL_VERSION = 1 as const;

export * from './app-spec.js';
export * from './audience.js';
export * from './builtin.js';
export type { DescribeOptions } from './describe.js';
export { describe } from './describe.js';
export * from './errors.js';
export * from './explain.js';
export type { AudienceResolver, MatchOptions } from './matches.js';
export { matches } from './matches.js';
export * from './principal.js';
export * from './registry.js';
export * from './role.js';
export * from './segment.js';
export * from './surfaces.js';
