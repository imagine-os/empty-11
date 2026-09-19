// Integration: the validate CLI's exit codes (PAP-239 test plan).
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PKG_ROOT } from '../scripts/paths.js';

function cli(...args: string[]) {
  const r = spawnSync(
    resolve(PKG_ROOT, 'node_modules/.bin/tsx'),
    ['scripts/validate.ts', ...args],
    {
      cwd: PKG_ROOT,
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC' },
    },
  );
  return { code: r.status, out: r.stdout + r.stderr };
}

describe('validate CLI', () => {
  it('exits 0 on a valid artifact', () => {
    const r = cli('fixtures/visual.pass.json');
    expect(r.code).toBe(0);
    expect(r.out).toContain('valid visual artifact');
  }, 60_000);
  it('exits 1 on an invalid artifact and names the path', () => {
    const r = cli('fixtures/visual.bad-severity.json');
    expect(r.code).toBe(1);
    expect(r.out).toContain('findings.0.severity');
  }, 60_000);
  it('honours --kind and --json', () => {
    const r = cli('fixtures/visual.pass.json', '--kind', 'gate1', '--json');
    expect(r.code).toBe(1);
    const parsed = JSON.parse(r.out.trim()) as {
      ok: boolean;
      kind: string;
      issues: { path: string }[];
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.kind).toBe('gate1');
    expect(parsed.issues[0]?.path).toBe('kind');
  }, 60_000);
  it('exits 2 on usage errors, a missing file and an unknown kind', () => {
    expect(cli().code).toBe(2);
    expect(cli('fixtures/does-not-exist.json').code).toBe(2);
    expect(cli('fixtures/visual.pass.json', '--kind', 'lighthouse').code).toBe(2);
  }, 60_000);
});
