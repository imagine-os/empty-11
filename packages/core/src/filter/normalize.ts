/**
 * `normalize`: the canonical form of a tree. Same meaning, one spelling, so two filters
 * can be compared, hashed or cached by their JSON. Idempotent: `normalize(normalize(t))`
 * deep-equals `normalize(t)`; property-tested along with semantic equivalence.
 *
 * Rules: root carries `v: 1`; `and`/`or` nested in the same op are flattened; identity
 * children (`and []` in `and`, `or []` in `or`) are dropped; duplicate children are
 * dropped; single-child `and`/`or` collapse to the child; `not (not x)` is `x`;
 * children of `and`/`or` are sorted by their canonical JSON; `in`/`nin` lists are
 * de-duplicated and sorted; `value` is omitted when `undefined`.
 */
import {
  type Condition,
  type ConditionValue,
  FILTER_VERSION,
  type FilterNode,
  type FilterTree,
  type Group,
  isGroup,
  isJsonPathMatch,
  isVarRef,
  type Scalar,
} from './schema.js';

export function normalize<Op extends string>(tree: FilterTree<Op>): FilterTree<Op> {
  const { v: _v, ...rest } = tree;
  const node = normalizeNode(rest as FilterNode<Op>);
  return { v: FILTER_VERSION, ...node };
}

function normalizeNode<Op extends string>(node: FilterNode<Op>): FilterNode<Op> {
  return isGroup(node) ? normalizeGroup(node) : normalizeCondition(node);
}

function normalizeCondition<Op extends string>(node: Condition<Op>): Condition<Op> {
  const value = normalizeValue(node.operator, node.value);
  return value === undefined
    ? { field: node.field, operator: node.operator }
    : { field: node.field, operator: node.operator, value };
}

const LIST_OPERATORS = new Set(['in', 'nin']);

function normalizeValue(
  operator: string,
  value: ConditionValue | undefined,
): ConditionValue | undefined {
  if (value === undefined) return undefined;
  if (isVarRef(value)) return { $var: value.$var };
  if (isJsonPathMatch(value)) {
    const equals = value.equals;
    return equals === undefined
      ? { path: [...value.path] }
      : { path: [...value.path], equals: isVarRef(equals) ? { $var: equals.$var } : equals };
  }
  if (Array.isArray(value) && LIST_OPERATORS.has(operator)) {
    return [...new Set(value as readonly Scalar[])].sort(compareScalars);
  }
  return value;
}

function rank(v: Scalar): number {
  if (v === null) return 0;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 2;
  return 3;
}

function compareScalars(a: Scalar, b: Scalar): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (a === b) return 0;
  return (a as string | number | boolean) < (b as string | number | boolean) ? -1 : 1;
}

function normalizeGroup<Op extends string>(node: Group<Op>): FilterNode<Op> {
  const children = node.children.map(normalizeNode);
  if (node.op === 'not') {
    const only = children[0];
    if (children.length === 1 && only && isGroup(only) && only.op === 'not') {
      return normalizeGroup({ op: 'and', children: only.children });
    }
    return { op: 'not', children };
  }
  const flat: FilterNode<Op>[] = [];
  for (const child of children) {
    if (isGroup(child) && child.op === node.op) flat.push(...child.children);
    else flat.push(child);
  }
  const seen = new Set<string>();
  const unique: { key: string; node: FilterNode<Op> }[] = [];
  for (const child of flat) {
    if (isGroup(child) && child.op === node.op && child.children.length === 0) continue;
    const key = JSON.stringify(child);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ key, node: child });
  }
  unique.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  if (unique.length === 1) return (unique[0] as { node: FilterNode<Op> }).node;
  return { op: node.op, children: unique.map((u) => u.node) };
}
