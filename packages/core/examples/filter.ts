/**
 * Demo of `@paperos/core/filter` (PAP-279): a tree, its SQL, its explanation in English
 * and Spanish, its URL form and an in-memory evaluation. No database is touched.
 *
 *   pnpm --filter @paperos/core example:filter      (or, from packages/core: pnpm tsx examples/filter.ts)
 *
 * Inside the package the import is relative; consumers write `from '@paperos/core/filter'`.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  and,
  defineFields,
  encodeFilter,
  evaluate,
  evaluateThreeValued,
  explain,
  type FilterTree,
  normalize,
  not,
  or,
  toSql,
} from '../src/filter/index.js';

const fields = defineFields({
  name: { type: 'string', label: 'Name' },
  email: { type: 'string', caseInsensitive: true, label: 'Email' },
  amount: { type: 'number', column: 'amount_minor', label: 'Amount' },
  status: { type: 'enum', values: ['open', 'paid', 'void'], label: 'Status' },
  ownerId: { type: 'uuid', column: 'owner_id', label: 'Owner' },
  dueOn: { type: 'date', column: 'due_on', label: 'Due' },
  tags: { type: 'array', items: 'string', label: 'Tags' },
  meta: { type: 'json', label: 'Metadata' },
});

const tree: FilterTree = and(
  or(
    { field: 'status', operator: 'in', value: ['open', 'paid'] },
    { field: 'amount', operator: 'gt', value: 10_000 },
  ),
  { field: 'name', operator: 'contains', value: 'acme' },
  { field: 'ownerId', operator: 'eq', value: { $var: 'principal.id' } },
  not({ field: 'tags', operator: 'has', value: 'archived' }),
  { field: 'meta', operator: 'matches', value: { path: ['billing', 'plan'], equals: 'pro' } },
);

const variables = { principal: { id: '018f6b1e-7c3a-7000-8000-000000000001' } };
const ctx = { fields, variables };

const query = new PgDialect().sqlToQuery(toSql(tree, 'invoices', ctx));

console.log('Tree (normalized):');
console.log(JSON.stringify(normalize(tree), null, 2));
console.log('\nSQL:');
console.log(`  where ${query.sql}`);
console.log(`  params ${JSON.stringify(query.params)}`);
console.log('\nExplanation (en):');
console.log(`  ${explain(tree, { fields })}`);
console.log('\nExplicación (es):');
console.log(`  ${explain(tree, { fields, locale: 'es' })}`);
console.log('\nURL form:');
console.log(`  ?filter=${encodeFilter(tree)}`);

const rows = [
  {
    name: 'ACME Corp',
    email: 'billing@acme.test',
    amount_minor: 4_999,
    status: 'open',
    owner_id: variables.principal.id,
    due_on: '2026-10-01',
    tags: ['vip'],
    meta: { billing: { plan: 'pro' } },
  },
  {
    name: 'Acme Two',
    email: null,
    amount_minor: null,
    status: null,
    owner_id: variables.principal.id,
    due_on: null,
    tags: null,
    meta: { billing: { plan: 'pro' } },
  },
];
console.log('\nIn memory:');
for (const row of rows) {
  const three = evaluateThreeValued(tree, row, ctx);
  console.log(
    `  ${row.name.padEnd(10)} → ${String(evaluate(tree, row, ctx)).padEnd(5)} (three-valued: ${three === null ? 'unknown' : three})`,
  );
}
