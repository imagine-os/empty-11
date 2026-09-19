# Filter and condition grammar (`@paperos/core/filter`)

Owner: Data Layer & Database (PAP-279, [ADR 0012](../adr/0012-filter-grammar.md)). Hand-written.

One `FilterTree` for every filter in PaperOS. Permissions `Condition` (PAP-59), the view
model `FilterGroup` (PAP-161), spec data queries (PAP-119), the tables compiler (PAP-163),
the filter builder (PAP-166), view links (PAP-172), automations (PAP-174), segments
(PAP-195) and list procedures (`filter?: FilterTree`, Contracts §4) import it; none
redefines it. Any operator or shape change is a new ADR.

```ts
import { toSql, evaluate, explain, parseFilter, defineFields } from '@paperos/core/filter';

const fields = defineFields({
  status: { type: 'enum', values: ['open', 'paid'] },
  amount: { type: 'number', column: 'amount_minor' },
  ownerId: { type: 'uuid', column: 'owner_id' },
});
const tree = parseFilter(input, fields);                        // FilterValidationError names the path
const where = toSql(tree, invoices, { fields, variables });     // Drizzle SQL fragment, no connection
const ok = evaluate(tree, row, { fields, variables });          // same answer in memory
```

Demo: `pnpm --filter @paperos/core example:filter`. Tests: `pnpm --filter @paperos/core test filter`.

## 1. Shape

```ts
type FilterTree = (Group | Condition) & { v?: 1 };
type Group     = { op: 'and' | 'or' | 'not'; children: FilterNode[] };
type Condition = { field: string; operator: Operator; value?: ConditionValue };
type ConditionValue = Scalar | Scalar[] | { $var: string } | { path: string[]; equals?: Scalar | { $var: string } };
type Scalar = string | number | boolean | null;
```

* `v: 1` is the grammar version. It may be omitted on input; `normalize`, `decodeFilter` and
  `migrateFilter` always emit it. A newer `v` is refused with `FILTER_VERSION`; older ones run
  through `MIGRATIONS` (empty today).
* `and []` is `true`, `or []` is `false`, `not [a, b]` is `not (a and b)`.
* Limits: 8 nested groups (the root counts), 200 conditions, 1000 values per list, 32 path
  segments. Every validation error carries the dotted path of the node (`children.0.children.2`).
* Schemas: `filterTreeSchema` (structure and limits), `conditionSchema`, `groupSchema`,
  `filterNodeSchema`, `fieldSchemaSchema`; `filterTreeJsonSchema()` generates the JSON Schema
  (Contracts §1: JSON Schema is generated, never hand-written).

## 2. Field schema

Both evaluators need a `FieldSchema` (`Record<field, FieldDef>`): it decides which operators a
field takes, how values are validated, which column a field reads, and the label `explain` uses.

| `type` | Postgres | Value in a condition | Notes |
| -- | -- | -- | -- |
| `string` | `text`, `varchar`, `citext` | string | `caseInsensitive: true` gives citext semantics: `eq`, `neq`, `in`, `nin` compare with `lower()`. |
| `number` | `double precision`, `numeric` | finite number | |
| `integer` | `integer`, `bigint` | integer | |
| `boolean` | `boolean` | boolean | |
| `date` | `date` | `YYYY-MM-DD` | Compared as calendar dates. |
| `datetime` | `timestamptz` | ISO-8601 string | Compared as instants; rows may hold `Date` or string. |
| `uuid` | `uuid` | UUID string | Case-insensitive, as in Postgres. |
| `enum` | `text` + `values` | one of `values` | Members validated at parse time. |
| `array` | `text[]`, `integer[]`, ... (`items`) | one item | Element type from `items`. |
| `json` | `jsonb` | `{ path, equals? }` | See `matches`. |

`column` maps a field to a Drizzle column key or database column name (`ownerId` → `owner_id`);
rows given to `evaluate` are keyed the same way. `defineFields({...})` keeps literal types so
`condition(fields, 'status', 'eq', 'open')` and `TypedCondition<typeof fields>` narrow `value`
per field and operator (`ValueFor`, `OperatorsFor`, `ScalarFor`).

## 3. Operators per field type

| Operator | string | number, integer | boolean | date, datetime | uuid, enum | array | json | Value | SQL | Meaning |
| -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| `eq` | ✓ | ✓ | ✓ | ✓ | ✓ | | | scalar | `col = $1` (`lower()` both sides when `caseInsensitive`) | equal |
| `neq` | ✓ | ✓ | ✓ | ✓ | ✓ | | | scalar | `col <> $1` | not equal; UNKNOWN on NULL |
| `in` | ✓ | ✓ | ✓ | ✓ | ✓ | | | list | `col in ($1, $2)`; empty list → `false` | member of the list |
| `nin` | ✓ | ✓ | ✓ | ✓ | ✓ | | | list | `col not in (...)`; empty list → `true` | not a member |
| `lt` `lte` `gt` `gte` | | ✓ | | ✓ | | | | scalar | `col < $1` etc. | ordering |
| `between` | | ✓ | | ✓ | | | | `[lo, hi]` | `col between $1 and $2` | inclusive; `lo > hi` is always false |
| `contains` | ✓ | | | | | | | string | `col ilike '%' || $1 || '%' escape '\'` | case-insensitive substring; `%`, `_`, `\` escaped |
| `startsWith` | ✓ | | | | | | | string | `col ilike $1 || '%' escape '\'` | case-insensitive prefix |
| `isNull` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | none | `col is null` | never UNKNOWN |
| `isNotNull` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | none | `col is not null` | never UNKNOWN |
| `has` | | | | | | ✓ | | one item | `$1 = any(col)` | array contains the item |
| `matches` | | | | | | | ✓ | `{ path, equals? }` | `(col #> '{a,b}') is not null` / `= $1::jsonb` | jsonb value at path exists / equals |

Case sensitivity, per type: `string` equality is exact unless the field says
`caseInsensitive: true` (then `lower()` on both sides, the citext contract); `contains` and
`startsWith` are always `ILIKE`; `uuid` is case-insensitive; `enum` is exact. Ordering is not
offered on strings: collation would make Postgres and JavaScript disagree.

`matches` paths follow Postgres `#>`: keys on objects, integer indexes on arrays (negative from
the end), and a scalar with a non-empty path is missing. `equals` compares jsonb scalars
(`1` equals `1.0`; a JSON `null` at the path equals `equals: null`; an object or array never
equals a scalar). Full SQL/JSON path (`@?`) and full-text search (PAP-39) are out of scope.

## 4. Null semantics (three-valued, both evaluators)

`evaluateThreeValued` returns `true`, `false` or `null` (UNKNOWN) exactly where Postgres does;
`evaluate` collapses UNKNOWN to `false`, like a `WHERE` clause. `undefined` and `null` in a row
are both SQL NULL.

| Situation | Result |
| -- | -- |
| `eq`, `neq`, `lt`..`between`, `contains`, `startsWith`, `has` on a NULL column | UNKNOWN |
| `in` on NULL with a non-empty list | UNKNOWN; empty list is `false` for every row |
| `nin` on NULL with a non-empty list | UNKNOWN; empty list is `true` for every row |
| `matches` without `equals` on NULL | `false` (it is an `IS NOT NULL`) |
| `matches` with `equals` on NULL or a missing path | UNKNOWN |
| `isNull` / `isNotNull` | always `true` or `false` |
| `not UNKNOWN` | UNKNOWN |
| `and`: any `false` → `false`; else any UNKNOWN → UNKNOWN; else `true` (`and []` is `true`) | |
| `or`: any `true` → `true`; else any UNKNOWN → UNKNOWN; else `false` (`or []` is `false`) | |

A literal `null` value is rejected at validation (`use isNull / isNotNull`). A variable that
resolves to `null` is allowed and behaves as SQL NULL.

## 5. Variables

`{ $var: 'principal.id' }` is resolved from `ctx.variables` by dotted path at evaluation time,
in `toSql` and `evaluate` alike (the SQL gets a bound parameter). An unresolved variable throws
`FilterVariableError` (`FILTER_VARIABLE_UNRESOLVED`); there is no default. A variable whose
value does not fit the operator and field (`in` with a non-list, a list containing `null`, a
non-UUID for a `uuid` field) throws `FILTER_VARIABLE_TYPE`. Variables are legal wherever a value
is: scalars, lists, `between` pairs and `matches.equals`. PAP-161's `{ ref: 'currentUser' }` and
relative dates are variables (`principal.id`, `now`), not operators.

## 6. Functions

| Export | Does |
| -- | -- |
| `validateFilter(input, fields)` | `{ ok, tree, issues }`. Structure, limits, unknown fields (with up to three suggestions), operator × type, value shape. |
| `parseFilter(input, fields)` | `validateFilter` that throws `FilterValidationError`. |
| `toSql(tree, table, ctx, { validated? })` | Drizzle `SQL` for a `WHERE`. `table`: Drizzle table (by key or column name), table name (`"t"."col"` identifiers) or `Record<key, Column \| SQL>`. Validates unless `validated: true`. |
| `evaluate(tree, row, ctx)` / `evaluateThreeValued` | In-memory, three-valued. Row keyed by column key. |
| `normalize(tree)` | Canonical form: `v: 1`, same-op groups flattened, identity children and duplicates dropped, single-child groups collapsed, `not not x` → `x`, children and `in` lists sorted. Idempotent, meaning preserved (property-tested). |
| `explain(tree, { locale?, fields?, labels? })` | One line in English (default) or Spanish; labels from the schema or the map. |
| `encodeFilter(tree)` / `decodeFilter(s, fields?)` | `1.<base64url>` of a compact array form (`["&", ["status", "in", ["open"]], ["!", ["tags", "has", "x"]]]`). Decoding validates; tampering is a `FilterError`. |
| `migrateFilter(input)` | Any known version → current, validated. |
| `createFilterGrammar({ operators })` | Extension hook: a grammar whose schema, validators, evaluators, wording and codes know extra operators (`OperatorDefinition`: `name`, `types`, `arity`, `code`, `valueDef`, `toSql`, `evaluate`, `explain`). The module-level functions are `defaultGrammar`. |
| `filterTreeJsonSchema()` | Generated JSON Schema of `filterTreeSchema`. |
| `and`, `or`, `not`, `condition`, `defineFields` | Builders. |

Performance: `toSql` on a 50-condition tree runs in about 0.4 ms including validation (budget 1 ms,
asserted by `filter.perf.test.ts`). Pass `validated: true` when the tree came from `parseFilter`
in the same request.

## 7. Errors

`FilterError` (`code`: `FILTER_INVALID`, `FILTER_UNKNOWN_FIELD`, `FILTER_UNKNOWN_COLUMN`,
`FILTER_VARIABLE_UNRESOLVED`, `FILTER_VARIABLE_TYPE`, `FILTER_ENCODING`, `FILTER_VERSION`),
`FilterValidationError` (`issues: { path, message, suggestions? }[]`, the shape of Contracts §4
`details`), `FilterVariableError` (`variable`, `path`).

## 8. Equivalence proof

`filter.property.test.ts` builds a PGlite database in-process, inserts 48 rows (a quarter of every
column NULL, one all-NULL row) and checks 500 fast-check trees: the ids `select ... where toSql(tree)`
returns equal the rows `evaluate` accepts. Every operator on every type, variables included; a
second property checks `normalize` and `encodeFilter`. Mutating either evaluator (case-sensitive
`contains`, `matches` treating JSON `null` as missing) fails the property within 40 cases.

## 9. Out of scope

UI (PAP-166), full-text operators (PAP-39), aggregation, SQL/JSON path queries, relative-date
operators (variables cover `now`; a view-specific operator goes through `createFilterGrammar`).
