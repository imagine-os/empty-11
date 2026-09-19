/**
 * `FilterTree` for the spec `data` and `access` sections: the shared grammar from
 * `@paperos/core/filter` (PAP-279, ADR 0012), re-exported with a named `$defs`
 * entry so the generated JSON Schema and the field reference call it `FilterTree`.
 * Contracts §1: the spec data section is an alias of this one type, never a copy.
 */
import {
  type Condition,
  type FilterNode,
  type FilterTree,
  filterNodeSchema,
  filterTreeSchema,
  type Group,
  type Operator,
} from '@paperos/core/filter';
import { z } from 'zod';

export type { Condition, FilterNode, FilterTree, Group, Operator };

// Name the recursive node once so the JSON Schema says `FilterNode`, not `__schema0`.
z.globalRegistry.add(filterNodeSchema, {
  id: 'FilterNode',
  description:
    'A group `{ op, children }` or a condition `{ field, operator, value }` inside a `FilterTree`.',
});

export const FilterTreeSchema = filterTreeSchema.meta({
  id: 'FilterTree',
  description:
    'Shared filter grammar (`@paperos/core/filter`, PAP-279): a group `{ op, children }` or a condition `{ field, operator, value }`, optional `v: 1`.',
});
