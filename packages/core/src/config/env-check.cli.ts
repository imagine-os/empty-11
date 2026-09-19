#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkEnvExample, formatEnvCheckTable } from './env-check.js';
import { findRepoRoot } from './env-source.node.js';

const root = findRepoRoot();
if (!root) {
  console.error('env:check: could not find the repo root (no pnpm-workspace.yaml above cwd)');
  process.exit(2);
}

const path = join(root, '.env.example');
let contents: string;
try {
  contents = readFileSync(path, 'utf8');
} catch {
  console.error(`env:check: could not read ${path}`);
  process.exit(2);
}

const result = checkEnvExample(contents);
console.log(formatEnvCheckTable(result));
if (result.extra.length > 0) {
  console.log(
    `\n(${result.extra.length} key(s) in .env.example that no schema declares: ${result.extra.join(', ')})`,
  );
}
process.exit(result.ok ? 0 : 1);
