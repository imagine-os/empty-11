#!/usr/bin/env node
/**
 * PAP-162 views parity report.
 *
 * Source of truth: ./checklist.json. This script validates every row, regenerates the two
 * CSVs under docs/research/ and prints coverage per product and per category.
 *
 * Usage:
 *   node packages/views/src/parity/parity-report.mjs            validate + print coverage
 *   node packages/views/src/parity/parity-report.mjs --emit     also rewrite the CSVs
 *   node packages/views/src/parity/parity-report.mjs --selftest run the built-in fixtures
 *
 * Exit code 1 on any validation error, so Gate 1 (PAP-78) can run it as a docs check.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const CHECKLIST = resolve(HERE, 'checklist.json');
const IDS = resolve(HERE, 'linear-ids.json');
const CSV_ROWS = resolve(REPO, 'docs/research/views-parity-checklist.csv');
const CSV_FUNCS = resolve(REPO, 'docs/research/views-parity-formula-functions.csv');

const PRODUCTS = ['airtable', 'notion', 'clickup', 'baserow', 'nocodb'];
const CELLS = ['yes', 'partial', 'no', 'paid'];
const STATUSES = ['planned', 'in_progress', 'done', 'wontdo'];
const TIERS = ['P0', 'P1', 'P2'];
const ROW_COLUMNS = [
  'id',
  'category',
  'feature',
  ...PRODUCTS,
  'paperos_issue',
  'paperos_status',
  'tier',
  'notes',
  'source',
];
const FUNC_COLUMNS = [
  'name',
  'airtable_name',
  'notion_name',
  'category',
  'signature',
  'tier',
  'paperos_status',
];
const MIN_ROWS = 250;
const MAX_ROWS = 400;
const MIN_CATEGORIES = 25;
const MIN_FUNCTIONS = 80;
const ISSUE_RE = /^PAP-\d+$/;

/** Validate one checklist document. Returns an array of human-readable errors. */
export function validate(doc, allowlist) {
  const errors = [];
  const seen = new Set();
  const categories = new Set((doc.categories ?? []).map((c) => c.key));
  const sources = doc.sources ?? {};
  const known = new Set(allowlist.identifiers ?? []);

  for (const row of doc.rows ?? []) {
    const at = row.id ? `row ${row.id}` : `row "${row.feature ?? '?'}"`;
    for (const column of ROW_COLUMNS) {
      if (row[column] === undefined || row[column] === null || row[column] === '') {
        errors.push(`${at}: missing column "${column}"`);
      }
    }
    if (seen.has(row.id)) errors.push(`${at}: duplicate id`);
    seen.add(row.id);
    if (!categories.has(row.category)) errors.push(`${at}: unknown category "${row.category}"`);
    for (const product of PRODUCTS) {
      if (!CELLS.includes(row[product])) {
        errors.push(`${at}: ${product} cell "${row[product]}" is not one of ${CELLS.join('|')}`);
      }
    }
    if (!STATUSES.includes(row.paperos_status)) {
      errors.push(`${at}: status "${row.paperos_status}" is not one of ${STATUSES.join('|')}`);
    }
    if (!TIERS.includes(row.tier))
      errors.push(`${at}: tier "${row.tier}" is not one of ${TIERS.join('|')}`);
    if (row.paperos_issue !== 'gap') {
      if (!ISSUE_RE.test(row.paperos_issue ?? '')) {
        errors.push(
          `${at}: paperos_issue "${row.paperos_issue}" is neither a PAP identifier nor "gap"`,
        );
      } else if (known.size > 0 && !known.has(row.paperos_issue)) {
        errors.push(`${at}: unknown Linear identifier "${row.paperos_issue}"`);
      }
    } else if (
      row.paperos_status !== 'wontdo' &&
      !(doc.gaps ?? []).some((g) => g.paperos_issue === 'gap')
    ) {
      errors.push(`${at}: paperos_issue "gap" needs an entry in gaps[]`);
    }
    const source = sources[row.source];
    if (!source) errors.push(`${at}: unknown source key "${row.source}"`);
    else if (!source.url || !source.accessed)
      errors.push(`${at}: source "${row.source}" lacks a url or access date`);
  }

  for (const fn of doc.formulaFunctions ?? []) {
    for (const column of FUNC_COLUMNS) {
      if (fn[column] === undefined || fn[column] === '')
        errors.push(`function ${fn.name}: missing "${column}"`);
    }
    if (!STATUSES.includes(fn.paperos_status)) errors.push(`function ${fn.name}: bad status`);
  }

  const rowCount = (doc.rows ?? []).length;
  if (rowCount < MIN_ROWS)
    errors.push(`only ${rowCount} rows; the spec asks for at least ${MIN_ROWS}`);
  if (rowCount > MAX_ROWS)
    errors.push(`${rowCount} rows; the spec caps the checklist at ${MAX_ROWS}`);
  if (categories.size < MIN_CATEGORIES)
    errors.push(`only ${categories.size} categories; at least ${MIN_CATEGORIES} required`);
  if ((doc.formulaFunctions ?? []).length < MIN_FUNCTIONS) {
    errors.push(
      `only ${(doc.formulaFunctions ?? []).length} formula functions; at least ${MIN_FUNCTIONS} required`,
    );
  }

  const referenced = new Set([
    ...(doc.rows ?? []).map((r) => r.paperos_issue),
    ...(doc.gaps ?? []).map((g) => g.paperos_issue),
  ]);
  const missing = (allowlist.tablesProject ?? []).filter((id) => !referenced.has(id));
  if (missing.length > 0) errors.push(`tables issues referenced by no row: ${missing.join(', ')}`);

  return errors;
}

/** Coverage maths: how many rows each product and each category covers. */
export function coverage(rows) {
  const byProduct = Object.fromEntries(
    PRODUCTS.map((p) => [p, { yes: 0, paid: 0, partial: 0, no: 0 }]),
  );
  const byCategory = new Map();
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byTier = Object.fromEntries(TIERS.map((t) => [t, 0]));
  let gaps = 0;
  for (const row of rows) {
    for (const product of PRODUCTS) byProduct[product][row[product]] += 1;
    const cat = byCategory.get(row.category) ?? { rows: 0, gaps: 0, wontdo: 0 };
    cat.rows += 1;
    if (row.paperos_issue === 'gap') cat.gaps += 1;
    if (row.paperos_status === 'wontdo') cat.wontdo += 1;
    byCategory.set(row.category, cat);
    byStatus[row.paperos_status] += 1;
    byTier[row.tier] += 1;
    if (row.paperos_issue === 'gap') gaps += 1;
  }
  return { total: rows.length, byProduct, byCategory, byStatus, byTier, gaps };
}

const pct = (n, total) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (columns, records) =>
  `${[columns.join(','), ...records.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join(
    '\n',
  )}\n`;

function emitCsv(doc) {
  const rows = doc.rows.map((row) => ({
    ...row,
    source: `${doc.sources[row.source].url} (accessed ${doc.sources[row.source].accessed})`,
  }));
  writeFileSync(CSV_ROWS, csv(ROW_COLUMNS, rows), 'utf8');
  writeFileSync(CSV_FUNCS, csv(FUNC_COLUMNS, doc.formulaFunctions), 'utf8');
  return [CSV_ROWS, CSV_FUNCS];
}

function report(doc) {
  const c = coverage(doc.rows);
  const lines = [];
  lines.push(
    `PaperOS views parity — ${c.total} rows, ${doc.categories.length} categories, ${doc.formulaFunctions.length} formula functions`,
  );
  lines.push('');
  lines.push('Coverage per product (share of checklist rows the product ships)');
  lines.push('product     yes    paid   partial no     ships%');
  for (const product of PRODUCTS) {
    const p = c.byProduct[product];
    const ships = p.yes + p.paid + p.partial;
    lines.push(
      `${product.padEnd(11)} ${String(p.yes).padEnd(6)} ${String(p.paid).padEnd(6)} ` +
        `${String(p.partial).padEnd(7)} ${String(p.no).padEnd(6)} ${pct(ships, c.total)}%`,
    );
  }
  lines.push('');
  lines.push('Coverage per category (rows / owned by a PAP issue / gap / wontdo)');
  for (const [category, v] of [...c.byCategory].sort((a, b) => a[0].localeCompare(b[0]))) {
    const owned = v.rows - v.gaps;
    lines.push(
      `${category.padEnd(30)} ${String(v.rows).padStart(3)}  owned ${String(owned).padStart(3)} (${pct(owned, v.rows)}%)  gap ${v.gaps}  wontdo ${v.wontdo}`,
    );
  }
  lines.push('');
  lines.push(`PaperOS status: ${STATUSES.map((s) => `${s} ${c.byStatus[s]}`).join(', ')}`);
  lines.push(`Priority: ${TIERS.map((t) => `${t} ${c.byTier[t]}`).join(', ')}`);
  lines.push(
    `Rows owned by a PAP issue: ${c.total - c.gaps}/${c.total} (${pct(c.total - c.gaps, c.total)}%); open gaps listed: ${doc.gaps.length}`,
  );
  return lines.join('\n');
}

function selftest() {
  const allowlist = { identifiers: ['PAP-161'], tablesProject: ['PAP-161'] };
  const source = { title: 't', url: 'https://example.test', accessed: '2026-09-19' };
  const good = (over) => ({
    id: 'X-001',
    category: 'view-types',
    feature: 'f',
    airtable: 'yes',
    notion: 'no',
    clickup: 'paid',
    baserow: 'partial',
    nocodb: 'yes',
    paperos_issue: 'PAP-161',
    paperos_status: 'planned',
    tier: 'P0',
    notes: 'n',
    source: 'S',
    ...over,
  });
  const doc = (rows) => ({
    categories: [{ key: 'view-types' }],
    sources: { S: source },
    gaps: [],
    rows,
    formulaFunctions: [],
  });
  const cases = [
    ['bad status rejected', doc([good({ paperos_status: 'maybe' })]), /status "maybe"/],
    [
      'unknown identifier rejected',
      doc([good({ paperos_issue: 'PAP-99999' })]),
      /unknown Linear identifier/,
    ],
    ['missing source rejected', doc([good({ source: 'NOPE' })]), /unknown source key/],
    ['bad product cell rejected', doc([good({ airtable: 'sortof' })]), /airtable cell/],
    ['duplicate id rejected', doc([good(), good()]), /duplicate id/],
  ];
  const failures = [];
  for (const [name, document, pattern] of cases) {
    const errors = validate(document, allowlist);
    if (!errors.some((e) => pattern.test(e)))
      failures.push(`${name}: expected ${pattern}, got ${JSON.stringify(errors)}`);
  }
  const ten = Array.from({ length: 10 }, (_, i) =>
    good({
      id: `X-${i}`,
      airtable: i < 4 ? 'yes' : 'no',
      paperos_issue: i < 8 ? 'PAP-161' : 'gap',
    }),
  );
  const c = coverage(ten);
  if (c.total !== 10) failures.push(`coverage total ${c.total} != 10`);
  if (c.byProduct.airtable.yes !== 4)
    failures.push(`airtable yes ${c.byProduct.airtable.yes} != 4`);
  if (c.gaps !== 2) failures.push(`gaps ${c.gaps} != 2`);
  if (pct(4, 10) !== '40.0') failures.push('pct maths wrong');
  if (failures.length > 0) {
    console.error(`selftest FAILED\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`selftest ok (${cases.length} rejection cases + coverage maths on a 10-row fixture)`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    selftest();
    return;
  }
  const doc = JSON.parse(readFileSync(CHECKLIST, 'utf8'));
  const allowlist = JSON.parse(readFileSync(IDS, 'utf8'));
  const errors = validate(doc, allowlist);
  if (errors.length > 0) {
    console.error(
      `parity checklist invalid (${errors.length} error${errors.length === 1 ? '' : 's'}):`,
    );
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  if (args.includes('--emit')) {
    for (const file of emitCsv(doc)) console.log(`wrote ${file}`);
  }
  console.log(report(doc));
}

main();
