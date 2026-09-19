import { describe, expect, it } from 'vitest';
import { classify, classifyRow, toMarkdown, toSarif } from '../lib/classify.mjs';
import { loadRealPolicy, row, TODAY, waiver } from './helpers.mjs';

const policy = loadRealPolicy();
const one = (overrides, options = {}) =>
  classify({
    inventory: [row(overrides)],
    policy: { ...policy, ...(options.policy ?? {}) },
    exceptions: options.exceptions ?? [],
    today: TODAY,
  });

describe('classify', () => {
  it('passes an allow-tier dependency and records it as a notice', () => {
    const report = one({ declared: 'MIT' });
    expect(report.status).toBe('pass');
    expect(report.counts).toEqual({ violations: 0, warnings: 0, notices: 1 });
    expect(report.notices[0]).toMatchObject({
      package: 'example',
      license: 'MIT',
      context: 'bundled',
    });
  });

  it('fails a deny-tier dependency', () => {
    const report = one({ declared: 'SSPL-1.0' });
    expect(report.status).toBe('fail');
    expect(report.violations[0]).toMatchObject({
      kind: 'denied',
      tier: 'deny',
      context: 'bundled',
    });
  });

  it('fails a review tier with no waiver, and warns instead when the policy says warn', () => {
    const strict = one({ declared: 'GPL-3.0-or-later', contexts: ['server'] });
    expect(strict.status).toBe('fail');
    expect(strict.violations[0].kind).toBe('review-unwaived');

    const lenient = one(
      { declared: 'GPL-3.0-or-later', contexts: ['server'] },
      { policy: { reviewWithoutWaiver: 'warn' } },
    );
    expect(lenient.status).toBe('pass');
    expect(lenient.warnings[0].kind).toBe('review-unwaived');
  });

  it('passes a waived review tier and keeps it visible as a warning', () => {
    const report = one(
      { declared: 'GPL-3.0-or-later', contexts: ['server'] },
      { exceptions: [waiver()] },
    );
    expect(report.status).toBe('pass');
    expect(report.warnings[0]).toMatchObject({ kind: 'waived' });
    expect(report.warnings[0].waiver.adr).toBe('docs/adr/0027-license-policy.md');
  });

  it('fails an expired waiver rather than falling back to no waiver', () => {
    const report = one(
      { declared: 'GPL-3.0-or-later', contexts: ['server'] },
      { exceptions: [waiver({ expires: '2026-01-01' })] },
    );
    expect(report.status).toBe('fail');
    expect(report.violations[0]).toMatchObject({ kind: 'waiver-expired' });
    expect(report.violations[0].reason).toMatch(/expired on 2026-01-01/);
  });

  it('refuses an Atlas-approved waiver for a deny tier — that one needs Justin', () => {
    const atlas = one(
      { declared: 'SSPL-1.0', contexts: ['server'] },
      { exceptions: [waiver({ license: 'SSPL-1.0', approvedBy: 'Atlas' })] },
    );
    expect(atlas.status).toBe('fail');
    expect(atlas.violations[0].kind).toBe('waiver-approver');

    const justin = one(
      { declared: 'SSPL-1.0', contexts: ['server'] },
      { exceptions: [waiver({ license: 'SSPL-1.0', approvedBy: 'Justin' })] },
    );
    expect(justin.status).toBe('pass');
  });

  it('fails a package with no licence at all', () => {
    const report = one({ declared: null });
    expect(report.status).toBe('fail');
    expect(report.violations[0].license).toBe('NONE');
  });

  it('lets the LICENSE file overrule a friendlier license field', () => {
    const report = one({ declared: 'MIT', detected: 'AGPL-3.0-or-later', contexts: ['server'] });
    expect(report.status).toBe('fail');
    const mismatch = report.violations.find((entry) => entry.kind === 'mismatch');
    expect(mismatch ?? report.warnings.find((entry) => entry.kind === 'mismatch')).toBeDefined();
    expect(report.violations.some((entry) => entry.tier === 'deny')).toBe(true);
  });

  it('says nothing about a textual difference that does not change the tier', () => {
    const report = one({ declared: 'ISC', detected: '0BSD' });
    expect(report.status).toBe('pass');
    expect(report.counts.warnings).toBe(0);
    expect(classifyRow(policy, row({ declared: 'ISC', detected: '0BSD' })).textDiffers).toBe(true);
  });

  it('moves a GPL dev tool to deny the moment an app depends on it', () => {
    expect(one({ declared: 'GPL-3.0-or-later', contexts: ['dev'], production: false }).status).toBe(
      'pass',
    );
    expect(one({ declared: 'GPL-3.0-or-later', contexts: ['dev', 'bundled'] }).status).toBe('fail');
  });

  it('passes a dual licence whose permissive branch is allowed', () => {
    expect(one({ declared: '(MIT OR GPL-3.0-only)' }).status).toBe('pass');
    expect(one({ declared: '(GPL-3.0-only AND MIT)', contexts: ['server'] }).status).toBe('fail');
  });
});

describe('report renderings', () => {
  const report = classify({
    inventory: [row({ declared: 'SSPL-1.0' }), row({ package: 'ok', declared: 'MIT' })],
    policy,
    exceptions: [],
    today: TODAY,
  });

  it('renders SARIF with one error per violation', () => {
    const sarif = toSarif(report);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results).toHaveLength(1);
    expect(sarif.runs[0].results[0]).toMatchObject({ ruleId: 'license/denied', level: 'error' });
  });

  it('renders a markdown summary naming the package, tier and context', () => {
    const markdown = toMarkdown(report);
    expect(markdown).toMatch(/Licence check — FAIL/);
    expect(markdown).toMatch(/`example` \| 1\.0\.0 \| SSPL-1\.0 \| bundled \| deny/);
  });
});
