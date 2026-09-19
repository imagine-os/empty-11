#!/usr/bin/env node
/**
 * PAP-305 — writes `docs/platform/dependency-map.json` and `.md` from
 * `ownership.json` plus the import graph of the working tree.
 *
 *   node packages/boundaries/scripts/gen-dep-map.ts           # write
 *   node packages/boundaries/scripts/gen-dep-map.ts --check   # exit 1 if stale
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findStaleGeneratedFiles } from '../src/check.js';
import { formatWithBiome } from '../src/format.js';
import { buildDependencyMap, renderDependencyMapMarkdown } from '../src/map.js';
import { findRepoRoot, loadOwnership } from '../src/repo.js';

const repoRoot = findRepoRoot();

if (process.argv.includes('--check')) {
  const stale = findStaleGeneratedFiles(repoRoot).filter((entry) =>
    entry.file.startsWith('docs/platform/dependency-map'),
  );
  for (const entry of stale) process.stderr.write(`${entry.file} is stale: ${entry.reason}\n`);
  if (stale.length > 0) {
    process.stderr.write('run `pnpm gen:dep-map` and commit both files\n');
    process.exit(1);
  }
  process.stdout.write('dependency map is up to date\n');
} else {
  const map = buildDependencyMap(repoRoot, loadOwnership(repoRoot));
  writeFileSync(
    join(repoRoot, 'docs/platform/dependency-map.json'),
    `${JSON.stringify(map, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    join(repoRoot, 'docs/platform/dependency-map.md'),
    renderDependencyMapMarkdown(map),
    'utf8',
  );
  formatWithBiome(repoRoot, ['docs/platform/dependency-map.json']);
  process.stdout.write('wrote docs/platform/dependency-map.json and .md\n');
}
