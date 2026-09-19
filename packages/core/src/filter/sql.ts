/**
 * `toSql`: compiles a `FilterTree` to a Drizzle `SQL` fragment for a `WHERE` clause.
 * Pure: needs the Drizzle `sql` helper only, never a connection (Contracts §1).
 */
import { type Column, getTableColumns, is, type SQL, sql, Table } from 'drizzle-orm';
import { FilterError, joinPath } from './errors.js';
import {
  type FieldDef,
  type FieldSchema,
  type FilterContext,
  type FilterNode,
  type FilterTree,
  isGroup,
} from './schema.js';
import { type GrammarInternals, parseWith, resolveConditionValue } from './validate.js';

/**
 * Where columns come from: a Drizzle table (columns by key), a table name (columns are
 * quoted identifiers `"table"."column"`), or an explicit map of field key → column / SQL.
 */
export type ColumnSource = Table | string | Readonly<Record<string, Column | SQL>>;

export interface ToSqlOptions {
  /** Skip `FieldSchema` validation when the tree was already parsed with `parseFilter`. Default `false`. */
  readonly validated?: boolean | undefined;
}

type ColumnResolver = (field: string, def: FieldDef, path: string) => SQL;

function columnResolver(table: ColumnSource): ColumnResolver {
  if (typeof table === 'string') {
    const name = sql.identifier(table);
    return (field, def) => sql`${name}.${sql.identifier(def.column ?? field)}`;
  }
  const columns: Record<string, Column | SQL | undefined> = is(table, Table)
    ? { ...getTableColumns(table) }
    : { ...table };
  if (is(table, Table)) {
    // A Drizzle table resolves by property key first, then by database column name.
    for (const column of Object.values(getTableColumns(table))) {
      if (!(column.name in columns)) columns[column.name] = column;
    }
  }
  return (field, def, path) => {
    const key = def.column ?? field;
    const column = columns[key];
    if (column === undefined) {
      throw new FilterError(
        'FILTER_UNKNOWN_COLUMN',
        `filter at ${path || 'root'}: field "${field}" maps to column "${key}", which the table does not have`,
      );
    }
    return column as SQL;
  };
}

export function toSqlWith<Op extends string>(
  internals: GrammarInternals<Op>,
  tree: FilterTree<Op>,
  table: ColumnSource,
  ctx: FilterContext,
  options: ToSqlOptions = {},
): SQL {
  const root = options.validated ? tree : parseWith(internals, tree, ctx.fields);
  const column = columnResolver(table);
  const fields: FieldSchema = ctx.fields;

  const compile = (node: FilterNode<Op>, path: (string | number)[]): SQL => {
    if (isGroup(node)) {
      const children = node.children.map((child, i) => compile(child, [...path, 'children', i]));
      if (node.op === 'not') {
        return sql`not (${joinAnd(children)})`;
      }
      if (children.length === 0) return node.op === 'and' ? sql`true` : sql`false`;
      if (children.length === 1) return children[0] as SQL;
      return sql`(${sql.join(children, node.op === 'and' ? sql` and ` : sql` or `)})`;
    }
    const at = joinPath(path);
    // Both lookups are guaranteed by `parseWith` (or by the caller's earlier parse).
    const def = fields[node.field] as FieldDef;
    const op = internals.operators.get(node.operator);
    if (op === undefined)
      throw new FilterError('FILTER_INVALID', `unknown operator "${node.operator}"`);
    const value = resolveConditionValue(node, op, def, ctx.variables, at);
    return op.toSql(column(node.field, def, at), value, def);
  };

  return compile(root, []);
}

function joinAnd(children: readonly SQL[]): SQL {
  if (children.length === 0) return sql`true`;
  if (children.length === 1) return children[0] as SQL;
  return sql.join([...children], sql` and `);
}
