/**
 * Repo-root resolution and `ownership.json` loading (PAP-305).
 *
 * Kept out of `@paperos/core`: core is pure TypeScript with no `node:*`
 * imports, so every read of the boundary map happens here.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Ownership, parseOwnership } from '@paperos/core';

/** Absolute path of the monorepo root (the directory holding `pnpm-workspace.yaml`). */
export function findRepoRoot(from: string = dirname(fileURLToPath(import.meta.url))): string {
  let current = resolve(from);
  for (let depth = 0; depth < 12; depth += 1) {
    try {
      readFileSync(join(current, 'pnpm-workspace.yaml'), 'utf8');
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error(`no pnpm-workspace.yaml above ${from}: cannot find the repo root`);
}

/** Path of the boundary map. */
export function ownershipPath(repoRoot: string = findRepoRoot()): string {
  return join(repoRoot, 'ownership.json');
}

/**
 * Read and validate `ownership.json`. Throws with every validation error listed,
 * one per line, so `pnpm lint:deps` shows the whole list in one run.
 */
export function loadOwnership(repoRoot: string = findRepoRoot()): Ownership {
  const file = ownershipPath(repoRoot);
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const result = parseOwnership(parsed);
  if (!result.ok) {
    const lines = result.errors.map((error) => `  ${error.path || '<root>'}: ${error.message}`);
    throw new Error(
      `ownership.json is invalid (${result.errors.length} problems):\n${lines.join('\n')}`,
    );
  }
  return result.value;
}
