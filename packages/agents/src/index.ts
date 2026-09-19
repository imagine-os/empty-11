/**
 * `@paperos/agents` — character schema, handoff artefacts and agent runtime ports (agents / Atlas, PAP-103, PAP-108).
 *
 * The character schema lives in `./schema` (also exported as `@paperos/agents/schema`).
 */
export const AGENTS_PACKAGE_ID = '@paperos/agents' as const;
export * from './schema/index.ts';
