// The shared finding vocabulary for every reviewer agent, the vision inspector,
// the edge-case hunter, the a11y audit and Justin (PAP-79).
// Source of the JSON Schema at ../schemas/finding.schema.json and
// docs/quality/rubrics/finding.schema.json (generated, never hand-edited).
import { createHash } from 'node:crypto';
import { z } from 'zod';

/** Severity names. S0..S3 are defects; `question` and `praise` are non-defect kinds. */
export const SEVERITIES = ['S0', 'S1', 'S2', 'S3', 'question', 'praise'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SeveritySchema = z.enum(SEVERITIES);

/** Defect severities only (what the gate counts). */
export const DEFECT_SEVERITIES = ['S0', 'S1', 'S2', 'S3'] as const;
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number];

/** Blocking rule (severity.md, "Gate rule"). */
export const GATE_RULE = {
  /** Any S0 blocks. */
  s0Blocks: true,
  /** More than this many S1 blocks. */
  maxS1: 3,
  /** Below this confidence a defect finding is posted as a `question`. */
  questionBelowConfidence: 0.5,
} as const;

export const RUBRIC_ID_PATTERN = /^RUB-(COR|SEC|SPEC|VIS|A11Y|PERF|DOC|AGENT)-\d{2}$/;
export const RubricIdSchema = z
  .string()
  .regex(RUBRIC_ID_PATTERN, 'rubricId must look like RUB-<DOMAIN>-<nn>');

/** Aligned with `ARTIFACT_KINDS` (PAP-239): `sarif` and `report` let a finding cite the scanner or gate file it came from. */
export const EVIDENCE_KINDS = ['code', 'screenshot', 'video', 'log', 'sarif', 'report'] as const;
export const EvidenceSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  /** `file:line` for code; otherwise an artefact path relative to `reports/` (PAP-239 `ArtifactRef.path`) or a URL. */
  ref: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** A severity override recorded instead of a silent edit (severity.md, "Waivers"). */
export const WaiverSchema = z.object({
  reason: z.string().min(1),
  /** Who approved: Justin for S0 and security S1, Sentinel for other S1, any reviewer below. */
  approvedBy: z.string().min(1),
  /** ISO 8601 date; expired waivers stop applying and fail certification (PAP-80, PAP-88). */
  expires: z.iso.date(),
});
export type Waiver = z.infer<typeof WaiverSchema>;

/** Object shape without cross-field refinements (for `.omit()`/`.extend()` in consumers). */
export const FindingBaseSchema = z
  .object({
    /** `findingId(reviewer, rubricId, file, title)`: 10 hex chars. */
    id: z.string().regex(/^[0-9a-f]{10}$/, 'id is sha1(...)[:10]'),
    /** Reviewer name: `correctness`, `security`, `spec-conformance`, `docs-and-spec`, `vision`, `edge-case`, `a11y-audit`, `justin`. */
    reviewer: z.string().min(1),
    rubricId: RubricIdSchema,
    severity: SeveritySchema,
    /** One sentence, the claim. Normalised for the id. */
    title: z.string().min(1).max(200),
    /** Concrete failure scenario and the test that would prove it. */
    body: z.string().min(1),
    /** Repo-relative path. Omitted for repo-wide or artefact findings. */
    file: z.string().min(1).optional(),
    line: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    /** Unified diff or replacement text; required when `autofixable` is true. */
    suggestion: z.string().optional(),
    evidence: z.array(EvidenceSchema),
    /** 0..1. Under GATE_RULE.questionBelowConfidence the finding posts as a question. */
    confidence: z.number().min(0).max(1),
    autofixable: z.boolean(),
    waiver: WaiverSchema.optional(),
  })
  .strict();

export const FindingSchema = FindingBaseSchema.refine(
  (f) => f.endLine === undefined || f.line === undefined || f.endLine >= f.line,
  {
    message: 'endLine must not precede line',
    path: ['endLine'],
  },
).refine((f) => !f.autofixable || (f.suggestion !== undefined && f.suggestion.length > 0), {
  message: 'autofixable findings carry a suggestion',
  path: ['suggestion'],
});
export type Finding = z.infer<typeof FindingSchema>;

/** Rubric coverage lets silence differ from a skipped check (PAP-244, PAP-677). */
export const RUBRIC_COVERAGE_STATES = ['checked', 'n/a', 'skipped'] as const;
export const RubricCoverageSchema = z.record(RubricIdSchema, z.enum(RUBRIC_COVERAGE_STATES));
export type RubricCoverage = z.infer<typeof RubricCoverageSchema>;

/** Title normalisation: case, whitespace and trailing punctuation do not change the id. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?:;,]+$/, '');
}

const ID_SEPARATOR = '\u001f';

/**
 * Deterministic finding id: sha1 of reviewer, rubricId, file and the normalised title,
 * joined by U+001F (so `a`+`bc` and `ab`+`c` never collide), first 10 hex chars.
 */
export function findingId(
  reviewer: string,
  rubricId: string,
  file: string | undefined,
  title: string,
): string {
  const input = [reviewer, rubricId, file ?? '', normalizeTitle(title)].join(ID_SEPARATOR);
  return createHash('sha1').update(input, 'utf8').digest('hex').slice(0, 10);
}

/** Build a finding with its id computed; validates the result. */
export function makeFinding(input: Omit<Finding, 'id'>): Finding {
  return FindingSchema.parse({
    ...input,
    id: findingId(input.reviewer, input.rubricId, input.file, input.title),
  });
}

export function isDefect(severity: Severity): severity is DefectSeverity {
  return severity === 'S0' || severity === 'S1' || severity === 'S2' || severity === 'S3';
}

const RANK: Record<Severity, number> = { S0: 0, S1: 1, S2: 2, S3: 3, question: 4, praise: 5 };

/** Lower rank is more severe. */
export function severityRank(severity: Severity): number {
  return RANK[severity];
}

export function moreSevere(a: Severity, b: Severity): Severity {
  return RANK[a] <= RANK[b] ? a : b;
}

/** Cap a severity at `max` (a finding in a generated file is capped at S2, third-party code at S3). */
export function capSeverity(severity: Severity, max: DefectSeverity): Severity {
  if (!isDefect(severity)) return severity;
  return RANK[severity] < RANK[max] ? max : severity;
}

/** Confidence rule: a defect under the threshold is posted as a question, never dropped. */
export function applyConfidenceRule(finding: Finding): Finding {
  if (isDefect(finding.severity) && finding.confidence < GATE_RULE.questionBelowConfidence) {
    return { ...finding, severity: 'question' };
  }
  return finding;
}

/** Effective severity after a waiver: waived findings do not count toward the gate. */
export function effectiveSeverity(finding: Finding, now: Date = new Date()): Severity {
  if (finding.waiver && new Date(finding.waiver.expires) >= now) return 'question';
  return finding.severity;
}

export interface SeverityCounts {
  S0: number;
  S1: number;
  S2: number;
  S3: number;
  question: number;
  praise: number;
}

export function countBySeverity(findings: readonly Finding[], now?: Date): SeverityCounts {
  const counts: SeverityCounts = { S0: 0, S1: 0, S2: 0, S3: 0, question: 0, praise: 0 };
  for (const f of findings) counts[effectiveSeverity(f, now)] += 1;
  return counts;
}

export interface GateDecision {
  status: 'pass' | 'fail';
  counts: SeverityCounts;
  reasons: string[];
}

/** Gate rule: any S0 blocks; more than GATE_RULE.maxS1 S1 blocks; S2, S3, question, praise never block. */
export function gateDecision(findings: readonly Finding[], now?: Date): GateDecision {
  const counts = countBySeverity(findings, now);
  const reasons: string[] = [];
  if (GATE_RULE.s0Blocks && counts.S0 > 0) reasons.push(`${counts.S0} S0 finding(s)`);
  if (counts.S1 > GATE_RULE.maxS1)
    reasons.push(`${counts.S1} S1 findings (limit ${GATE_RULE.maxS1})`);
  return { status: reasons.length === 0 ? 'pass' : 'fail', counts, reasons };
}

/**
 * Dedupe within one reviewer by id (two reviewers on the same line are both kept;
 * the most severe of duplicates governs).
 */
export function dedupeWithinReviewer(findings: readonly Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.reviewer}\u001f${f.id}`;
    const existing = byKey.get(key);
    if (!existing || severityRank(f.severity) < severityRank(existing.severity)) byKey.set(key, f);
  }
  return [...byKey.values()];
}
