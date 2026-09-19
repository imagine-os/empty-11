/**
 * `pnpm --filter @paperos/core modules:validate` over the golden fixtures: the
 * table the reviewer sees, the exit code CI gates on, and the walk that finds
 * every `module.manifest.json` in a workspace.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  buildRows,
  findContractPackages,
  findManifests,
  findWorkspaceRoot,
  GOLDEN_FIXTURES,
  renderTable,
  run,
} from './cli.js';

const repoRoot = findWorkspaceRoot(process.cwd());
const scratch: string[] = [];

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'paperos-modules-'));
  scratch.push(root);
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  return root;
}

function writeJson(root: string, relative: string, value: unknown): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const module = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'process',
  version: '0.1.0',
  owner: { agent: 'Atlas', project: 'module-system' },
  provides: [{ contract: `@paperos/contract-${id}`, version: '0.1.0' }],
  requires: [],
  swapRisk: 'low',
  ...extra,
});

afterAll(() => {
  for (const root of scratch) rmSync(root, { recursive: true, force: true });
});

describe('workspace discovery', () => {
  it('walks up to pnpm-workspace.yaml', () => {
    expect(findWorkspaceRoot(join(repoRoot, 'packages', 'core', 'src', 'modules'))).toBe(repoRoot);
  });

  it('falls back to the starting folder when there is no workspace above it', () => {
    const orphan = mkdtempSync(join(tmpdir(), 'paperos-orphan-'));
    scratch.push(orphan);
    expect(findWorkspaceRoot(join(orphan, 'nested'))).toBe(join(orphan, 'nested'));
  });

  it('skips node_modules and friends', () => {
    const root = workspace();
    writeJson(root, 'packages/a/module.manifest.json', module('alpha'));
    writeJson(root, 'node_modules/evil/module.manifest.json', module('evil'));
    writeJson(root, 'packages/a/dist/module.manifest.json', module('stale'));
    expect(findManifests(root).map((entry) => entry.file)).toEqual([
      'packages/a/module.manifest.json',
    ]);
  });

  it('reads contract package names and versions, and survives a folder without one', () => {
    const root = workspace();
    writeJson(root, 'packages/contracts/demo/package.json', {
      name: '@paperos/contract-demo',
      version: '0.1.0',
    });
    mkdirSync(join(root, 'packages/contracts/empty'), { recursive: true });
    writeJson(root, 'packages/contracts/nameless/package.json', { version: '9.9.9' });
    expect(findContractPackages(root)).toEqual({ '@paperos/contract-demo': { version: '0.1.0' } });
  });

  it('returns nothing when there is no contracts folder', () => {
    expect(findContractPackages(workspace())).toEqual({});
  });
});

describe('run', () => {
  it('falls back to the eighteen golden manifests while no module ships one', () => {
    const result = run(['--root', repoRoot], repoRoot);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('18 manifests, 0 errors, 0 warnings.');
    expect(result.output).toContain(
      'No module ships a manifest yet, so these are the golden fixtures.',
    );
    expect(result.output).toMatch(/^MODULE\s+KIND\s+PROV\s+REQ\s+SWAP RISK\s+STATUS\s+FILE$/m);
    expect(result.output).toMatch(/^tables\s+runtime\s+1\s+4\s+high\s+ok\s/m);
  });

  it('finds the workspace root on its own', () => {
    expect(run([], join(repoRoot, 'packages', 'core')).exitCode).toBe(0);
  });

  it('fails and names the modules when a range does not match', () => {
    const root = workspace();
    writeJson(
      root,
      'packages/collab/module.manifest.json',
      module('collab', { owner: { agent: 'Nova', project: 'collab' } }),
    );
    writeJson(
      root,
      'packages/tables/module.manifest.json',
      module('tables', {
        owner: { agent: 'Nova', project: 'tables' },
        requires: [{ contract: '@paperos/contract-collab', range: '^0.2.0' }],
      }),
    );
    const result = run(['--root', root], root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('REQUIRES_RANGE_MISMATCH');
    expect(result.output).toContain(
      'tables requires @paperos/contract-collab ^0.2.0 but collab provides 0.1.0',
    );
    expect(result.output).toMatch(/^tables\s+process\s+1\s+1\s+low\s+FAIL\s/m);
    expect(result.output).toContain('2 manifests, 1 error, 0 warnings.');
  });

  it('marks a manifest with only warnings as warn', () => {
    const root = workspace();
    writeJson(
      root,
      'packages/a/module.manifest.json',
      module('alpha', {
        requires: [{ contract: '@paperos/contract-ghost', range: '^0.1.0', optional: true }],
      }),
    );
    const result = run(['--root', root], root);
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/^alpha\s+process\s+1\s+1\s+low\s+warn\s/m);
    expect(result.output).toContain('1 manifest, 0 errors, 1 warning.');
  });

  it('checks provided versions against the contract packages it finds', () => {
    const root = workspace();
    writeJson(root, 'packages/contracts/alpha/package.json', {
      name: '@paperos/contract-alpha',
      version: '0.2.0',
    });
    writeJson(root, 'packages/a/module.manifest.json', module('alpha'));
    const result = run(['--root', root], root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('PROVIDES_VERSION_MISMATCH');
  });

  it('reports an unparseable manifest against the id it can see', () => {
    const root = workspace();
    writeJson(root, 'packages/a/module.manifest.json', { ...module('alpha'), nope: true });
    writeJson(root, 'packages/b/module.manifest.json', { kind: 'process' });
    const result = run(['--root', root], root);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('SCHEMA_INVALID');
    expect(result.output).toMatch(/^alpha\s+\?\s+\?\s+\?\s+\?\s+FAIL\s/m);
    expect(result.output).toContain('<unknown>');
  });

  it('emits JSON on --json', () => {
    const result = run(['--root', repoRoot, '--json'], repoRoot);
    const parsed = JSON.parse(result.output) as {
      ok: boolean;
      fromFixtures: boolean;
      rows: unknown[];
      diagnostics: unknown[];
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.fromFixtures).toBe(true);
    expect(parsed.rows).toHaveLength(18);
    expect(parsed.diagnostics).toEqual([]);
  });

  it('never mistakes a fixture for a real module', () => {
    const root = workspace();
    writeJson(
      root,
      join(GOLDEN_FIXTURES, 'modules', 'alpha', 'module.manifest.json'),
      module('alpha'),
    );
    writeJson(root, 'packages/real/module.manifest.json', module('real'));
    const result = run(['--root', root], root);
    expect(result.output).toContain('1 manifest, 0 errors, 0 warnings.');
    expect(result.output).not.toContain('alpha');
  });

  it('reports an empty workspace whose fixtures folder holds nothing', () => {
    const root = workspace();
    mkdirSync(join(root, GOLDEN_FIXTURES), { recursive: true });
    const result = run(['--root', root], root);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('0 manifests, 0 errors, 0 warnings.');
    expect(result.output).not.toContain('golden fixtures');
  });

  it('says --fix is not wired yet', () => {
    const result = run(['--fix'], repoRoot);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not wired yet (reserved for PAP-552)');
  });

  it('handles an empty workspace', () => {
    const root = workspace();
    const result = run(['--root', root], root);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('0 manifests, 0 errors, 0 warnings.');
    expect(renderTable(buildRows([], []))).toContain('MODULE');
  });

  it('defaults --root to the current folder when the flag has no value', () => {
    const root = workspace();
    expect(run(['--root'], root).exitCode).toBe(0);
  });
});
