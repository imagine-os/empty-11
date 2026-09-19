import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCalibrationCases } from '../scripts/load-calibration.js';
import { PKG_ROOT } from '../scripts/paths.js';
import {
  calibrate,
  formatReport,
  type ReviewerOutput,
  ReviewerOutputSchema,
  scoreCase,
} from '../src/calibrate.js';

const cases = loadCalibrationCases();

describe('calibrate', () => {
  it('reports the expected agreement on the sample fixture (13/15 with two disagreements)', () => {
    const output = ReviewerOutputSchema.parse(
      JSON.parse(readFileSync(resolve(PKG_ROOT, 'fixtures/sample-review.json'), 'utf8')),
    );
    const report = calibrate(cases, output);
    expect(report.cases).toBe(15);
    expect(report.agreed).toBe(13);
    expect(report.agreement).toBe(0.8667);
    expect(report.pass).toBe(true);
    expect(report.disagreements).toHaveLength(2);
    expect(report.disagreements.map((d) => `${d.case}:${d.kind}`)).toEqual([
      '05-cor-pagination-off-by-one:severity',
      '15-clean-pr:extra-blocker',
    ]);
    const text = formatReport(report);
    expect(text).toContain('13/15 = 0.8667');
    expect(text).toContain('Disagreements:');
  });
  it('a perfect output scores 1.0', () => {
    const output = {
      reviewer: 'all',
      cases: cases.map((c) => ({
        case: c.case,
        findings: c.expected.map((e) => ({
          reviewer: 'all',
          rubricId: e.rubricId,
          severity: e.severity,
          title: e.title,
          body: e.rationale,
          ...(e.file ? { file: e.file } : {}),
          evidence: [],
          confidence: 0.9,
          autofixable: false,
        })),
      })),
    };
    const report = calibrate(cases, ReviewerOutputSchema.parse(output));
    expect(report.agreement).toBe(1);
    expect(report.disagreements).toEqual([]);
  });
  it('an expected S3 is optional but over-reporting it disagrees', () => {
    const c = cases.find((x) => x.case === '10-vis-truncation-with-tooltip');
    if (!c) throw new Error('case missing');
    expect(scoreCase(c, { case: c.case, findings: [] })).toEqual([]);
    const over = scoreCase(c, {
      case: c.case,
      findings: [
        {
          reviewer: 'vision',
          rubricId: 'RUB-VIS-03',
          severity: 'S1',
          title: 't',
          body: 'b',
          evidence: [],
          confidence: 0.9,
          autofixable: false,
        },
      ],
    });
    expect(over.map((d) => d.kind)).toEqual(['severity']);
  });
  it('expected findings addressed to other reviewers are skipped', () => {
    const c = cases.find((x) => x.case === '04-cor-null-empty-list');
    if (!c) throw new Error('case missing');
    const corOnly: ReviewerOutput['cases'][number] = {
      case: c.case,
      findings: [
        {
          reviewer: 'correctness',
          rubricId: 'RUB-COR-02',
          severity: 'S1',
          title: 't',
          body: 'b',
          evidence: [],
          confidence: 0.9,
          autofixable: false,
        },
      ],
    };
    expect(scoreCase(c, corOnly, 'correctness')).toEqual([]);
    expect(scoreCase(c, corOnly, 'spec-conformance').map((d) => d.rubricId)).toEqual([
      'RUB-SPEC-04',
    ]);
  });
  it('a missing case and a missed blocker both disagree', () => {
    const c = cases[0];
    if (!c) throw new Error('no cases');
    expect(scoreCase(c, undefined).map((d) => d.kind)).toEqual(['missing-case']);
    expect(scoreCase(c, { case: c.case, findings: [] }).map((d) => d.kind)).toEqual(['missed']);
  });
});
