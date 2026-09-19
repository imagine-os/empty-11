/**
 * Property test: for random trees and rows, `toSql` on PGlite selects exactly the rows
 * `evaluate` accepts. 500 trees × 48 rows (a quarter of every column NULL, one all-NULL
 * row), every operator on every field type, variables included. Also checks that
 * `normalize` keeps the three-valued result and that `encodeFilter` round-trips.
 */
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  decodeFilter,
  defineFields,
  encodeFilter,
  evaluate,
  evaluateThreeValued,
  type FilterNode,
  type FilterTree,
  normalize,
  OPERATORS_BY_TYPE,
  type Operator,
  type Scalar,
  toSql,
} from './index.js';

const things = pgTable('things', {
  id: integer('id').primaryKey(),
  s: text('s'),
  cs: text('cs'),
  n: doublePrecision('n'),
  i: integer('i'),
  b: boolean('b'),
  d: date('d', { mode: 'string' }),
  ts: timestamp('ts', { withTimezone: true, mode: 'string' }),
  u: uuid('u'),
  e: text('e'),
  tags: text('tags').array(),
  j: jsonb('j'),
});

const fields = defineFields({
  s: { type: 'string' },
  cs: { type: 'string', caseInsensitive: true },
  n: { type: 'number' },
  i: { type: 'integer' },
  b: { type: 'boolean' },
  d: { type: 'date' },
  ts: { type: 'datetime' },
  u: { type: 'uuid' },
  e: { type: 'enum', values: ['a', 'b', 'c'] },
  tags: { type: 'array', items: 'string' },
  j: { type: 'json' },
});
type FieldName = keyof typeof fields;

const UUIDS = [
  '018f6b1e-0000-7000-8000-000000000001',
  '018f6b1e-0000-7000-8000-000000000002',
  '018f6b1e-0000-7000-8000-000000000003',
];

/** Literal pools per field: rows and conditions draw from the same pools so matches are frequent. */
const pools = {
  s: ['', 'a', 'A', 'ab', 'Ab', 'a%b', 'a_b', 'a\\b', 'hello world', 'Hello', 'x'],
  cs: ['a', 'A', 'ab', 'AB', 'Ab', 'hello', 'HELLO'],
  n: [-2.5, -1, 0, 0.5, 1, 2, 3.25, 10],
  i: [-3, -2, -1, 0, 1, 2, 3],
  b: [true, false],
  d: ['2024-01-01', '2024-06-15', '2025-01-01'],
  ts: ['2024-01-01T00:00:00.000Z', '2024-06-15T12:30:00.000Z', '2025-01-01T23:59:59.000Z'],
  u: UUIDS,
  e: ['a', 'b', 'c'],
  tags: ['x', 'y', 'z', 'w'],
} satisfies Record<Exclude<FieldName, 'j'>, readonly Scalar[]>;

const jsonPool = fc.oneof(
  fc.record({ a: fc.constantFrom<unknown>(1, 'x', true, null, 0.5, [1, 2], { b: 2 }) }),
  fc.record({ a: fc.record({ b: fc.constantFrom<unknown>(1, 2, 'x', null) }) }),
  fc.record({
    a: fc.array(fc.constantFrom<unknown>(1, 2, 'x', null, { c: true }), { maxLength: 3 }),
  }),
  fc.constant({ '0': 5 }),
  fc.constant([1, 2, 'x']),
  fc.constant('str'),
  fc.constant(7),
);

const variables = {
  principal: { id: UUIDS[0], name: 'Ab', email: 'HELLO' },
  limits: { n: 1, i: 2, d: '2024-06-15', ts: '2024-06-15T12:30:00.000Z' },
  lists: { e: ['a', 'b'], i: [1, 2, 3], s: ['a', 'x'] },
  pair: { n: [0, 2], d: ['2024-01-01', '2024-06-15'] },
  nil: null,
  tag: 'y',
  flag: true,
  jsonEq: 1,
};

/** Variables whose resolved value fits a field, per arity. */
const varsFor: Record<string, Record<FieldName, string[]>> = {
  scalar: {
    s: ['principal.name', 'nil'],
    cs: ['principal.email', 'principal.name', 'nil'],
    n: ['limits.n', 'nil'],
    i: ['limits.i', 'nil'],
    b: ['flag', 'nil'],
    d: ['limits.d', 'nil'],
    ts: ['limits.ts', 'nil'],
    u: ['principal.id', 'nil'],
    e: [],
    tags: ['tag', 'nil'],
    j: [],
  },
  list: {
    s: ['lists.s'],
    cs: [],
    n: [],
    i: ['lists.i'],
    b: [],
    d: [],
    ts: [],
    u: [],
    e: ['lists.e'],
    tags: [],
    j: [],
  },
  pair: {
    s: [],
    cs: [],
    n: ['pair.n'],
    i: [],
    b: [],
    d: ['pair.d'],
    ts: [],
    u: [],
    e: [],
    tags: [],
    j: [],
  },
};

function nullable<T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T | null> {
  return fc.option(arb, { nil: null, freq: 4 });
}

const rowArb = fc.record({
  s: nullable(fc.constantFrom(...pools.s)),
  cs: nullable(fc.constantFrom(...pools.cs)),
  n: nullable(fc.constantFrom(...pools.n)),
  i: nullable(fc.constantFrom(...pools.i)),
  b: nullable(fc.constantFrom(...pools.b)),
  d: nullable(fc.constantFrom(...pools.d)),
  ts: nullable(fc.constantFrom(...pools.ts)),
  u: nullable(fc.constantFrom(...pools.u)),
  e: nullable(fc.constantFrom(...pools.e)),
  tags: nullable(fc.subarray([...pools.tags])),
  j: nullable(jsonPool),
});
type RowShape = ReturnType<typeof rowArb.generate>['value'] & { id: number };

const jsonMatchArb = fc.record(
  {
    path: fc.constantFrom(
      ['a'],
      ['a', 'b'],
      ['a', '0'],
      ['a', '-1'],
      ['0'],
      ['a', 'b', 'c'],
      ['1'],
    ),
    equals: fc.constantFrom<Scalar | { $var: string }>(1, 'x', true, null, 0.5, 2, {
      $var: 'jsonEq',
    }),
  },
  { requiredKeys: ['path'] },
);

function valueArb(field: FieldName, operator: Operator): fc.Arbitrary<unknown> {
  const pool: readonly Scalar[] = field === 'j' ? [null] : pools[field];
  const literal = fc.constantFrom(...pool);
  const withVar = (arity: string, base: fc.Arbitrary<unknown>): fc.Arbitrary<unknown> => {
    const names = varsFor[arity]?.[field] ?? [];
    return names.length === 0
      ? base
      : fc.oneof(
          { weight: 3, arbitrary: base },
          { weight: 1, arbitrary: fc.constantFrom(...names).map(($var) => ({ $var })) },
        );
  };
  switch (operator) {
    case 'isNull':
    case 'isNotNull':
      return fc.constant(undefined);
    case 'in':
    case 'nin':
      return withVar('list', fc.subarray([...pool], { maxLength: Math.min(3, pool.length) }));
    case 'between':
      return withVar('pair', fc.tuple(literal, literal));
    case 'matches':
      return jsonMatchArb;
    default:
      return withVar('scalar', literal);
  }
}

const conditionArb: fc.Arbitrary<FilterNode> = fc
  .constantFrom(...(Object.keys(fields) as FieldName[]))
  .chain((field) =>
    fc
      .constantFrom(...OPERATORS_BY_TYPE[fields[field].type])
      .chain((operator) =>
        valueArb(field, operator).map((value) =>
          value === undefined ? { field, operator } : ({ field, operator, value } as FilterNode),
        ),
      ),
  );

const { tree: treeArb } = fc.letrec<{ tree: FilterNode; group: FilterNode }>((tie) => ({
  group: fc
    .tuple(fc.constantFrom('and', 'or', 'not'), fc.array(tie('tree'), { maxLength: 3 }))
    .map(([op, children]) => ({ op, children }) as FilterNode),
  tree: fc.oneof(
    { depthSize: 'small', maxDepth: 4 },
    { weight: 3, arbitrary: conditionArb },
    { weight: 1, arbitrary: tie('group') },
  ),
}));

describe('toSql on PGlite ≡ evaluate in memory', () => {
  const client = new PGlite();
  const db = drizzle(client);
  const ctx = { fields, variables };
  let rows: RowShape[] = [];

  beforeAll(async () => {
    await db.execute(sql`create table things (
      id integer primary key, s text, cs text, n double precision, i integer, b boolean,
      d date, ts timestamptz, u uuid, e text, tags text[], j jsonb)`);
    // JSON round-trip: fast-check records may carry a null prototype, which Drizzle rejects.
    const sampled = JSON.parse(
      JSON.stringify(fc.sample(rowArb, { numRuns: 47, seed: 279 })),
    ) as ReturnType<typeof rowArb.generate>['value'][];
    rows = [
      ...sampled,
      {
        s: null,
        cs: null,
        n: null,
        i: null,
        b: null,
        d: null,
        ts: null,
        u: null,
        e: null,
        tags: null,
        j: null,
      },
    ].map((r, id) => ({ ...r, id }));
    await db.insert(things).values(rows);
    // PGlite (WASM Postgres) startup can race and stall under heavy parallel load (observed:
    // one failure across 29-35 concurrent turbo tasks, passed on rerun). Generous headroom here
    // matches the 120 s budget on the property test below rather than a tight bound tuned for an
    // idle box.
  }, 120_000);

  afterAll(async () => {
    await client.close();
  });

  it('agrees on 500 random trees, nulls included', async () => {
    let checked = 0;
    await fc.assert(
      fc.asyncProperty(treeArb, async (tree) => {
        const expected = rows.filter((row) => evaluate(tree, row, ctx)).map((row) => row.id);
        const result = await db.execute<{ id: number }>(
          sql`select id from things where ${toSql(tree, things, ctx)} order by id`,
        );
        const actual = result.rows.map((row) => row.id);
        expect(actual, `SQL and evaluate disagree on ${JSON.stringify(tree)}`).toEqual(expected);
        checked += 1;
      }),
      { numRuns: 500, seed: 2790, endOnFailure: true },
    );
    expect(checked).toBe(500);
  }, 120_000);

  it('normalize keeps the three-valued result and is idempotent; encode round-trips', () => {
    fc.assert(
      fc.property(treeArb, (tree) => {
        const once = normalize(tree);
        expect(normalize(once)).toEqual(once);
        for (const row of rows.slice(0, 12)) {
          expect(evaluateThreeValued(once, row, ctx)).toBe(evaluateThreeValued(tree, row, ctx));
        }
        expect(decodeFilter(encodeFilter(tree), fields)).toEqual(
          JSON.parse(JSON.stringify({ v: 1, ...(tree as FilterTree) })),
        );
      }),
      { numRuns: 300, seed: 2791 },
    );
  });
});
