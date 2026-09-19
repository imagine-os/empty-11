#!/usr/bin/env node
/**
 * `pnpm lint:deps` — the package boundary gate (PAP-305, ADR 0026).
 *
 * Three checks, in the order that gives the most useful first error:
 *
 * 1. `ownership.json` is valid (owners are project keys, kinds are known,
 *    `allowedDeps` targets exist and are acyclic).
 * 2. dependency-cruiser runs over `apps/` and `packages/` and prints every
 *    violation with its rule id, the offending import and the owner to ask.
 * 3. `.dependency-cruiser.cjs` and `docs/platform/dependency-map.*` are not
 *    stale — a boundary changed but the generated files were not committed.
 *
 * The cruise runs before the staleness check on purpose: a new import makes the
 * map stale *and* may break a boundary, and the boundary is the error worth
 * reading first.
 *
 * Gate 1 (PAP-78) runs exactly this command.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findStaleGeneratedFiles } from '../src/check.js';
import { findRepoRoot } from '../src/repo.js';

const repoRoot = findRepoRoot();

const binary = join(repoRoot, 'node_modules', '.bin', 'depcruise');
if (!existsSync(binary)) {
  process.stderr.write(`dependency-cruiser is not installed (${binary}); run \`pnpm i\`\n`);
  process.exit(1);
}

const cruise = spawnSync(
  binary,
  ['--config', '.dependency-cruiser.cjs', '--output-type', 'err-long', 'apps', 'packages'],
  { cwd: repoRoot, stdio: 'inherit' },
);

const stale = findStaleGeneratedFiles(repoRoot);
for (const entry of stale) {
  process.stderr.write(`stale generated file ${entry.file}: ${entry.reason}\n`);
  process.stderr.write(`  fix: ${entry.fix}\n`);
}

process.exit((cruise.status ?? 1) === 0 && stale.length === 0 ? 0 : 1);
