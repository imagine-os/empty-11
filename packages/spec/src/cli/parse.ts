#!/usr/bin/env node
/**
 * Demo CLI: `pnpm --filter @paperos/spec parse <file>` prints every issue with
 * code, path, line:col and hint. PAP-115 ships the real `paperos-spec` CLI
 * (`validate`, `routes`, formats, baseline); this stays a one-file smoke tool.
 */
import { readFileSync } from 'node:fs';
import { parseSpec } from '../parse.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: pnpm --filter @paperos/spec parse <file.spec.yaml>');
  process.exit(2);
}

const result = parseSpec(readFileSync(file, 'utf8'), { filename: file });
for (const issue of result.issues) {
  const where = issue.line !== undefined ? `${file}:${issue.line}:${issue.col ?? 1}` : file;
  const related = issue.related?.map((r) => `line ${r.line}`).join(', ');
  console.log(
    `${issue.severity.padEnd(7)} ${issue.code.padEnd(24)} ${where}  ${issue.path || '<root>'}`,
  );
  console.log(`        ${issue.message}${related ? ` (also ${related})` : ''}`);
  if (issue.hint) console.log(`        hint: ${issue.hint}`);
}
if (result.ok) {
  console.log(
    `ok      ${file}  meta.id=${result.value.meta.id} status=${result.value.meta.status} (${result.issues.length} warning(s))`,
  );
  process.exit(0);
}
console.log(
  `failed  ${file}  ${result.error.length} error(s), ${result.issues.length - result.error.length} warning(s)`,
);
process.exit(1);
