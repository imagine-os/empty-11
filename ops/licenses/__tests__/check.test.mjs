import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lockfileFreshness, parseArgs, run } from '../check.mjs';
import { OPS_LICENSES, REPO_ROOT } from './helpers.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'paperos-licenses-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function runCheck(args) {
  const out = [];
  const err = [];
  const code = run(args, {
    log: (line) => out.push(String(line)),
    error: (line) => err.push(String(line)),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const fixtureRun = (name, extra = []) =>
  runCheck([
    '--input',
    join(OPS_LICENSES, 'fixtures', name),
    '--report',
    join(scratch, `${name}.json`),
    '--today',
    '2026-09-19',
    ...extra,
  ]);

describe('parseArgs', () => {
  it('reads the options the CI job passes', () => {
    const options = parseArgs([
      '--report',
      'reports/licenses.json',
      '--sarif',
      'reports/licenses.sarif',
      '--quiet',
    ]);
    expect(options).toMatchObject({
      report: 'reports/licenses.json',
      sarif: 'reports/licenses.sarif',
      quiet: true,
    });
  });

  it('rejects an unknown option instead of ignoring it', () => {
    expect(() => parseArgs(['--yolo'])).toThrow(/unknown option/);
    expect(runCheck(['--yolo']).code).toBe(2);
  });
});

describe('end to end against captured pnpm output', () => {
  it('passes a clean workspace and writes the report', () => {
    const result = fixtureRun('clean');
    expect(result.code).toBe(0);
    const report = JSON.parse(readFileSync(join(scratch, 'clean.json'), 'utf8'));
    expect(report.status).toBe('pass');
    expect(report.scanned).toBe(3);
    // react and drizzle-orm ship; vitest is dev-only and owes no notice.
    expect(report.notices.map((entry) => entry.package)).toEqual(['drizzle-orm', 'react']);
  });

  it('fails on a seeded SSPL dependency, naming the package, tier and context', () => {
    const result = fixtureRun('seeded-sspl', ['--sarif', join(scratch, 'seeded.sarif')]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/seeded-sspl-dep@1\.0\.0 \[bundled\] SSPL-1\.0 → deny/);
    const sarif = JSON.parse(readFileSync(join(scratch, 'seeded.sarif'), 'utf8'));
    expect(sarif.runs[0].results[0].message.text).toMatch(/seeded-sspl-dep/);
  });

  it('allows a GPL CLI that only the dev toolchain reaches', () => {
    const result = fixtureRun('gpl-dev-tool');
    expect(result.code).toBe(0);
    const report = JSON.parse(readFileSync(join(scratch, 'gpl-dev-tool.json'), 'utf8'));
    const gpl = report.notices.find((entry) => entry.package === 'gpl-cli');
    expect(gpl).toBeUndefined();
    expect(report.status).toBe('pass');
  });

  it('validates the policy without scanning anything', () => {
    const result = runCheck(['--policy-only']);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/licence policy ok/);
  });

  it('refuses to run against a missing input rather than reporting a pass', () => {
    expect(runCheck(['--input', join(scratch, 'nope')]).code).toBe(2);
  });
});

describe('lockfileFreshness', () => {
  const exists = (paths) => (path) => paths.some((name) => path.endsWith(name));

  it('fails fast when the lockfile changed after the last install', () => {
    const stat = (path) => ({ mtimeMs: path.endsWith('pnpm-lock.yaml') ? 20_000 : 1_000 });
    const result = lockfileFreshness('/repo', {
      stat,
      exists: exists(['pnpm-lock.yaml', '.modules.yaml']),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/changed after the last install/);
  });

  it('fails fast when nothing is installed', () => {
    const result = lockfileFreshness('/repo', {
      stat: () => ({ mtimeMs: 1 }),
      exists: exists(['pnpm-lock.yaml']),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/node_modules is missing/);
  });

  it('is happy with the real repository, which is installed', () => {
    expect(lockfileFreshness(REPO_ROOT).ok).toBe(true);
  });
});
