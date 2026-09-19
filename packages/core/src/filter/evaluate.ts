/**
 * `evaluate`: runs a `FilterTree` against one in-memory row with SQL's three-valued
 * logic. `evaluateThreeValued` exposes UNKNOWN as `null`; `evaluate` collapses it to
 * `false`, which is what a `WHERE` clause does.
 */
import { FilterError, joinPath } from './errors.js';
import {
  type FieldDef,
  type FilterContext,
  type FilterNode,
  type FilterTree,
  isGroup,
} from './schema.js';
import { type GrammarInternals, parseWith, resolveConditionValue } from './validate.js';

/** A row keyed by column key (`FieldDef.column`, defaulting to the field name). `undefined` and `null` are both SQL NULL. */
export type Row = Readonly<Record<string, unknown>>;

export interface EvaluateOptions {
  /** Skip `FieldSchema` validation when the tree was already parsed with `parseFilter`. Default `false`. */
  readonly validated?: boolean | undefined;
}

export function evaluateThreeValuedWith<Op extends string>(
  internals: GrammarInternals<Op>,
  tree: FilterTree<Op>,
  row: Row,
  ctx: FilterContext,
  options: EvaluateOptions = {},
): boolean | null {
  const root = options.validated ? tree : parseWith(internals, tree, ctx.fields);

  const run = (node: FilterNode<Op>, path: (string | number)[]): boolean | null => {
    if (isGroup(node)) {
      const results = node.children.map((child, i) => run(child, [...path, 'children', i]));
      const all = and3(results);
      if (node.op === 'not') return all === null ? null : !all;
      if (node.op === 'and') return all;
      return or3(results);
    }
    const at = joinPath(path);
    const def = ctx.fields[node.field] as FieldDef;
    const op = internals.operators.get(node.operator);
    if (op === undefined)
      throw new FilterError('FILTER_INVALID', `unknown operator "${node.operator}"`);
    const value = resolveConditionValue(node, op, def, ctx.variables, at);
    return op.evaluate(row[def.column ?? node.field], value, def);
  };

  return run(root, []);
}

export function evaluateWith<Op extends string>(
  internals: GrammarInternals<Op>,
  tree: FilterTree<Op>,
  row: Row,
  ctx: FilterContext,
  options: EvaluateOptions = {},
): boolean {
  return evaluateThreeValuedWith(internals, tree, row, ctx, options) === true;
}

/** SQL AND: false wins, then unknown, else true. Empty is true. */
export function and3(values: readonly (boolean | null)[]): boolean | null {
  let unknown = false;
  for (const v of values) {
    if (v === false) return false;
    if (v === null) unknown = true;
  }
  return unknown ? null : true;
}

/** SQL OR: true wins, then unknown, else false. Empty is false. */
export function or3(values: readonly (boolean | null)[]): boolean | null {
  let unknown = false;
  for (const v of values) {
    if (v === true) return true;
    if (v === null) unknown = true;
  }
  return unknown ? null : false;
}
