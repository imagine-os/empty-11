/**
 * `@paperos/spec` — page spec schema, parser, validator and migration skeleton
 * (spec-builder / Quill, PAP-114, ADR 0015).
 *
 * Read `docs/platform/page-spec.md` for the field reference and the gate rules.
 */
export const SPEC_PACKAGE_ID = '@paperos/spec' as const;

export { renderPageSpecDoc } from './docs.js';
// Issues, results, parsing, validation
export {
  didYouMean,
  errorsOf,
  formatPath,
  hasErrors,
  SPEC_CODES,
  type SpecCodeInfo,
  SpecError,
  type SpecIssue,
  type SpecIssueCode,
  type SpecPosition,
  type SpecSeverity,
  severityOf,
} from './issues.js';
// Generated artefacts
export {
  buildPageJsonSchema,
  type JsonSchema,
  PAGE_SPEC_SCHEMA_ID,
  renderPageJsonSchema,
} from './json-schema.js';
// Migration skeleton
export * from './migrate/index.js';
export {
  normaliseSource,
  type ParseOptions,
  type ParseResult,
  parseSpec,
  SCHEMA_HEADER_RE,
  SPEC_SIZE_LIMIT_BYTES,
} from './parse.js';
// Consumers
export {
  type NotWiredEntry,
  notWiredComponents,
  type PageActionEntry,
  pageActions,
} from './registry.js';
export type { Err, Ok, Result } from './result.js';
export * from './schema/access.js';
export * from './schema/components.js';
export * from './schema/data.js';
export * from './schema/filter.js';
export * from './schema/integrations.js';
export * from './schema/logic.js';
export * from './schema/page.js';
// Schema and types
export * from './schema/refs.js';
export {
  candidateKeysAt,
  type ValidateOptions,
  type ValidationResult,
  validatePageSpec,
} from './validate.js';
