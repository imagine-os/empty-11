/**
 * The extension hook (PAP-161: "view-specific operators are contributed through that
 * package's extension hook, not forked"). `createFilterGrammar({ operators })` returns a
 * grammar whose schema, validators, evaluators, wording and encoding know the extra
 * operators. The default grammar is the built-in table.
 */
import type { SQL } from 'drizzle-orm';
import { decodeWith, encodeWith, migrateWith, operatorCodes } from './encode.js';
import { FilterError } from './errors.js';
import {
  type EvaluateOptions,
  evaluateThreeValuedWith,
  evaluateWith,
  type Row,
} from './evaluate.js';
import { type ExplainOptions, explainWith } from './explain.js';
import { BUILTIN_OPERATORS, type OperatorDefinition, operatorsByType } from './operators.js';
import {
  buildFilterSchemas,
  type FieldSchema,
  type FieldType,
  type FilterContext,
  type FilterSchemas,
  type FilterTree,
  OPERATORS,
  type Operator,
} from './schema.js';
import { type ColumnSource, type ToSqlOptions, toSqlWith } from './sql.js';
import {
  type GrammarInternals,
  parseWith,
  type ValidationResult,
  validateWith,
} from './validate.js';

export interface FilterGrammar<Op extends string> extends GrammarInternals<Op> {
  readonly schemas: FilterSchemas<Op>;
  readonly operators: ReadonlyMap<string, OperatorDefinition>;
  readonly operatorsByType: Readonly<Record<FieldType, readonly Op[]>>;
  validate(input: unknown, fields: FieldSchema): ValidationResult<Op>;
  parse(input: unknown, fields: FieldSchema): FilterTree<Op>;
  toSql(tree: FilterTree<Op>, table: ColumnSource, ctx: FilterContext, options?: ToSqlOptions): SQL;
  evaluate(tree: FilterTree<Op>, row: Row, ctx: FilterContext, options?: EvaluateOptions): boolean;
  evaluateThreeValued(
    tree: FilterTree<Op>,
    row: Row,
    ctx: FilterContext,
    options?: EvaluateOptions,
  ): boolean | null;
  explain(tree: FilterTree<Op>, options?: ExplainOptions): string;
  encodeFilter(tree: FilterTree<Op>): string;
  decodeFilter(encoded: string, fields?: FieldSchema): FilterTree<Op>;
  migrateFilter(input: unknown): FilterTree<Op>;
}

export interface CreateFilterGrammarOptions<Ext extends string> {
  /** Extra operators. Names and codes must not collide with the built-ins. */
  readonly operators?: readonly OperatorDefinition<Ext>[] | undefined;
}

export function createFilterGrammar<Ext extends string = never>(
  options: CreateFilterGrammarOptions<Ext> = {},
): FilterGrammar<Operator | Ext> {
  type Op = Operator | Ext;
  const extra = options.operators ?? [];
  const all: OperatorDefinition<Op>[] = [...BUILTIN_OPERATORS, ...extra];
  const operators = new Map<string, OperatorDefinition>();
  for (const op of all) {
    if (operators.has(op.name)) {
      throw new FilterError('FILTER_INVALID', `operator "${op.name}" is defined twice`);
    }
    operators.set(op.name, op);
  }
  const names = all.map((op) => op.name) as [Op, ...Op[]];
  const schemas = buildFilterSchemas<Op>(names);
  const internals: GrammarInternals<Op> = { schemas, operators };
  const { toCode, fromCode } = operatorCodes(operators.values());

  return {
    schemas,
    operators,
    operatorsByType: operatorsByType(all),
    validate: (input, fields) => validateWith(internals, input, fields),
    parse: (input, fields) => parseWith(internals, input, fields),
    toSql: (tree, table, ctx, opts) => toSqlWith(internals, tree, table, ctx, opts),
    evaluate: (tree, row, ctx, opts) => evaluateWith(internals, tree, row, ctx, opts),
    evaluateThreeValued: (tree, row, ctx, opts) =>
      evaluateThreeValuedWith(internals, tree, row, ctx, opts),
    explain: (tree, opts) => explainWith(operators, tree, opts),
    encodeFilter: (tree) => encodeWith(toCode, tree),
    decodeFilter: (encoded, fields) => decodeWith(internals, fromCode, encoded, fields),
    migrateFilter: (input) => migrateWith(internals, input),
  };
}

/** The built-in grammar: `OPERATORS` only. The module-level functions delegate to it. */
export const defaultGrammar: FilterGrammar<Operator> = createFilterGrammar();

// Keep the operator list and the table in sync at module load.
for (const name of OPERATORS) {
  if (!defaultGrammar.operators.has(name)) {
    throw new FilterError('FILTER_INVALID', `operator "${name}" has no definition`);
  }
}
