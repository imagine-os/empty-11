/**
 * `@paperos/core/filter`: the shared filter and condition grammar (PAP-279, ADR 0012).
 *
 * One Zod `FilterTree`, one SQL compiler (`toSql`, Drizzle `SQL` fragment, no database
 * at runtime), one in-memory evaluator (`evaluate`), proven equivalent by property tests
 * on PGlite. Permissions `Condition`, view `FilterGroup`, spec data queries, segments and
 * automations alias `FilterTree` instead of redefining it. See `docs/platform/filter.md`.
 */
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { EvaluateOptions, Row } from './evaluate.js';
import type { ExplainOptions } from './explain.js';
import { defaultGrammar } from './grammar.js';
import type { FieldSchema, FilterContext, FilterTree, Operator } from './schema.js';
import type { ColumnSource, ToSqlOptions } from './sql.js';
import type { ValidationResult } from './validate.js';

export { MIGRATIONS } from './encode.js';
export {
  FilterError,
  type FilterErrorCode,
  type FilterIssue,
  FilterValidationError,
  FilterVariableError,
} from './errors.js';
export type { EvaluateOptions, Row } from './evaluate.js';
export { and3, or3 } from './evaluate.js';
export type { ExplainOptions } from './explain.js';
export {
  type CreateFilterGrammarOptions,
  createFilterGrammar,
  defaultGrammar,
  type FilterGrammar,
} from './grammar.js';
export { normalize } from './normalize.js';
export {
  type Arity,
  BUILTIN_OPERATORS,
  type ExplainArgs,
  escapeLike,
  jsonAtPath,
  type Locale,
  OPERATORS_BY_TYPE,
  type OperatorDefinition,
} from './operators.js';
export {
  ARRAY_ITEM_TYPES,
  type ArrayItemType,
  and,
  buildFilterSchemas,
  type Condition,
  type ConditionValue,
  condition,
  conditionSchema,
  conditionValueSchema,
  defineFields,
  FIELD_TYPES,
  FILTER_VERSION,
  type FieldDef,
  type FieldSchema,
  type FieldType,
  type FilterContext,
  type FilterNode,
  type FilterSchemas,
  type FilterTree,
  fieldDefSchema,
  fieldSchemaSchema,
  filterNodeSchema,
  filterTreeSchema,
  GROUP_OPS,
  type Group,
  type GroupOp,
  groupSchema,
  isCondition,
  isGroup,
  isJsonPathMatch,
  isVarRef,
  type JsonPathMatch,
  jsonPathMatchSchema,
  MAX_CONDITIONS,
  MAX_DEPTH,
  MAX_JSON_PATH,
  MAX_LIST_VALUES,
  not,
  OPERATORS,
  type Operator,
  type OperatorsFor,
  or,
  type Scalar,
  type ScalarFor,
  scalarSchema,
  type TypedCondition,
  type ValueFor,
  type Variables,
  type VarRef,
  varRefSchema,
} from './schema.js';
export type { ColumnSource, ToSqlOptions } from './sql.js';
export type { ValidationResult } from './validate.js';
export { checkScalar, suggestFields } from './validate.js';
export { resolveVariable } from './variables.js';

/**
 * Validates `input` against the structural schema and a `FieldSchema`: known fields
 * (with suggestions), operator allowed on the field type, value shape per operator.
 */
export function validateFilter(input: unknown, fields: FieldSchema): ValidationResult<Operator> {
  return defaultGrammar.validate(input, fields);
}

/** `validateFilter` that throws `FilterValidationError`. */
export function parseFilter(input: unknown, fields: FieldSchema): FilterTree {
  return defaultGrammar.parse(input, fields);
}

/**
 * Compiles a tree to a Drizzle `SQL` fragment for a `WHERE` clause. `table` is a
 * Drizzle table, a table name or a field → column map; `ctx.fields` types the values
 * and `ctx.variables` resolves `{ $var }`. Pure: no connection is touched.
 */
export function toSql(
  tree: FilterTree,
  table: ColumnSource,
  ctx: FilterContext,
  options?: ToSqlOptions,
): SQL {
  return defaultGrammar.toSql(tree, table, ctx, options);
}

/** Evaluates a tree against one row in memory. UNKNOWN (SQL NULL) is `false`, as in a `WHERE` clause. */
export function evaluate(
  tree: FilterTree,
  row: Row,
  ctx: FilterContext,
  options?: EvaluateOptions,
): boolean {
  return defaultGrammar.evaluate(tree, row, ctx, options);
}

/** `evaluate` keeping SQL's three values: `true`, `false` or `null` for UNKNOWN. */
export function evaluateThreeValued(
  tree: FilterTree,
  row: Row,
  ctx: FilterContext,
  options?: EvaluateOptions,
): boolean | null {
  return defaultGrammar.evaluateThreeValued(tree, row, ctx, options);
}

/** One line of English (default) or Spanish describing the tree. */
export function explain(tree: FilterTree, options?: ExplainOptions): string {
  return defaultGrammar.explain(tree, options);
}

/** Compact URL-safe form for view links: `1.<base64url>`. */
export function encodeFilter(tree: FilterTree): string {
  return defaultGrammar.encodeFilter(tree);
}

/** Inverse of `encodeFilter`; validates structure, and fields when a `FieldSchema` is given. */
export function decodeFilter(encoded: string, fields?: FieldSchema): FilterTree {
  return defaultGrammar.decodeFilter(encoded, fields);
}

/** Brings a tree of any known version to `v: 1` (the current version) and validates it. */
export function migrateFilter(input: unknown): FilterTree {
  return defaultGrammar.migrateFilter(input);
}

/** JSON Schema (draft 2020-12) of `filterTreeSchema`, generated, never hand-written (Contracts §1). */
export function filterTreeJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(defaultGrammar.schemas.tree, { io: 'input' }) as Record<string, unknown>;
}
