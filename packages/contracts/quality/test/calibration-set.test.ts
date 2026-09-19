import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCalibrationCases } from '../scripts/load-calibration.js';
import { CALIBRATION_DIR } from '../scripts/paths.js';
import { FindingSchema, findingId } from '../src/finding.js';
import { rubricExists } from '../src/rubrics.js';

const cases = loadCalibrationCases();

describe('calibration set', () => {
  it('has 15 cases, each with input.md and a rationale per expected finding', () => {
    expect(cases).toHaveLength(15);
    for (const c of cases) {
      expect(existsSync(resolve(CALIBRATION_DIR, c.case, 'input.md'))).toBe(true);
      expect(
        readFileSync(resolve(CALIBRATION_DIR, c.case, 'input.md'), 'utf8').length,
      ).toBeGreaterThan(100);
      for (const e of c.expected) expect(e.rationale.length).toBeGreaterThan(20);
    }
  });
  it('every RUB-* referenced by a case exists', () => {
    for (const c of cases)
      for (const e of c.expected)
        expect(rubricExists(e.rubricId), `${c.case} ${e.rubricId}`).toBe(true);
  });
  it('covers every severity from S0 to S3 and a clean case', () => {
    const sev = new Set(cases.flatMap((c) => c.expected.map((e) => e.severity)));
    for (const s of ['S0', 'S1', 'S2', 'S3']) expect(sev.has(s as 'S0')).toBe(true);
    expect(cases.some((c) => c.expected.length === 0)).toBe(true);
  });
  it('the schema accepts every expected finding rendered as a Finding', () => {
    for (const c of cases) {
      for (const e of c.expected) {
        const reviewer = e.reviewers?.[0] ?? c.reviewers[0] ?? 'reviewer';
        const f = {
          id: findingId(reviewer, e.rubricId, e.file, e.title),
          reviewer,
          rubricId: e.rubricId,
          severity: e.severity,
          title: e.title,
          body: e.rationale,
          ...(e.file ? { file: e.file } : {}),
          evidence: [{ kind: 'code', ref: `docs/quality/rubrics/calibration/${c.case}/input.md` }],
          confidence: 0.9,
          autofixable: false,
        };
        expect(FindingSchema.safeParse(f).success, `${c.case} ${e.rubricId}`).toBe(true);
      }
    }
  });
});
