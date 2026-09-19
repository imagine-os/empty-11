/**
 * `@paperos/agents` — character schema, handoff artefacts and agent runtime ports (agents / Atlas, PAP-103, PAP-108).
 *
 * The character schema lives in `./schema` (also exported as `@paperos/agents/schema`); the roster
 * tooling (plan conversion, org tree, live roster loader, PAP-284) in `./roster`.
 */
export const AGENTS_PACKAGE_ID = '@paperos/agents' as const;
export * from './roster/index.ts';
export * from './schema/index.ts';
