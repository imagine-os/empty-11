#!/usr/bin/env node
/**
 * PAP-305 — writes `.dependency-cruiser.cjs` from `ownership.json`.
 *
 *   node packages/boundaries/scripts/gen-deps-rules.ts           # write
 *   node packages/boundaries/scripts/gen-deps-rules.ts --check   # exit 1 if stale
 *
 * Paths resolve from the repo root, not from cwd.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BIOME_BOUNDARIES_FILE, findStaleGeneratedFiles } from '../src/check.js';
import { formatWithBiome } from '../src/format.js';
import { findRepoRoot, loadOwnership } from '../src/repo.js';
import { generateBiomeBoundaries, generateRuleSet, renderConfigFile } from '../src/rules.js';

const repoRoot = findRepoRoot();

if (process.argv.includes('--check')) {
  const stale = findStaleGeneratedFiles(repoRoot).filter(
    (entry) => !entry.file.startsWith('docs/platform/dependency-map'),
  );
  for (const entry of stale) process.stderr.write(`${entry.file} is stale: ${entry.reason}\n`);
  if (stale.length > 0) {
    process.stderr.write('run `pnpm gen:deps-rules` and commit\n');
    process.exit(1);
  }
  process.stdout.write('.dependency-cruiser.cjs is up to date\n');
} else {
  const ownership = loadOwnership(repoRoot);
  writeFileSync(
    join(repoRoot, '.dependency-cruiser.cjs'),
    renderConfigFile(generateRuleSet(ownership)),
    'utf8',
  );
  const presetFile = join(repoRoot, BIOME_BOUNDARIES_FILE);
  const preset = JSON.parse(readFileSync(presetFile, 'utf8')) as Record<string, unknown>;
  preset.overrides = generateBiomeBoundaries(ownership).overrides;
  writeFileSync(presetFile, `${JSON.stringify(preset, null, 2)}\n`, 'utf8');
  formatWithBiome(repoRoot, ['.dependency-cruiser.cjs', BIOME_BOUNDARIES_FILE]);
  process.stdout.write(
    `wrote .dependency-cruiser.cjs and the overrides of ${BIOME_BOUNDARIES_FILE}\n`,
  );
}
