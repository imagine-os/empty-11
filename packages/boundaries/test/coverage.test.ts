/**
 * Repo check: `ownership.json` covers every directory that exists today
 * (PAP-305). This is the test that fails when someone adds `packages/foo`
 * without saying who owns it.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot, loadOwnership } from '../src/repo.js';

const repoRoot = findRepoRoot();
const ownership = loadOwnership(repoRoot);

function directoriesIn(relative: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(repoRoot, relative));
  } catch {
    return [];
  }
  return entries
    .filter((entry) => !entry.startsWith('.') && entry !== 'node_modules')
    .map((entry) => `${relative}/${entry}`)
    .filter((path) => statSync(join(repoRoot, path)).isDirectory());
}

/** Every workspace directory the boundary map has to name. */
function ownedDirectories(): string[] {
  const apps = directoriesIn('apps');
  const packages = directoriesIn('packages').filter((path) => path !== 'packages/contracts');
  const contracts = directoriesIn('packages/contracts');
  const coreFolders = directoriesIn('packages/core/src');
  return [...apps, ...packages, ...contracts, ...coreFolders].sort();
}

describe('ownership.json coverage', () => {
  it('has an entry for every apps/*, packages/* and packages/core/src/* directory', () => {
    const missing = ownedDirectories().filter((path) => ownership.packages[path] === undefined);
    expect(
      missing,
      'add an entry to ownership.json (owner, issues, kind, optional, allowedDeps) and run `pnpm gen:deps-rules`',
    ).toEqual([]);
  });

  it('knows a new package is unowned', () => {
    expect(ownership.packages['packages/not-a-real-package']).toBeUndefined();
  });

  it('gives every owner a project key from the owners list', () => {
    const unknown = Object.entries(ownership.packages)
      .filter(([, entry]) => !ownership.owners.includes(entry.owner))
      .map(([key]) => key);
    expect(unknown).toEqual([]);
  });

  it('marks every optional module as kind module, and no core folder as optional', () => {
    for (const [key, entry] of Object.entries(ownership.packages)) {
      if (entry.optional) expect(entry.kind, key).toBe('module');
      if (key.startsWith('packages/core')) expect(entry.optional, key).toBe(false);
    }
  });

  it('keeps the PM schema out of packages/core', () => {
    expect(ownership.packages['packages/core/src/pm']).toBeUndefined();
    expect(ownership.packages['packages/pm']?.owner).toBe('pm-linear');
    expect(directoriesIn('packages')).toContain('packages/pm');
  });

  it('gives every contract an owner project and an owner agent', () => {
    for (const [name, contract] of Object.entries(ownership.contracts)) {
      expect(ownership.owners, name).toContain(contract.owner);
      expect(contract.ownerAgent.length, name).toBeGreaterThan(0);
    }
  });
});
