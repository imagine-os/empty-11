/**
 * The one filter and condition grammar of PaperOS (Contracts §1, ADR 0012).
 *
 * `FilterTree = Group | Condition`, versioned `v: 1` at the root. Permissions
 * `Condition` (PAP-59), the view `FilterGroup` (PAP-161), spec data queries
 * (PAP-119), segments (PAP-195) and automations (PAP-174) are aliases of this type.
 *
 * This file holds the shape only. Operator × field-type rules live in
 * `operators.ts`, `FieldSchema`-aware validation in `validate.ts`.
 */
import { z } from 'zod';

export const FILTER_VERSION = 1 as const;
/** Maximum number of nested groups: the root group counts as 1. */
export const MAX_DEPTH = 8;
/** Maximum number of conditions in one tree. */
export const MAX_CONDITIONS = 200;
/** Maximum number of values in an `in` / `nin` list. */
export const MAX_LIST_VALUES = 1000;
/** Maximum number of segments in a jsonb path. */
export const MAX_JSON_PATH = 32;

export const GROUP_OPS = ['and', 'or', 'not'] as const;
export type GroupOp = (typeof GROUP_OPS)[number];

export const OPERATORS = [
  'eq',
  'neq',
  'in',
  'nin',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'isNull',
  'isNotNull',
  'between',
  'has',
  'matches',
] as const;
export type Operator = (typeof OPERATORS)[number];

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export type Scalar = string | number | boolean | null;

/** A reference resolved from `Variables` at evaluation time, for example `{ $var: 'principal.id' }`. */
export interface VarRef {
  readonly $var: string;
}

/** Value of the `matches` operator: the jsonb value at `path` exists, and equals `equals` when given. */
export interface JsonPathMatch {
  readonly path: readonly string[];
  readonly equals?: Scalar | VarRef | undefined;
}

export type ConditionValue = Scalar | readonly Scalar[] | VarRef | JsonPathMatch;

export const scalarSchema: z.ZodType<Scalar> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const varRefSchema: z.ZodType<VarRef> = z.strictObject({
  $var: z.string().min(1).max(200),
});

export const jsonPathMatchSchema: z.ZodType<JsonPathMatch> = z.strictObject({
  path: z.array(z.string().max(200)).min(1).max(MAX_JSON_PATH),
  equals: z.union([scalarSchema, varRefSchema]).optional(),
});

export const conditionValueSchema: z.ZodType<ConditionValue> = z.union([
  scalarSchema,
  z.array(scalarSchema).max(MAX_LIST_VALUES),
  varRefSchema,
  jsonPathMatchSchema,
]);

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface Condition<Op extends string = Operator> {
  readonly field: string;
  readonly operator: Op;
  readonly value?: ConditionValue | undefined;
}

export interface Group<Op extends string = Operator> {
  readonly op: GroupOp;
  readonly children: readonly FilterNode<Op>[];
}

export type FilterNode<Op extends string = Operator> = Group<Op> | Condition<Op>;

/** Root of a filter: a node with the grammar version. `v` may be omitted on input and is always `1` after `normalize`. */
export type FilterTree<Op extends string = Operator> = FilterNode<Op> & {
  readonly v?: typeof FILTER_VERSION | undefined;
};

export function isGroup<Op extends string>(node: FilterNode<Op>): node is Group<Op> {
  return 'op' in node && Array.isArray((node as Group<Op>).children);
}

export function isCondition<Op extends string>(node: FilterNode<Op>): node is Condition<Op> {
  return !isGroup(node);
}

export function isVarRef(value: unknown): value is VarRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as VarRef).$var === 'string'
  );
}

export function isJsonPathMatch(value: unknown): value is JsonPathMatch {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as JsonPathMatch).path)
  );
}

export interface FilterSchemas<Op extends string> {
  readonly condition: z.ZodType<Condition<Op>>;
  readonly group: z.ZodType<Group<Op>>;
  readonly node: z.ZodType<FilterNode<Op>>;
  readonly tree: z.ZodType<FilterTree<Op>>;
}

/**
 * Builds the Zod schemas for a given operator vocabulary. The default grammar
 * uses `OPERATORS`; `createFilterGrammar` adds extension operators (PAP-161).
 */
export function buildFilterSchemas<Op extends string>(
  operators: readonly [Op, ...Op[]],
): FilterSchemas<Op> {
  const condition: z.ZodType<Condition<Op>> = z.strictObject({
    field: z.string().min(1).max(200),
    operator: z.enum(operators),
    value: conditionValueSchema.optional(),
  });

  const node: z.ZodType<FilterNode<Op>> = z.lazy(() => z.union([group, condition]));

  const group: z.ZodType<Group<Op>> = z.strictObject({
    op: z.enum(GROUP_OPS),
    children: z.array(node),
  });

  const version = z.literal(FILTER_VERSION).optional();
  const tree: z.ZodType<FilterTree<Op>> = z
    .union([
      z.strictObject({ v: version, op: z.enum(GROUP_OPS), children: z.array(node) }),
      z.strictObject({
        v: version,
        field: z.string().min(1).max(200),
        operator: z.enum(operators),
        value: conditionValueSchema.optional(),
      }),
    ])
    .superRefine((root, ctx) => {
      let conditions = 0;
      const walk = (n: FilterNode<Op>, path: (string | number)[], depth: number): void => {
        if (isGroup(n)) {
          const groupDepth = depth + 1;
          if (groupDepth > MAX_DEPTH) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `filter nests ${groupDepth} groups deep; the maximum is ${MAX_DEPTH}`,
            });
            return;
          }
          for (const [i, child] of n.children.entries())
            walk(child, [...path, 'children', i], groupDepth);
          return;
        }
        conditions += 1;
      };
      walk(root, [], 0);
      if (conditions > MAX_CONDITIONS) {
        ctx.addIssue({
          code: 'custom',
          path: [],
          message: `filter has ${conditions} conditions; the maximum is ${MAX_CONDITIONS}`,
        });
      }
    });

  return { condition, group, node, tree };
}

const defaultSchemas = buildFilterSchemas(OPERATORS);

/** Zod schema of one condition. */
export const conditionSchema = defaultSchemas.condition;
/** Zod schema of one group. */
export const groupSchema = defaultSchemas.group;
/** Zod schema of any node. */
export const filterNodeSchema = defaultSchemas.node;
/**
 * Zod schema of a whole filter: structure, depth (8) and size (200 conditions).
 * Field names, operator × type and value shapes are checked by `validateFilter`
 * against a `FieldSchema`.
 */
export const filterTreeSchema = defaultSchemas.tree;

// ---------------------------------------------------------------------------
// Field schema
// ---------------------------------------------------------------------------

export const FIELD_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'uuid',
  'enum',
  'array',
  'json',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const ARRAY_ITEM_TYPES = ['string', 'number', 'integer', 'boolean', 'uuid'] as const;
export type ArrayItemType = (typeof ARRAY_ITEM_TYPES)[number];

interface FieldDefBase {
  /** Column key on the table (Drizzle key, or the column name for a string table). Defaults to the field name. */
  readonly column?: string | undefined;
  /** Human label used by `explain`. Defaults to the field name. */
  readonly label?: string | undefined;
}

export type FieldDef = FieldDefBase &
  (
    | {
        readonly type: 'string';
        /** citext semantics: `eq`, `neq`, `in`, `nin` compare with `lower()`. `contains` and `startsWith` are always case-insensitive. */
        readonly caseInsensitive?: boolean | undefined;
      }
    | { readonly type: 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'uuid' | 'json' }
    | { readonly type: 'enum'; readonly values: readonly string[] }
    | { readonly type: 'array'; readonly items: ArrayItemType }
  );

/** Field name → definition. Both evaluators need one; it types `value` per operator. */
export type FieldSchema = Readonly<Record<string, FieldDef>>;

const fieldDefBase = {
  column: z.string().min(1).optional(),
  label: z.string().optional(),
};

export const fieldDefSchema: z.ZodType<FieldDef> = z.discriminatedUnion('type', [
  z.strictObject({
    ...fieldDefBase,
    type: z.literal('string'),
    caseInsensitive: z.boolean().optional(),
  }),
  z.strictObject({
    ...fieldDefBase,
    type: z.enum(['number', 'integer', 'boolean', 'date', 'datetime', 'uuid', 'json']),
  }),
  z.strictObject({ ...fieldDefBase, type: z.literal('enum'), values: z.array(z.string()).min(1) }),
  z.strictObject({ ...fieldDefBase, type: z.literal('array'), items: z.enum(ARRAY_ITEM_TYPES) }),
]);

export const fieldSchemaSchema: z.ZodType<FieldSchema> = z.record(z.string(), fieldDefSchema);

/** Identity helper that keeps literal types (`type: 'enum', values: ['a', 'b']`) for `ValueFor`. */
export function defineFields<const F extends FieldSchema>(fields: F): F {
  return fields;
}

/** Values a `{ $var }` reference resolves against, by dotted path (`principal.id`). */
export type Variables = Readonly<Record<string, unknown>>;

/** What both evaluators need besides the tree. */
export interface FilterContext {
  readonly fields: FieldSchema;
  readonly variables?: Variables | undefined;
}

// ---------------------------------------------------------------------------
// Type-level narrowing (tested with expectTypeOf)
// ---------------------------------------------------------------------------

/** TypeScript type of one scalar of a field definition. */
export type ScalarFor<D extends FieldDef> = D extends {
  readonly type: 'enum';
  readonly values: readonly (infer V)[];
}
  ? V
  : D extends { readonly type: 'number' | 'integer' }
    ? number
    : D extends { readonly type: 'boolean' }
      ? boolean
      : D extends { readonly type: 'string' | 'uuid' | 'date' | 'datetime' }
        ? string
        : D extends { readonly type: 'array'; readonly items: infer I extends ArrayItemType }
          ? I extends 'number' | 'integer'
            ? number
            : I extends 'boolean'
              ? boolean
              : string
          : never;

type EqualityOps = 'eq' | 'neq' | 'in' | 'nin';
type OrderingOps = 'lt' | 'lte' | 'gt' | 'gte' | 'between';
type NullOps = 'isNull' | 'isNotNull';

/** Operators allowed on a field definition (mirrors `OPERATORS_BY_TYPE`). */
export type OperatorsFor<D extends FieldDef> = D extends { readonly type: 'string' }
  ? EqualityOps | 'contains' | 'startsWith' | NullOps
  : D extends { readonly type: 'number' | 'integer' | 'date' | 'datetime' }
    ? EqualityOps | OrderingOps | NullOps
    : D extends { readonly type: 'boolean' | 'uuid' | 'enum' }
      ? EqualityOps | NullOps
      : D extends { readonly type: 'array' }
        ? 'has' | NullOps
        : D extends { readonly type: 'json' }
          ? 'matches' | NullOps
          : never;

/** The `value` type a condition on field `K` with operator `Op` accepts. */
export type ValueFor<
  F extends FieldSchema,
  K extends keyof F,
  Op extends string,
> = Op extends NullOps
  ? undefined
  : Op extends 'in' | 'nin'
    ? readonly ScalarFor<F[K]>[] | VarRef
    : Op extends 'between'
      ? readonly [ScalarFor<F[K]>, ScalarFor<F[K]>] | VarRef
      : Op extends 'matches'
        ? JsonPathMatch
        : ScalarFor<F[K]> | VarRef;

/** A condition whose `value` is typed by the field schema. */
export type TypedCondition<F extends FieldSchema, K extends keyof F & string = keyof F & string> = {
  [P in K]: {
    [Op in OperatorsFor<F[P]>]: ValueFor<F, P, Op> extends undefined
      ? { readonly field: P; readonly operator: Op; readonly value?: undefined }
      : { readonly field: P; readonly operator: Op; readonly value: ValueFor<F, P, Op> };
  }[OperatorsFor<F[P]>];
}[K];

/**
 * Typed condition builder: `condition(fields, 'amount', 'gt', 10)` type-checks the
 * operator against the field type and the value against both.
 */
export function condition<
  F extends FieldSchema,
  K extends keyof F & string,
  Op extends OperatorsFor<F[K]> & Operator,
>(
  _fields: F,
  field: K,
  operator: Op,
  ...rest: ValueFor<F, K, Op> extends undefined ? [] : [value: ValueFor<F, K, Op>]
): Condition {
  const value = rest[0] as ConditionValue | undefined;
  return value === undefined ? { field, operator } : { field, operator, value };
}

/** `and(...)`, `or(...)`, `not(...)` builders for hand-written trees. */
export const and = <Op extends string = Operator>(...children: FilterNode<Op>[]): Group<Op> => ({
  op: 'and',
  children,
});
export const or = <Op extends string = Operator>(...children: FilterNode<Op>[]): Group<Op> => ({
  op: 'or',
  children,
});
export const not = <Op extends string = Operator>(...children: FilterNode<Op>[]): Group<Op> => ({
  op: 'not',
  children,
});
