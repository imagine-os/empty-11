// Calibration scoring (PAP-79 `pnpm rubrics:calibrate <output.json>`).
// Compares a reviewer's output on the calibration set with the expected findings and
// prints an agreement score plus every disagreement.
import { z } from 'zod';
import {
  type Finding,
  FindingBaseSchema,
  FindingSchema,
  isDefect,
  RubricIdSchema,
  type Severity,
  SeveritySchema,
} from './finding.js';

/** One expected finding in `calibration/<case>/expected.json`. */
export const ExpectedFindingSchema = z
  .object({
    rubricId: RubricIdSchema,
    severity: SeveritySchema,
    title: z.string().min(1),
    file: z.string().optional(),
    rationale: z.string().min(1),
    /** When set, only these reviewers are expected to report it; others skip it. */
    reviewers: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
export type ExpectedFinding = z.infer<typeof ExpectedFindingSchema>;

export const CalibrationCaseSchema = z
  .object({
    case: z.string().regex(/^\d{2}-[a-z0-9-]+$/),
    domain: z.string().min(1),
    /** Reviewers expected to run this case. */
    reviewers: z.array(z.string().min(1)).min(1),
    expected: z.array(ExpectedFindingSchema),
    notes: z.string().optional(),
  })
  .strict();
export type CalibrationCase = z.infer<typeof CalibrationCaseSchema>;

/** Reviewer output file shape. `id` may be omitted; it is not compared. */
export const ReviewerOutputSchema = z
  .object({
    reviewer: z.string().min(1),
    cases: z.array(
      z
        .object({
          case: z.string(),
          findings: z.array(
            FindingBaseSchema.omit({ id: true }).extend({ id: z.string().optional() }),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type ReviewerOutput = z.infer<typeof ReviewerOutputSchema>;

export interface Disagreement {
  case: string;
  kind: 'missed' | 'severity' | 'extra-blocker' | 'missing-case' | 'invalid-output';
  rubricId?: string;
  expected?: Severity;
  actual?: Severity;
  detail: string;
}

export interface CalibrationReport {
  reviewer: string;
  cases: number;
  agreed: number;
  /** agreed / cases, 4 decimals. */
  agreement: number;
  /** PAP-81 threshold. */
  threshold: number;
  pass: boolean;
  disagreements: Disagreement[];
}

export const CALIBRATION_THRESHOLD = 0.8;

type OutputFinding = ReviewerOutput['cases'][number]['findings'][number];

function matches(e: ExpectedFinding, f: OutputFinding): boolean {
  return (
    e.rubricId === f.rubricId && (e.file === undefined || f.file === undefined || e.file === f.file)
  );
}

/**
 * A case agrees when every expected S0..S2 finding addressed to this reviewer is present
 * with the same rubric id and severity, and the output adds no S0 or S1 the expectation
 * does not list. An expected S3 is optional: missing it is fine, over-reporting it is a
 * severity disagreement. Extra S2, S3, questions and praise never count against a reviewer.
 */
export function scoreCase(
  expected: CalibrationCase,
  output: ReviewerOutput['cases'][number] | undefined,
  reviewer?: string,
): Disagreement[] {
  if (!output) {
    return [
      {
        case: expected.case,
        kind: 'missing-case',
        detail: 'reviewer produced no output for this case',
      },
    ];
  }
  const out: Disagreement[] = [];
  const used = new Set<number>();
  for (const e of expected.expected) {
    if (reviewer !== undefined && e.reviewers !== undefined && !e.reviewers.includes(reviewer))
      continue;
    const idx = output.findings.findIndex((f, i) => !used.has(i) && matches(e, f));
    if (idx === -1) {
      if (e.severity === 'S3' || !isDefect(e.severity)) continue;
      out.push({
        case: expected.case,
        kind: 'missed',
        rubricId: e.rubricId,
        expected: e.severity,
        detail: `expected ${e.rubricId} at ${e.severity}: ${e.title}`,
      });
      continue;
    }
    used.add(idx);
    const f = output.findings[idx] as OutputFinding;
    if (f.severity !== e.severity) {
      out.push({
        case: expected.case,
        kind: 'severity',
        rubricId: e.rubricId,
        expected: e.severity,
        actual: f.severity,
        detail: `${e.rubricId} reported ${f.severity}, expected ${e.severity}: ${e.title}`,
      });
    }
  }
  output.findings.forEach((f, i) => {
    if (used.has(i)) return;
    // A real defect addressed to another reviewer is never a false positive.
    if (expected.expected.some((e) => matches(e, f))) return;
    if (isDefect(f.severity) && (f.severity === 'S0' || f.severity === 'S1')) {
      out.push({
        case: expected.case,
        kind: 'extra-blocker',
        rubricId: f.rubricId,
        actual: f.severity,
        detail: `unexpected ${f.severity} ${f.rubricId}: ${f.title}`,
      });
    }
  });
  return out;
}

export function calibrate(
  expectedCases: readonly CalibrationCase[],
  output: ReviewerOutput,
  threshold = CALIBRATION_THRESHOLD,
): CalibrationReport {
  const byCase = new Map(output.cases.map((c) => [c.case, c]));
  const disagreements: Disagreement[] = [];
  let agreed = 0;
  for (const expected of expectedCases) {
    const d = scoreCase(expected, byCase.get(expected.case), output.reviewer);
    if (d.length === 0) agreed += 1;
    disagreements.push(...d);
  }
  const agreement =
    expectedCases.length === 0 ? 0 : Math.round((agreed / expectedCases.length) * 10000) / 10000;
  return {
    reviewer: output.reviewer,
    cases: expectedCases.length,
    agreed,
    agreement,
    threshold,
    pass: agreement >= threshold,
    disagreements,
  };
}

export function formatReport(report: CalibrationReport): string {
  const lines = [
    `Calibration: ${report.reviewer}`,
    `Agreement: ${report.agreed}/${report.cases} = ${report.agreement.toFixed(4)} (threshold ${report.threshold}) ${report.pass ? 'PASS' : 'FAIL'}`,
  ];
  if (report.disagreements.length > 0) {
    lines.push('Disagreements:');
    for (const d of report.disagreements) lines.push(`  - [${d.case}] ${d.kind}: ${d.detail}`);
  } else {
    lines.push('Disagreements: none');
  }
  return lines.join('\n');
}

/** Helper for fixtures and tests: a full Finding array from output findings (ids filled). */
export function toFindings(
  reviewer: string,
  findings: readonly OutputFinding[],
  idFn: (r: string, rubricId: string, file: string | undefined, title: string) => string,
): Finding[] {
  return findings.map((f) =>
    FindingSchema.parse({
      ...f,
      reviewer,
      id: f.id ?? idFn(reviewer, f.rubricId, f.file, f.title),
    }),
  );
}
