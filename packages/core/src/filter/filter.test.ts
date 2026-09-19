import { sql } from 'drizzle-orm';
import { integer, jsonb, PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  and,
  condition,
  createFilterGrammar,
  decodeFilter,
  defineFields,
  encodeFilter,
  evaluate,
  evaluateThreeValued,
  explain,
  FilterError,
  FilterValidationError,
  FilterVariableError,
  filterTreeJsonSchema,
  filterTreeSchema,
  MAX_CONDITIONS,
  MAX_DEPTH,
  migrateFilter,
  normalize,
  not,
  OPERATORS,
  OPERATORS_BY_TYPE,
  or,
  parseFilter,
  toSql,
  validateFilter,
} from './index.js';
import type { FilterTree, Group } from './schema.js';

const fields = defineFields({
  name: { type: 'string', label: 'Name' },
  email: { type: 'string', caseInsensitive: true },
  amount: { type: 'number' },
  count: { type: 'integer' },
  active: { type: 'boolean' },
  due: { type: 'date' },
  createdAt: { type: 'datetime', column: 'created_at' },
  ownerId: { type: 'uuid', column: 'owner_id' },
  status: { type: 'enum', values: ['open', 'closed'] },
  tags: { type: 'array', items: 'string' },
  meta: { type: 'json' },
});
const ctx = { fields };
const dialect = new PgDialect();
const render = (tree: FilterTree, table: Parameters<typeof toSql>[1] = 'things') =>
  dialect.sqlToQuery(toSql(tree, table, ctx));

function nest(depth: number): FilterTree {
  let node: Group | { field: string; operator: 'isNull' } = { field: 'name', operator: 'isNull' };
  for (let i = 0; i < depth; i += 1) node = { op: 'and', children: [node] };
  return node as FilterTree;
}

describe('filterTreeSchema', () => {
  it('accepts a condition, a group and a versioned root', () => {
    expect(filterTreeSchema.safeParse({ field: 'a', operator: 'eq', value: 1 }).success).toBe(true);
    expect(
      filterTreeSchema.safeParse({
        v: 1,
        op: 'or',
        children: [
          { field: 'a', operator: 'isNull' },
          { op: 'not', children: [] },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects unknown operators, extra keys and other versions', () => {
    expect(filterTreeSchema.safeParse({ field: 'a', operator: 'like', value: 1 }).success).toBe(
      false,
    );
    expect(filterTreeSchema.safeParse({ field: 'a', operator: 'eq', value: 1, x: 1 }).success).toBe(
      false,
    );
    expect(filterTreeSchema.safeParse({ v: 2, field: 'a', operator: 'eq', value: 1 }).success).toBe(
      false,
    );
    expect(filterTreeSchema.safeParse({ op: 'xor', children: [] }).success).toBe(false);
  });

  it(`allows ${MAX_DEPTH} nested groups and names the path of the ninth`, () => {
    expect(filterTreeSchema.safeParse(nest(MAX_DEPTH)).success).toBe(true);
    const result = filterTreeSchema.safeParse(nest(MAX_DEPTH + 1));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.message).toContain(`maximum is ${MAX_DEPTH}`);
      expect(issue?.path.join('.')).toBe(Array(MAX_DEPTH).fill('children.0').join('.'));
    }
  });

  it(`allows ${MAX_CONDITIONS} conditions and rejects one more at the root`, () => {
    const many = (n: number): FilterTree => ({
      op: 'and',
      children: Array.from({ length: n }, () => ({ field: 'a', operator: 'isNull' as const })),
    });
    expect(filterTreeSchema.safeParse(many(MAX_CONDITIONS)).success).toBe(true);
    const result = filterTreeSchema.safeParse(many(MAX_CONDITIONS + 1));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([]);
      expect(result.error.issues[0]?.message).toContain('201 conditions');
    }
  });

  it('generates a JSON Schema with the recursion as a $ref', () => {
    const json = JSON.stringify(filterTreeJsonSchema());
    expect(json).toContain('"$ref"');
    expect(json).toContain('"startsWith"');
  });
});

describe('validateFilter', () => {
  it('suggests close field names', () => {
    const result = validateFilter({ field: 'amont', operator: 'gt', value: 1 }, fields);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({
      path: '',
      suggestions: ['amount'],
    });
    expect(result.issues[0]?.message).toContain('did you mean "amount"');
  });

  it('rejects an operator the field type does not allow, naming the allowed ones', () => {
    const result = validateFilter(
      and(
        { field: 'name', operator: 'gt', value: 'x' },
        { field: 'meta', operator: 'eq', value: 1 },
      ),
      fields,
    );
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toEqual(['children.0', 'children.1']);
    expect(result.issues[0]?.message).toContain(
      'allowed: eq, neq, in, nin, contains, startsWith, isNull, isNotNull',
    );
    expect(result.issues[1]?.message).toContain('not allowed on json field');
  });

  it('rejects matches on a non-json field and non-json values on json fields', () => {
    expect(
      validateFilter({ field: 'name', operator: 'matches', value: { path: ['a'] } }, fields).ok,
    ).toBe(false);
    expect(
      validateFilter({ field: 'meta', operator: 'matches', value: 'a.b' }, fields).issues[0]
        ?.message,
    ).toContain('{ path: string[], equals? }');
  });

  it('checks values per type: enum members, integers, dates, uuids, pairs, lists', () => {
    const bad = (tree: unknown) => validateFilter(tree, fields).issues[0]?.message;
    expect(bad({ field: 'status', operator: 'eq', value: 'gone' })).toContain('"open", "closed"');
    expect(bad({ field: 'count', operator: 'eq', value: 1.5 })).toContain('integer');
    expect(bad({ field: 'due', operator: 'lt', value: '2024-1-1' })).toContain('YYYY-MM-DD');
    expect(bad({ field: 'ownerId', operator: 'eq', value: 'nope' })).toContain('UUID');
    expect(bad({ field: 'amount', operator: 'between', value: [1] })).toContain('[low, high]');
    expect(bad({ field: 'amount', operator: 'in', value: [1, 'x'] })).toContain('list item 1');
    expect(bad({ field: 'name', operator: 'eq', value: null })).toContain('use isNull');
    expect(bad({ field: 'name', operator: 'isNull', value: 1 })).toContain('takes no value');
    expect(bad({ field: 'tags', operator: 'has', value: 1 })).toContain('expected a string');
  });

  it('accepts variables anywhere a value goes and an empty in list', () => {
    expect(validateFilter({ field: 'amount', operator: 'in', value: [] }, fields).ok).toBe(true);
    expect(
      validateFilter(
        and(
          { field: 'ownerId', operator: 'eq', value: { $var: 'principal.id' } },
          { field: 'status', operator: 'in', value: { $var: 'allowed' } },
          {
            field: 'meta',
            operator: 'matches',
            value: { path: ['owner'], equals: { $var: 'principal.id' } },
          },
        ),
        fields,
      ).ok,
    ).toBe(true);
  });

  it('parseFilter throws a FilterValidationError that names the first path', () => {
    expect(() => parseFilter(or({ field: 'nope', operator: 'isNull' }), fields)).toThrow(
      FilterValidationError,
    );
    expect(() => parseFilter(or({ field: 'nope', operator: 'isNull' }), fields)).toThrow(
      /filter at children\.0: unknown field "nope"/,
    );
  });
});

describe('toSql', () => {
  it('compiles against a table name with quoted identifiers and column mapping', () => {
    const query = render(
      and(
        { field: 'createdAt', operator: 'gte', value: '2024-01-01T00:00:00Z' },
        or(
          { field: 'status', operator: 'in', value: ['open', 'closed'] },
          { field: 'tags', operator: 'has', value: 'vip' },
        ),
        not({ field: 'meta', operator: 'matches', value: { path: ['a', 'b'], equals: 3 } }),
      ),
    );
    expect(query.sql).toBe(
      '("things"."created_at" >= $1 and ("things"."status" in ($2, $3) or $4 = any("things"."tags")) and not (("things"."meta" #> $5::text[]) = $6::jsonb))',
    );
    expect(query.params).toEqual([
      '2024-01-01T00:00:00Z',
      'open',
      'closed',
      'vip',
      '{"a","b"}',
      '3',
    ]);
  });

  it('compiles against a Drizzle table and a column map', () => {
    const things = pgTable('things', {
      name: text('name'),
      amount: integer('amount'),
      meta: jsonb('meta'),
      createdAt: text('created_at'),
    });
    expect(render({ field: 'name', operator: 'contains', value: 'a_b%' }, things).sql).toBe(
      `"things"."name" ilike $1 escape '\\'`,
    );
    expect(render({ field: 'name', operator: 'contains', value: 'a_b%' }, things).params).toEqual([
      '%a\\_b\\%%',
    ]);
    expect(render({ field: 'createdAt', operator: 'isNull' }, things).sql).toBe(
      '"things"."created_at" is null',
    );
    expect(
      render({ field: 'amount', operator: 'lt', value: 1 }, { amount: sql`coalesce(t.amount, 0)` })
        .sql,
    ).toBe('coalesce(t.amount, 0) < $1');
    expect(() => toSql({ field: 'active', operator: 'eq', value: true }, things, ctx)).toThrow(
      FilterError,
    );
    expect(() => toSql({ field: 'active', operator: 'eq', value: true }, things, ctx)).toThrow(
      /column "active"/,
    );
  });

  it('uses lower() for case-insensitive fields, TRUE/FALSE for empty groups and lists', () => {
    expect(render({ field: 'email', operator: 'eq', value: 'A@B.C' }).sql).toBe(
      'lower("things"."email") = lower($1)',
    );
    expect(render({ field: 'email', operator: 'nin', value: ['x'] }).sql).toBe(
      'lower("things"."email") not in (lower($1))',
    );
    expect(render({ field: 'amount', operator: 'in', value: [] }).sql).toBe('false');
    expect(render({ field: 'amount', operator: 'nin', value: [] }).sql).toBe('true');
    expect(render(and()).sql).toBe('true');
    expect(render(or()).sql).toBe('false');
    expect(render(not()).sql).toBe('not (true)');
    expect(render({ field: 'amount', operator: 'between', value: [1, 2] }).sql).toBe(
      '"things"."amount" between $1 and $2',
    );
  });

  it('resolves variables into parameters and refuses to default them', () => {
    const tree: FilterTree = { field: 'ownerId', operator: 'eq', value: { $var: 'principal.id' } };
    const id = '018f6b1e-0000-7000-8000-000000000001';
    expect(
      dialect.sqlToQuery(toSql(tree, 'things', { fields, variables: { principal: { id } } }))
        .params,
    ).toEqual([id]);
    expect(() => toSql(tree, 'things', ctx)).toThrow(FilterVariableError);
    expect(() => toSql(tree, 'things', { fields, variables: { principal: {} } })).toThrow(
      /is not defined/,
    );
    expect(() =>
      toSql(tree, 'things', { fields, variables: { principal: { id: 'nope' } } }),
    ).toThrow(/expected a UUID/);
  });
});

describe('evaluate', () => {
  const row = {
    name: 'Ada Lovelace',
    email: 'ADA@example.com',
    amount: 12.5,
    count: 3,
    active: true,
    due: '2024-06-01',
    created_at: '2024-01-15T10:00:00.000Z',
    owner_id: '018F6B1E-0000-7000-8000-000000000001',
    status: 'open',
    tags: ['vip', 'beta'],
    meta: { a: { b: [1, 2, { c: null }] }, n: 1.5 },
  };
  const t = (tree: FilterTree, r: Record<string, unknown> = row) =>
    evaluateThreeValued(tree, r, ctx);

  it('matches per operator with the row keyed by column', () => {
    expect(t({ field: 'name', operator: 'contains', value: 'LOVE' })).toBe(true);
    expect(t({ field: 'name', operator: 'startsWith', value: 'ada' })).toBe(true);
    expect(t({ field: 'name', operator: 'eq', value: 'ada lovelace' })).toBe(false);
    expect(t({ field: 'email', operator: 'eq', value: 'ada@EXAMPLE.com' })).toBe(true);
    expect(t({ field: 'amount', operator: 'between', value: [10, 12.5] })).toBe(true);
    expect(t({ field: 'count', operator: 'in', value: [1, 2] })).toBe(false);
    expect(t({ field: 'due', operator: 'lt', value: '2024-07-01' })).toBe(true);
    expect(t({ field: 'createdAt', operator: 'gte', value: '2024-01-15T10:00:00Z' })).toBe(true);
    expect(
      t({ field: 'ownerId', operator: 'eq', value: '018f6b1e-0000-7000-8000-000000000001' }),
    ).toBe(true);
    expect(t({ field: 'status', operator: 'nin', value: ['closed'] })).toBe(true);
    expect(t({ field: 'tags', operator: 'has', value: 'beta' })).toBe(true);
    expect(t({ field: 'meta', operator: 'matches', value: { path: ['a', 'b', '-1', 'c'] } })).toBe(
      true,
    );
    expect(
      t({
        field: 'meta',
        operator: 'matches',
        value: { path: ['a', 'b', '-1', 'c'], equals: null },
      }),
    ).toBe(true);
    expect(
      t({ field: 'meta', operator: 'matches', value: { path: ['a', 'b', '1'], equals: 2 } }),
    ).toBe(true);
    expect(t({ field: 'meta', operator: 'matches', value: { path: ['a', 'b'], equals: 2 } })).toBe(
      false,
    );
    expect(t({ field: 'meta', operator: 'matches', value: { path: ['n'], equals: 1.5 } })).toBe(
      true,
    );
  });

  it('follows SQL three-valued logic on NULL', () => {
    const nulls = { name: null, amount: undefined, tags: null, meta: null };
    expect(t({ field: 'name', operator: 'eq', value: 'x' }, nulls)).toBeNull();
    expect(t({ field: 'name', operator: 'neq', value: 'x' }, nulls)).toBeNull();
    expect(t({ field: 'name', operator: 'contains', value: '' }, nulls)).toBeNull();
    expect(t({ field: 'amount', operator: 'in', value: [1] }, nulls)).toBeNull();
    expect(t({ field: 'amount', operator: 'in', value: [] }, nulls)).toBe(false);
    expect(t({ field: 'amount', operator: 'nin', value: [] }, nulls)).toBe(true);
    expect(t({ field: 'tags', operator: 'has', value: 'x' }, nulls)).toBeNull();
    expect(t({ field: 'meta', operator: 'matches', value: { path: ['a'] } }, nulls)).toBe(false);
    expect(
      t({ field: 'meta', operator: 'matches', value: { path: ['a'], equals: 1 } }, nulls),
    ).toBeNull();
    expect(t({ field: 'name', operator: 'isNull' }, nulls)).toBe(true);
    expect(t({ field: 'amount', operator: 'isNotNull' }, nulls)).toBe(false);
    const unknown: FilterTree = { field: 'name', operator: 'eq', value: 'x' };
    expect(t(not(unknown), nulls)).toBeNull();
    expect(t(and(unknown, { field: 'name', operator: 'isNull' }), nulls)).toBeNull();
    expect(t(and(unknown, { field: 'name', operator: 'isNotNull' }), nulls)).toBe(false);
    expect(t(or(unknown, { field: 'name', operator: 'isNull' }), nulls)).toBe(true);
    expect(t(or(unknown, { field: 'name', operator: 'isNotNull' }), nulls)).toBeNull();
    expect(evaluate(unknown, nulls, ctx)).toBe(false);
  });

  it('resolves variables, treats null variables as SQL NULL and throws on unresolved ones', () => {
    const tree: FilterTree = { field: 'ownerId', operator: 'eq', value: { $var: 'principal.id' } };
    expect(
      evaluate(tree, row, {
        fields,
        variables: { principal: { id: '018f6b1e-0000-7000-8000-000000000001' } },
      }),
    ).toBe(true);
    expect(
      evaluateThreeValued(tree, row, { fields, variables: { principal: { id: null } } }),
    ).toBeNull();
    expect(() => evaluate(tree, row, { fields, variables: {} })).toThrow(FilterVariableError);
    expect(() =>
      evaluate({ field: 'status', operator: 'in', value: { $var: 'list' } }, row, {
        fields,
        variables: { list: ['open', null] },
      }),
    ).toThrow(/list item 1/);
  });
});

describe('normalize', () => {
  const messy: FilterTree = {
    op: 'and',
    children: [
      {
        op: 'and',
        children: [{ field: 'status', operator: 'in', value: ['open', 'closed', 'open'] }],
      },
      { op: 'and', children: [] },
      {
        op: 'not',
        children: [{ op: 'not', children: [{ field: 'active', operator: 'eq', value: true }] }],
      },
      { field: 'amount', operator: 'gt', value: 1 },
      { field: 'amount', operator: 'gt', value: 1 },
      { op: 'or', children: [{ field: 'name', operator: 'isNull', value: undefined }] },
    ],
  };

  it('flattens, de-duplicates, sorts, collapses and versions', () => {
    expect(normalize(messy)).toEqual({
      v: 1,
      op: 'and',
      children: [
        { field: 'active', operator: 'eq', value: true },
        { field: 'amount', operator: 'gt', value: 1 },
        { field: 'name', operator: 'isNull' },
        { field: 'status', operator: 'in', value: ['closed', 'open'] },
      ],
    });
    expect(normalize(and(and(and())))).toEqual({ v: 1, op: 'and', children: [] });
    expect(normalize(not(not({ field: 'a', operator: 'isNull' })))).toEqual({
      v: 1,
      field: 'a',
      operator: 'isNull',
    });
  });

  it('is idempotent and keeps the meaning', () => {
    const once = normalize(messy);
    expect(normalize(once)).toEqual(once);
    const row = { status: 'open', active: true, amount: 2, name: null };
    expect(evaluateThreeValued(once, row, ctx)).toBe(evaluateThreeValued(messy, row, ctx));
  });
});

describe('explain', () => {
  const tree: FilterTree = and(
    or(
      { field: 'status', operator: 'in', value: ['open', 'closed'] },
      { field: 'amount', operator: 'gt', value: 10 },
    ),
    { field: 'name', operator: 'contains', value: 'ada' },
    not({ field: 'ownerId', operator: 'eq', value: { $var: 'principal.id' } }),
    { field: 'due', operator: 'between', value: ['2024-01-01', '2024-12-31'] },
    { field: 'meta', operator: 'matches', value: { path: ['a', 'b'], equals: true } },
    { field: 'tags', operator: 'isNull' },
  );

  it('reads as one English line with labels from the field schema', () => {
    expect(explain(tree, { fields })).toBe(
      '(status is one of "open", "closed" or amount is greater than 10) and Name contains "ada" and not ownerId is $principal.id and due is between "2024-01-01" and "2024-12-31" and meta.a.b is true and tags is empty',
    );
    expect(explain(and())).toBe('everything');
    expect(explain(or())).toBe('nothing');
    expect(explain(not(or()))).toBe('not nothing');
  });

  it('speaks Spanish and takes label overrides', () => {
    expect(explain(tree, { locale: 'es', labels: { name: 'Nombre', amount: 'Importe' } })).toBe(
      '(status es uno de "open", "closed" o Importe es mayor que 10) y Nombre contiene "ada" y no ownerId es $principal.id y due está entre "2024-01-01" y "2024-12-31" y meta.a.b es verdadero y tags está vacío',
    );
  });
});

describe('encodeFilter / decodeFilter', () => {
  const tree: FilterTree = and(
    or(
      { field: 'status', operator: 'in', value: ['open'] },
      { field: 'name', operator: 'startsWith', value: 'A' },
    ),
    not({ field: 'meta', operator: 'matches', value: { path: ['a'], equals: { $var: 'x' } } }),
    { field: 'amount', operator: 'isNotNull' },
  );

  it('round-trips through a URL-safe string with a version prefix', () => {
    const encoded = encodeFilter(tree);
    expect(encoded).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(JSON.stringify(tree).length);
    expect(decodeFilter(encoded)).toEqual({ v: 1, ...tree });
    expect(decodeFilter(encoded, fields)).toEqual({ v: 1, ...tree });
    expect(decodeFilter(encodeFilter({ v: 1, field: 'a', operator: 'isNull' }))).toEqual({
      v: 1,
      field: 'a',
      operator: 'isNull',
    });
  });

  it('rejects tampered, unversioned and unknown-version strings', () => {
    expect(() => decodeFilter('nonsense')).toThrow(FilterError);
    expect(() => decodeFilter('1.!!!')).toThrow(/base64url|look like/);
    expect(() => decodeFilter('9.e30')).toThrow(/version 9 is newer/);
    expect(() =>
      decodeFilter(`1.${Buffer.from('["&",["a","like",1]]').toString('base64url')}`),
    ).toThrow(FilterValidationError);
    expect(() => decodeFilter(encodeFilter({ field: 'nope', operator: 'isNull' }), fields)).toThrow(
      /unknown field "nope"/,
    );
  });

  it('migrateFilter accepts v1 and refuses the future', () => {
    expect(migrateFilter({ field: 'a', operator: 'isNull' })).toEqual({
      v: 1,
      field: 'a',
      operator: 'isNull',
    });
    expect(() => migrateFilter({ v: 2, field: 'a', operator: 'isNull' })).toThrow(
      /upgrade @paperos\/core/,
    );
    expect(() => migrateFilter({ v: 0, field: 'a', operator: 'isNull' })).toThrow(
      /positive integer/,
    );
  });
});

describe('createFilterGrammar (extension hook)', () => {
  const grammar = createFilterGrammar({
    operators: [
      {
        name: 'withinDays',
        code: 'wd',
        types: ['datetime'],
        arity: 'scalar',
        valueDef: { type: 'integer' },
        toSql: (col, v) => sql`${col} >= now() - make_interval(days => ${v})`,
        evaluate: (row, v) =>
          row == null ? null : Date.parse(String(row)) >= Date.now() - Number(v) * 86_400_000,
        explain: ({ field, value, format }) => `${field} is within the last ${format(value)} days`,
      },
    ],
  });

  it('accepts the new operator in schema, SQL, evaluation, wording and encoding', () => {
    const tree = { field: 'createdAt', operator: 'withinDays', value: 7 } as const;
    expect(grammar.validate(tree, fields).ok).toBe(true);
    expect(filterTreeSchema.safeParse(tree).success).toBe(false);
    expect(grammar.operatorsByType.datetime).toContain('withinDays');
    expect(dialect.sqlToQuery(grammar.toSql(tree, 'things', ctx)).sql).toBe(
      '"things"."created_at" >= now() - make_interval(days => $1)',
    );
    expect(grammar.evaluate(tree, { created_at: new Date().toISOString() }, ctx)).toBe(true);
    expect(grammar.explain(tree)).toBe('createdAt is within the last 7 days');
    expect(grammar.decodeFilter(grammar.encodeFilter(tree))).toEqual({ v: 1, ...tree });
  });

  it('refuses duplicate names and codes', () => {
    const dup = {
      name: 'eq',
      types: ['string'],
      arity: 'scalar',
      toSql: () => sql``,
      evaluate: () => null,
      explain: () => '',
    } as const;
    expect(() => createFilterGrammar({ operators: [dup] })).toThrow(/defined twice/);
    expect(() =>
      createFilterGrammar({ operators: [{ ...dup, name: 'other', code: '=' }] }),
    ).toThrow(/used twice/);
  });
});

describe('operator table', () => {
  it('covers every operator for at least one type and keeps the documented table', () => {
    for (const op of OPERATORS) {
      expect(Object.values(OPERATORS_BY_TYPE).some((ops) => ops.includes(op))).toBe(true);
    }
    expect(OPERATORS_BY_TYPE.array).toEqual(['isNull', 'isNotNull', 'has']);
    expect(OPERATORS_BY_TYPE.json).toEqual(['isNull', 'isNotNull', 'matches']);
    expect(OPERATORS_BY_TYPE.boolean).toEqual(['eq', 'neq', 'in', 'nin', 'isNull', 'isNotNull']);
  });

  it('condition() builds a plain condition', () => {
    expect(condition(fields, 'amount', 'gt', 1)).toEqual({
      field: 'amount',
      operator: 'gt',
      value: 1,
    });
    expect(condition(fields, 'tags', 'isNull')).toEqual({ field: 'tags', operator: 'isNull' });
  });
});
