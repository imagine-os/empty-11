/**
 * Interim `FilterTree` alias for the spec `data` and `access` sections.
 *
 * TODO(PAP-279): delete this file and import
 * `import { filterTreeSchema, type FilterTree } from '@paperos/core/filter';`
 * once `packages/core/src/filter/` is on `main`. The shape below mirrors the
 * PAP-279 spec (Group = { op: and|or|not, children }, Condition = { field, operator, value })
 * so switching is a one-line import change with no fixture edits.
 */
import { z } from 'zod';

export const FILTER_OPERATORS = [
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

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  /** Literal, or `{ $var: 'principal.id' }` bound at evaluation time. */
  value?: unknown;
}

export interface FilterGroup {
  op: 'and' | 'or' | 'not';
  children: FilterTree[];
}

export type FilterTree = FilterGroup | FilterCondition;

export const FilterConditionSchema = z
  .strictObject({
    field: z.string().min(1).describe('Field path on the entity, dotted for relations.'),
    operator: z.enum(FILTER_OPERATORS).describe('Comparison operator (PAP-279 grammar).'),
    value: z
      .unknown()
      .optional()
      .describe('Literal value, or `{ $var: "principal.id" }` bound at evaluation time.'),
  })
  .meta({ id: 'FilterCondition', description: 'Leaf condition of a `FilterTree`.' });

export const FilterTreeSchema: z.ZodType<FilterTree> = z
  .lazy(() =>
    z.union([
      z.strictObject({
        op: z.enum(['and', 'or', 'not']).describe('Boolean combinator.'),
        children: z.array(FilterTreeSchema).describe('Child trees; `not` takes exactly one.'),
      }),
      FilterConditionSchema,
    ]),
  )
  .meta({
    id: 'FilterTree',
    description:
      'Shared filter grammar (`@paperos/core/filter`, PAP-279): a group `{ op, children }` or a condition `{ field, operator, value }`.',
  });
