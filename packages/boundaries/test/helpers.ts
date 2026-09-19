/**
 * Test helpers for the boundary tests (PAP-305).
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Ownership } from '@paperos/core';
import { type CruiserConfig, renderConfigFile } from '../src/rules.js';

/** One violation as dependency-cruiser's JSON reporter states it. */
export interface CruiseViolation {
  rule: { name: string; severity: string; comment?: string };
  from: string;
  to: string;
}

/**
 * Run the real `depcruise` binary over `target` with a generated config, and
 * return the violations. The config goes to a temp file so the committed
 * `.dependency-cruiser.cjs` is never touched; cwd is the repo root so the path
 * regexes mean what they say.
 */
export function cruise(repoRoot: string, config: CruiserConfig, target: string): CruiseViolation[] {
  const directory = mkdtempSync(join(tmpdir(), 'paperos-boundaries-'));
  const configFile = join(directory, 'fixture.dependency-cruiser.cjs');
  writeFileSync(configFile, renderConfigFile(config), 'utf8');
  const result = spawnSync(
    join(repoRoot, 'node_modules', '.bin', 'depcruise'),
    ['--config', configFile, '--output-type', 'json', target],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.stdout === '' || result.stdout === undefined) {
    throw new Error(`depcruise produced no output: ${result.stderr}`);
  }
  const parsed = JSON.parse(result.stdout) as {
    summary: { violations: CruiseViolation[] };
  };
  return parsed.summary.violations;
}

/** A minimal, valid boundary map for schema and rule-generation tests. */
export function fixtureOwnership(overrides: Partial<Ownership> = {}): Ownership {
  const base: Ownership = {
    version: 1,
    generated: false,
    issue: 'PAP-305',
    adr: 'docs/adr/0026-package-boundaries.md',
    doc: 'docs/platform/package-boundaries.md',
    sections: { packages: 'fixture' },
    owners: ['app-shell', 'business-core', 'growth', 'data-layer'],
    kinds: { core: 'fixture', module: 'fixture' },
    packages: {
      'packages/core': {
        owner: 'app-shell',
        issues: ['PAP-13'],
        kind: 'core',
        optional: false,
        allowedDeps: [],
      },
      'packages/finance': {
        owner: 'business-core',
        issues: ['PAP-175'],
        kind: 'module',
        optional: true,
        allowedDeps: ['packages/core'],
      },
      'packages/crm': {
        owner: 'growth',
        issues: ['PAP-187'],
        kind: 'module',
        optional: true,
        allowedDeps: ['packages/core'],
      },
    },
    contracts: {},
    exempt: {
      // Not `**/test/**`: the fixture tree itself lives under a `test/`
      // folder, and a test-file exemption would swallow the violation the
      // integration test is looking for.
      testFiles: ['**/*.test.ts', '**/*.spec.ts'],
      notCruised: ['**/node_modules/**'],
      generated: [{ glob: 'apps/*/src/generated/**', by: 'PAP-114' }],
      react: ['packages/ui'],
    },
  };
  return { ...base, ...overrides };
}
