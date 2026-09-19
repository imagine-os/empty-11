#!/usr/bin/env node
// Discovers every compose-smoke candidate under `ops/compose/**` and
// `spikes/oss-products/*`, reads each one's `smoke.json`, and prints (or
// writes to $GITHUB_OUTPUT) the `fromJson()` matrix for the `smoke` job in
// ../../.github/workflows/compose-smoke.yml.
//
// Usage:
//   node discover.mjs [--root <repoRoot>] [--dispatch-path <composePath>] [--github-output <file>]
//
// A compose file with no `smoke.json` beside it is skipped (not an error —
// see README.md "Discovery rules"). A `smoke.json` with `skipCi` set is
// reported but excluded from the matrix.

import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSmokeConfig } from './lib/smoke-config.mjs';

const COMPOSE_FILENAMES = ['compose.yaml', 'compose.yml'];

/**
 * Recursively lists every compose file under `dir` (used for `ops/compose/**`).
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
function findComposeFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findComposeFilesRecursive(full));
    } else if (entry.isFile() && COMPOSE_FILENAMES.includes(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Lists compose files directly inside each immediate child of `dir` (used for
 * `spikes/oss-products/*`, one level, not recursive into the product folder).
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
function findComposeFilesOneLevel(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const productDir = join(dir, entry.name);
    for (const filename of COMPOSE_FILENAMES) {
      const candidate = join(productDir, filename);
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        found.push(candidate);
        break;
      }
    }
  }
  return found;
}

/**
 * Finds `smoke.json` next to a compose file.
 * @param {string} composeAbsPath
 * @returns {string|null}
 */
function findSmokeConfigPath(composeAbsPath) {
  const candidate = join(dirname(composeAbsPath), 'smoke.json');
  return existsSync(candidate) ? candidate : null;
}

/**
 * @param {string} repoRoot
 * @returns {{ entries: import('./lib/smoke-config.mjs').SmokeConfig[] & any[], skipped: {path: string, reason: string}[] }}
 */
export function discoverEntries(repoRoot) {
  const composeFiles = [
    ...findComposeFilesRecursive(join(repoRoot, 'ops', 'compose')),
    ...findComposeFilesOneLevel(join(repoRoot, 'spikes', 'oss-products')),
  ];

  const entries = [];
  const skipped = [];

  for (const composeAbsPath of composeFiles.sort()) {
    const composePath = relative(repoRoot, composeAbsPath).split('\\').join('/');
    const name = relative(repoRoot, dirname(composeAbsPath)).split('/').filter(Boolean).join('-');

    const smokeAbsPath = findSmokeConfigPath(composeAbsPath);
    if (!smokeAbsPath) {
      skipped.push({ path: composePath, reason: 'missing smoke.json' });
      continue;
    }

    const smokePath = relative(repoRoot, smokeAbsPath).split('\\').join('/');
    const parsed = parseSmokeConfig(readFileSync(smokeAbsPath, 'utf8'));
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path || '(root)'}: ${i.message}`)
        .join('; ');
      skipped.push({ path: composePath, reason: `invalid smoke.json (${smokePath}): ${detail}` });
      continue;
    }

    if (parsed.data.skipCi) {
      skipped.push({ path: composePath, reason: `skipCi: ${parsed.data.skipCi}` });
      continue;
    }

    entries.push({
      name,
      composePath,
      smokePath,
      healthcheck: parsed.data.healthcheck,
      warmupSeconds: parsed.data.warmupSeconds,
      load: parsed.data.load ?? '',
      ramBudgetMb: parsed.data.ramBudgetMb,
    });
  }

  return { entries, skipped };
}

function main() {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let dispatchPath = '';
  let githubOutput = '';

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root') root = args[++i];
    else if (args[i] === '--dispatch-path') dispatchPath = args[++i] ?? '';
    else if (args[i] === '--github-output') githubOutput = args[++i] ?? '';
  }

  const { entries, skipped } = discoverEntries(root);

  let matrixEntries = entries;
  if (dispatchPath.trim() !== '') {
    matrixEntries = entries.filter((e) => e.composePath === dispatchPath.trim());
    if (matrixEntries.length === 0) {
      console.error(
        `[discover] --dispatch-path ${dispatchPath} matched no discovered, non-skipped entry.`,
      );
      console.error(
        '[discover] Discovered entries:',
        entries.map((e) => e.composePath).join(', ') || '(none)',
      );
    }
  }

  for (const s of skipped) {
    console.log(`[discover] skip ${s.path}: ${s.reason}`);
  }
  console.log(
    `[discover] ${matrixEntries.length} matrix entr${matrixEntries.length === 1 ? 'y' : 'ies'}: ${matrixEntries.map((e) => e.name).join(', ') || '(none)'}`,
  );

  const matrixJson = JSON.stringify({ include: matrixEntries });
  const hasEntries = matrixEntries.length > 0 ? 'true' : 'false';

  if (githubOutput) {
    appendFileSync(githubOutput, `matrix=${matrixJson}\n`);
    appendFileSync(githubOutput, `has-entries=${hasEntries}\n`);
  } else {
    console.log(matrixJson);
    console.log(`has-entries=${hasEntries}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
