#!/usr/bin/env node
// Ad-hoc / CI validator CLI for either config or result JSON files.
//
// Usage:
//   node validate.mjs --type smoke  ops/compose/example-postgres/smoke.json
//   node validate.mjs --type result compose-smoke/example-postgres.json

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseResult } from './lib/result-schema.mjs';
import { parseSmokeConfig } from './lib/smoke-config.mjs';

function main() {
  const args = process.argv.slice(2);
  let type = 'smoke';
  const files = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--type') type = args[++i];
    else files.push(args[i]);
  }

  if (files.length === 0) {
    console.error('usage: validate.mjs --type <smoke|result> <file...>');
    process.exit(2);
  }

  const parseFn = type === 'result' ? parseResult : parseSmokeConfig;
  let ok = true;
  for (const file of files) {
    const parsed = parseFn(readFileSync(file, 'utf8'));
    if (parsed.success) {
      console.log(`[validate] ${file}: ok`);
    } else {
      ok = false;
      console.error(`[validate] ${file}: invalid`);
      for (const i of parsed.error.issues) console.error(`  ${i.path || '(root)'}: ${i.message}`);
    }
  }
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
