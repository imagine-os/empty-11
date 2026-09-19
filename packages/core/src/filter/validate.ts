/**
 * `FieldSchema`-aware validation: field exists (with suggestions), operator fits the
 * field type, value fits operator and type. Variables are shape-checked when they
 * resolve, with the same rules.
 */
import {
  type FilterIssue,
  FilterValidationError,
  FilterVariableError,
  joinPath,
} from './errors.js';
import type { OperatorDefinition } from './operators.js';
import {
  type Condition,
  type FieldDef,
  type FieldSchema,
  type FilterNode,
  type FilterSchemas,
  type FilterTree,
  isGroup,
  isJsonPathMatch,
  isVarRef,
  type Scalar,
  type Variables,
} from './schema.js';
import { resolveVariable } from './variables.js';

export interface GrammarInternals<Op extends string> {
  readonly schemas: FilterSchemas<Op>;
  readonly operators: ReadonlyMap<string, OperatorDefinition>;
}

export type ValidationResult<Op extends string> =
  | { readonly ok: true; readonly tree: FilterTree<Op>; readonly issues: readonly [] }
  | { readonly ok: false; readonly tree?: undefined; readonly issues: readonly FilterIssue[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function typeName(def: FieldDef): string {
  return def.type === 'array' ? `array of ${def.items}` : def.type;
}

/** `undefined` when `value` is a valid scalar of `def`, else a message. `null` is never valid here. */
export function checkScalar(def: FieldDef, value: unknown): string | undefined {
  if (value === null || value === undefined) return 'null is not a value; use isNull / isNotNull';
  switch (def.type) {
    case 'string':
      return typeof value === 'string' ? undefined : 'expected a string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : 'expected a number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
        ? undefined
        : 'expected an integer';
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'expected a boolean';
    case 'date':
      return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value))
        ? undefined
        : 'expected a date as YYYY-MM-DD';
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? undefined
        : 'expected an ISO-8601 timestamp';
    case 'uuid':
      return typeof value === 'string' && UUID_RE.test(value) ? undefined : 'expected a UUID';
    case 'enum':
      return typeof value === 'string' && def.values.includes(value)
        ? undefined
        : `expected one of ${def.values.map((v) => JSON.stringify(v)).join(', ')}`;
    case 'array':
      return checkScalar({ type: def.items }, value);
    case 'json':
      return 'json fields take a { path, equals? } value';
  }
}

interface CheckOptions {
  /** Literal trees may carry `{ $var }`; resolved values may carry `null`. */
  readonly mode: 'literal' | 'resolved';
}

/** Checks a value against an operator's arity and the field type. `undefined` means valid. */
export function checkValue(
  op: OperatorDefinition,
  def: FieldDef,
  value: unknown,
  options: CheckOptions,
): string | undefined {
  const literal = options.mode === 'literal';
  const target = op.valueDef ?? def;
  if (op.arity === 'none') {
    return value === undefined ? undefined : `operator "${op.name}" takes no value`;
  }
  if (literal && isVarRef(value)) return undefined;
  if (value === undefined) return `operator "${op.name}" needs a value`;
  switch (op.arity) {
    case 'scalar':
      if (!literal && value === null) return undefined;
      return checkScalar(target, value);
    case 'list': {
      if (!Array.isArray(value)) return `operator "${op.name}" takes a list of ${typeName(target)}`;
      for (const [i, item] of value.entries()) {
        const problem = checkScalar(target, item);
        if (problem) return `list item ${i}: ${problem}`;
      }
      return undefined;
    }
    case 'pair': {
      if (!Array.isArray(value) || value.length !== 2) {
        return `operator "${op.name}" takes a [low, high] pair of ${typeName(target)}`;
      }
      for (const [i, item] of value.entries()) {
        if (!literal && item === null) continue;
        const problem = checkScalar(target, item);
        if (problem) return `${i === 0 ? 'low' : 'high'} bound: ${problem}`;
      }
      return undefined;
    }
    case 'json': {
      if (!isJsonPathMatch(value)) return `operator "${op.name}" takes { path: string[], equals? }`;
      const { equals } = value;
      if (equals === undefined || equals === null) return undefined;
      if (literal && isVarRef(equals)) return undefined;
      if (typeof equals === 'object')
        return 'equals must be a scalar (string, number, boolean or null)';
      return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Unknown-field suggestions
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0] as number;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j] as number;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(temp + 1, (prev[j - 1] as number) + 1, diagonal + cost);
      diagonal = temp;
    }
  }
  return prev[b.length] as number;
}

/** Up to three field names close to `name` (edit distance or substring), best first. */
export function suggestFields(name: string, fields: FieldSchema): string[] {
  const lower = name.toLowerCase();
  const scored = Object.keys(fields)
    .map((candidate) => {
      const c = candidate.toLowerCase();
      const distance = levenshtein(lower, c);
      const related = c.includes(lower) || lower.includes(c);
      const budget = Math.max(2, Math.floor(lower.length / 3));
      return { candidate, distance, keep: related || distance <= budget };
    })
    .filter((s) => s.keep)
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));
  return scored.slice(0, 3).map((s) => s.candidate);
}

// ---------------------------------------------------------------------------
// Tree validation
// ---------------------------------------------------------------------------

export function validateWith<Op extends string>(
  internals: GrammarInternals<Op>,
  input: unknown,
  fields: FieldSchema,
): ValidationResult<Op> {
  const parsed = internals.schemas.tree.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: joinPath(issue.path.map((p) => String(p))),
        message: issue.message,
      })),
    };
  }
  const issues: FilterIssue[] = [];
  const walk = (node: FilterNode<Op>, path: (string | number)[]): void => {
    if (isGroup(node)) {
      for (const [i, child] of node.children.entries()) walk(child, [...path, 'children', i]);
      return;
    }
    const at = joinPath(path);
    const def = fields[node.field];
    if (def === undefined) {
      const suggestions = suggestFields(node.field, fields);
      const hint = suggestions.length
        ? `; did you mean ${suggestions.map((s) => JSON.stringify(s)).join(', ')}?`
        : '';
      issues.push({ path: at, message: `unknown field "${node.field}"${hint}`, suggestions });
      return;
    }
    const op = internals.operators.get(node.operator);
    if (op === undefined) {
      issues.push({ path: at, message: `unknown operator "${node.operator}"` });
      return;
    }
    if (!op.types.includes(def.type)) {
      const allowed = [...internals.operators.values()]
        .filter((o) => o.types.includes(def.type))
        .map((o) => o.name)
        .join(', ');
      issues.push({
        path: at,
        message: `operator "${op.name}" is not allowed on ${typeName(def)} field "${node.field}"; allowed: ${allowed}`,
      });
      return;
    }
    const problem = checkValue(op, def, node.value, { mode: 'literal' });
    if (problem) issues.push({ path: `${at}${at ? '.' : ''}value`, message: problem });
  };
  walk(parsed.data, []);
  return issues.length === 0 ? { ok: true, tree: parsed.data, issues: [] } : { ok: false, issues };
}

export function parseWith<Op extends string>(
  internals: GrammarInternals<Op>,
  input: unknown,
  fields: FieldSchema,
): FilterTree<Op> {
  const result = validateWith(internals, input, fields);
  if (!result.ok) throw new FilterValidationError(result.issues);
  return result.tree;
}

// ---------------------------------------------------------------------------
// Runtime value resolution (variables)
// ---------------------------------------------------------------------------

/** Resolves `{ $var }` references (top level and `matches.equals`) and shape-checks the result. */
export function resolveConditionValue(
  node: Condition<string>,
  op: OperatorDefinition,
  def: FieldDef,
  variables: Variables | undefined,
  path: string,
): unknown {
  let value: unknown = node.value;
  let variable: string | undefined;
  if (isVarRef(value)) {
    variable = value.$var;
    value = resolveVariable(value, variables, path);
  } else if (op.arity === 'json' && isJsonPathMatch(value) && isVarRef(value.equals)) {
    variable = value.equals.$var;
    const equals = resolveVariable(value.equals, variables, path);
    value = { path: value.path, equals: equals as Scalar };
  }
  const problem = checkValue(op, def, value, { mode: 'resolved' });
  if (problem !== undefined) {
    if (variable !== undefined) {
      throw new FilterVariableError(
        'FILTER_VARIABLE_TYPE',
        variable,
        path,
        `variable "${variable}" resolved to an unusable value for ${op.name} on ${typeName(def)} field "${node.field}": ${problem}`,
      );
    }
    throw new FilterValidationError([{ path, message: problem }]);
  }
  return value;
}
