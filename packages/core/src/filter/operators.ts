/**
 * Operator definitions: for every operator, the field types it accepts, the shape of
 * its value, its SQL, its in-memory evaluation and its wording. Both evaluators are
 * generated from this table, which is what the property test proves equivalent.
 *
 * Null semantics are SQL's three-valued logic: `evaluate` returns `null` for UNKNOWN
 * exactly where Postgres would, and `toSql` never coerces a NULL.
 */
import { type SQL, sql } from 'drizzle-orm';
import type { FieldDef, FieldType, JsonPathMatch, Operator, Scalar } from './schema.js';

export type Arity = 'none' | 'scalar' | 'list' | 'pair' | 'json';
export type Locale = 'en' | 'es';

export interface ExplainArgs {
  readonly locale: Locale;
  /** Field label, already resolved. */
  readonly field: string;
  /** The literal or `VarRef` value, unresolved. */
  readonly value: unknown;
  /** Formats any value in the locale (quotes strings, renders variables as `$name`). */
  readonly format: (value: unknown) => string;
}

export interface OperatorDefinition<Name extends string = string> {
  readonly name: Name;
  /** Field types this operator may be used on. */
  readonly types: readonly FieldType[];
  /** Shape of `value`: none, one scalar, a list, a `[lo, hi]` pair or a `JsonPathMatch`. */
  readonly arity: Arity;
  /** Short code for `encodeFilter`; defaults to `name`. Must be unique in a grammar. */
  readonly code?: string | undefined;
  /** Definition the value is checked against when it is not the field's own type (e.g. `{ type: 'integer' }` for a "within N days" operator). */
  readonly valueDef?: FieldDef | undefined;
  /** SQL fragment. `value` is resolved (no `VarRef`) and shape-checked. */
  toSql(column: SQL, value: unknown, def: FieldDef): SQL;
  /** Three-valued in-memory evaluation. `value` is resolved and shape-checked. */
  evaluate(rowValue: unknown, value: unknown, def: FieldDef): boolean | null;
  /** Human wording, one line. */
  explain(args: ExplainArgs): string;
}

const SCALAR_TYPES: readonly FieldType[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'uuid',
  'enum',
];
const ORDERED_TYPES: readonly FieldType[] = ['number', 'integer', 'date', 'datetime'];
const ALL_TYPES: readonly FieldType[] = [...SCALAR_TYPES, 'array', 'json'];

// ---------------------------------------------------------------------------
// Comparable keys: how a row value and a literal collapse to something `===` can judge
// ---------------------------------------------------------------------------

type Key = string | number | boolean;

function itemDef(def: FieldDef): FieldDef {
  return def.type === 'array' ? { type: def.items } : def;
}

/** Collapses a value to a comparable key for `def`, or `null` when it is SQL NULL. */
export function toKey(def: FieldDef, value: unknown): Key | null {
  if (value === null || value === undefined) return null;
  switch (def.type) {
    case 'string':
      return def.caseInsensitive ? String(value).toLowerCase() : String(value);
    case 'uuid':
      return String(value).toLowerCase();
    case 'enum':
      return String(value);
    case 'number':
    case 'integer':
      return typeof value === 'number' ? value : Number(value);
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 'true' || value === 't';
    case 'date':
    case 'datetime':
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'number') return value;
      return Date.parse(String(value));
    case 'array':
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

function compareKeys(a: Key, b: Key): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function eq3(def: FieldDef, rowValue: unknown, value: unknown): boolean | null {
  const a = toKey(def, rowValue);
  const b = toKey(def, value);
  if (a === null || b === null) return null;
  return a === b;
}

function cmp3(
  def: FieldDef,
  rowValue: unknown,
  value: unknown,
  test: (c: number) => boolean,
): boolean | null {
  const a = toKey(def, rowValue);
  const b = toKey(def, value);
  if (a === null || b === null) return null;
  return test(compareKeys(a, b));
}

function not3(v: boolean | null): boolean | null {
  return v === null ? null : !v;
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

function ci(def: FieldDef, expr: SQL): SQL {
  return def.type === 'string' && def.caseInsensitive ? sql`lower(${expr})` : expr;
}

/** Escapes `%`, `_` and `\` for a LIKE pattern using `\` as the escape character. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Renders a Postgres `text[]` literal (`{a,"b c"}`) for a `#>` path. */
export function pgTextArrayLiteral(items: readonly string[]): string {
  const quoted = items.map((s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return `{${quoted.join(',')}}`;
}

function listSql(def: FieldDef, values: readonly Scalar[]): SQL {
  return sql.join(
    values.map((v) => ci(def, sql`${v}`)),
    sql`, `,
  );
}

// ---------------------------------------------------------------------------
// jsonb path
// ---------------------------------------------------------------------------

/** In-memory `#>`: the value at `path`, or `undefined` when the path does not exist (SQL NULL). */
export function jsonAtPath(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      if (!/^-?\d+$/.test(segment)) return undefined;
      let index = Number.parseInt(segment, 10);
      if (index < 0) index += current.length;
      if (index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (current !== null && typeof current === 'object') {
      if (!Object.hasOwn(current, segment)) return undefined;
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function jsonEquals(at: unknown, equals: Scalar): boolean {
  if (equals === null) return at === null;
  if (at === null || typeof at === 'object') return false;
  return at === equals;
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

type Template = Readonly<Record<Locale, string>>;

function words(t: Template): (args: ExplainArgs) => string {
  return ({ locale, field, value, format }) =>
    t[locale].replace('{field}', field).replace('{value}', format(value));
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export const BUILTIN_OPERATORS: readonly OperatorDefinition<Operator>[] = [
  {
    name: 'eq',
    code: '=',
    types: SCALAR_TYPES,
    arity: 'scalar',
    toSql: (col, v, def) => sql`${ci(def, col)} = ${ci(def, sql`${v}`)}`,
    evaluate: (row, v, def) => eq3(def, row, v),
    explain: words({ en: '{field} is {value}', es: '{field} es {value}' }),
  },
  {
    name: 'neq',
    code: '!=',
    types: SCALAR_TYPES,
    arity: 'scalar',
    toSql: (col, v, def) => sql`${ci(def, col)} <> ${ci(def, sql`${v}`)}`,
    evaluate: (row, v, def) => not3(eq3(def, row, v)),
    explain: words({ en: '{field} is not {value}', es: '{field} no es {value}' }),
  },
  {
    name: 'in',
    code: 'in',
    types: SCALAR_TYPES,
    arity: 'list',
    toSql: (col, v, def) => {
      const list = v as readonly Scalar[];
      return list.length === 0 ? sql`false` : sql`${ci(def, col)} in (${listSql(def, list)})`;
    },
    evaluate: (row, v, def) => {
      const list = v as readonly Scalar[];
      if (list.length === 0) return false;
      const key = toKey(def, row);
      if (key === null) return null;
      return list.some((item) => toKey(def, item) === key);
    },
    explain: words({ en: '{field} is one of {value}', es: '{field} es uno de {value}' }),
  },
  {
    name: 'nin',
    code: '!in',
    types: SCALAR_TYPES,
    arity: 'list',
    toSql: (col, v, def) => {
      const list = v as readonly Scalar[];
      return list.length === 0 ? sql`true` : sql`${ci(def, col)} not in (${listSql(def, list)})`;
    },
    evaluate: (row, v, def) => {
      const list = v as readonly Scalar[];
      if (list.length === 0) return true;
      const key = toKey(def, row);
      if (key === null) return null;
      return !list.some((item) => toKey(def, item) === key);
    },
    explain: words({ en: '{field} is none of {value}', es: '{field} no es ninguno de {value}' }),
  },
  {
    name: 'lt',
    code: '<',
    types: ORDERED_TYPES,
    arity: 'scalar',
    toSql: (col, v) => sql`${col} < ${v}`,
    evaluate: (row, v, def) => cmp3(def, row, v, (c) => c < 0),
    explain: words({ en: '{field} is less than {value}', es: '{field} es menor que {value}' }),
  },
  {
    name: 'lte',
    code: '<=',
    types: ORDERED_TYPES,
    arity: 'scalar',
    toSql: (col, v) => sql`${col} <= ${v}`,
    evaluate: (row, v, def) => cmp3(def, row, v, (c) => c <= 0),
    explain: words({ en: '{field} is at most {value}', es: '{field} es como máximo {value}' }),
  },
  {
    name: 'gt',
    code: '>',
    types: ORDERED_TYPES,
    arity: 'scalar',
    toSql: (col, v) => sql`${col} > ${v}`,
    evaluate: (row, v, def) => cmp3(def, row, v, (c) => c > 0),
    explain: words({ en: '{field} is greater than {value}', es: '{field} es mayor que {value}' }),
  },
  {
    name: 'gte',
    code: '>=',
    types: ORDERED_TYPES,
    arity: 'scalar',
    toSql: (col, v) => sql`${col} >= ${v}`,
    evaluate: (row, v, def) => cmp3(def, row, v, (c) => c >= 0),
    explain: words({ en: '{field} is at least {value}', es: '{field} es como mínimo {value}' }),
  },
  {
    name: 'between',
    code: '..',
    types: ORDERED_TYPES,
    arity: 'pair',
    toSql: (col, v) => {
      const [lo, hi] = v as readonly [Scalar, Scalar];
      return sql`${col} between ${lo} and ${hi}`;
    },
    evaluate: (row, v, def) => {
      const [lo, hi] = v as readonly [Scalar, Scalar];
      const a = toKey(def, row);
      const l = toKey(def, lo);
      const h = toKey(def, hi);
      if (a === null || l === null || h === null) return null;
      return compareKeys(a, l) >= 0 && compareKeys(a, h) <= 0;
    },
    explain: ({ locale, field, value, format }) => {
      const [lo, hi] = Array.isArray(value) ? value : [value, value];
      return locale === 'es'
        ? `${field} está entre ${format(lo)} y ${format(hi)}`
        : `${field} is between ${format(lo)} and ${format(hi)}`;
    },
  },
  {
    name: 'contains',
    code: '~',
    types: ['string'],
    arity: 'scalar',
    toSql: (col, v) => sql`${col} ilike ${`%${escapeLike(String(v))}%`} escape '\\'`,
    evaluate: (row, v) => {
      if (row === null || row === undefined || v === null || v === undefined) return null;
      return String(row).toLowerCase().includes(String(v).toLowerCase());
    },
    explain: words({ en: '{field} contains {value}', es: '{field} contiene {value}' }),
  },
  {
    name: 'startsWith',
    code: '^',
    types: ['string'],
    arity: 'scalar',
    toSql: (col, v) => sql`${col} ilike ${`${escapeLike(String(v))}%`} escape '\\'`,
    evaluate: (row, v) => {
      if (row === null || row === undefined || v === null || v === undefined) return null;
      return String(row).toLowerCase().startsWith(String(v).toLowerCase());
    },
    explain: words({ en: '{field} starts with {value}', es: '{field} empieza por {value}' }),
  },
  {
    name: 'isNull',
    code: '0',
    types: ALL_TYPES,
    arity: 'none',
    toSql: (col) => sql`${col} is null`,
    evaluate: (row) => row === null || row === undefined,
    explain: words({ en: '{field} is empty', es: '{field} está vacío' }),
  },
  {
    name: 'isNotNull',
    code: '!0',
    types: ALL_TYPES,
    arity: 'none',
    toSql: (col) => sql`${col} is not null`,
    evaluate: (row) => !(row === null || row === undefined),
    explain: words({ en: '{field} is not empty', es: '{field} no está vacío' }),
  },
  {
    name: 'has',
    code: 'has',
    types: ['array'],
    arity: 'scalar',
    toSql: (col, v) => sql`${v} = any(${col})`,
    evaluate: (row, v, def) => {
      if (row === null || row === undefined || v === null || v === undefined) return null;
      if (!Array.isArray(row)) return null;
      const item = itemDef(def);
      const key = toKey(item, v);
      return row.some((x) => toKey(item, x) === key);
    },
    explain: words({ en: '{field} has {value}', es: '{field} tiene {value}' }),
  },
  {
    name: 'matches',
    code: '@',
    types: ['json'],
    arity: 'json',
    toSql: (col, v) => {
      const { path, equals } = v as JsonPathMatch;
      const at = sql`(${col} #> ${pgTextArrayLiteral(path)}::text[])`;
      return equals === undefined
        ? sql`${at} is not null`
        : sql`${at} = ${JSON.stringify(equals)}::jsonb`;
    },
    evaluate: (row, v) => {
      const { path, equals } = v as JsonPathMatch;
      const at = row === null || row === undefined ? undefined : jsonAtPath(row, path);
      if (equals === undefined) return at !== undefined;
      if (at === undefined) return null;
      return jsonEquals(at, equals as Scalar);
    },
    explain: ({ locale, field, value, format }) => {
      const { path, equals } = value as JsonPathMatch;
      const where = `${field}.${path.join('.')}`;
      if (equals === undefined) {
        return locale === 'es' ? `${where} existe` : `${where} exists`;
      }
      return locale === 'es' ? `${where} es ${format(equals)}` : `${where} is ${format(equals)}`;
    },
  },
];

/** Operators allowed per field type, derived from the table. */
export function operatorsByType<Name extends string>(
  operators: Iterable<OperatorDefinition<Name>>,
): Readonly<Record<FieldType, readonly Name[]>> {
  const out: Record<FieldType, Name[]> = {
    string: [],
    number: [],
    integer: [],
    boolean: [],
    date: [],
    datetime: [],
    uuid: [],
    enum: [],
    array: [],
    json: [],
  };
  for (const op of operators) {
    for (const t of op.types) out[t].push(op.name);
  }
  return out;
}

export const OPERATORS_BY_TYPE = operatorsByType(BUILTIN_OPERATORS);
