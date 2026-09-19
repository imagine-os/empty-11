import { getTableConfig, PgDialect, pgTable, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { actorRef, actorRefCheck, entityRef, money, snakeCase } from './_shared.js';

const invoice = pgTable(
  'invoice',
  {
    id: uuid('id').primaryKey(),
    ...money('amount'),
    ...actorRef('actor'),
    ...entityRef('subject'),
  },
  (table) => [actorRefCheck('actor', table)],
);

const config = getTableConfig(invoice);
const columns = new Map(config.columns.map((column) => [column.name, column]));
const shape = (name: string): { type: string; notNull: boolean } => {
  const column = columns.get(name);
  if (column === undefined)
    throw new Error(`no column ${name} in ${[...columns.keys()].join(', ')}`);
  return { type: column.getSQLType(), notNull: column.notNull };
};

describe('money()', () => {
  it('emits amount_minor bigint and currency char(3)', () => {
    expect(shape('amount_minor')).toEqual({ type: 'bigint', notNull: true });
    expect(shape('currency')).toEqual({ type: 'char(3)', notNull: true });
  });

  it('reads and writes the amount as a bigint, so nothing rounds at 2^53', () => {
    const column = columns.get('amount_minor');
    expect(column?.mapFromDriverValue('9007199254740993')).toBe(9007199254740993n);
    expect(column?.mapToDriverValue(9007199254740993n)).toBe(9007199254740993n);
  });

  it('takes a name and an explicit currency column for a two-currency row', () => {
    const conversion = pgTable('conversion', {
      ...money('source', { currency: 'sourceCurrency' }),
      ...money('target', { currency: 'targetCurrency' }),
    });
    expect(getTableConfig(conversion).columns.map((column) => column.name)).toEqual([
      'source_minor',
      'source_currency',
      'target_minor',
      'target_currency',
    ]);
  });
});

describe('actorRef()', () => {
  it('emits the id, the kind and the character', () => {
    expect(shape('actor_id')).toEqual({ type: 'uuid', notNull: false });
    expect(shape('actor_kind')).toEqual({ type: 'text', notNull: true });
    expect(shape('actor_character')).toEqual({ type: 'text', notNull: false });
  });

  it('constrains the nullable id to the anonymous actor', () => {
    const [constraint] = config.checks;
    expect(constraint?.name).toBe('actor_id_null_only_when_anonymous');
    const sql = new PgDialect().sqlToQuery(constraint?.value as never).sql;
    expect(sql).toBe(`("invoice"."actor_kind" = 'anonymous') = ("invoice"."actor_id" is null)`);
  });
});

describe('entityRef()', () => {
  it('emits the two columns every cross-entity pointer is stored as', () => {
    expect(shape('subject_type')).toEqual({ type: 'text', notNull: true });
    expect(shape('subject_id')).toEqual({ type: 'uuid', notNull: true });
  });

  it('defaults to subject', () => {
    expect(getTableConfig(pgTable('note', { ...entityRef() })).columns.map((c) => c.name)).toEqual([
      'subject_type',
      'subject_id',
    ]);
  });
});

describe('snakeCase', () => {
  it('keeps the TypeScript key and the SQL name in step', () => {
    expect(snakeCase('sourceCurrency')).toBe('source_currency');
    expect(snakeCase('amount')).toBe('amount');
  });
});
