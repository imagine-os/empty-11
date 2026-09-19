import { describe, expect, it } from 'vitest';
import {
  applyConfidenceRule,
  capSeverity,
  dedupeWithinReviewer,
  effectiveSeverity,
  type Finding,
  FindingSchema,
  findingId,
  gateDecision,
  makeFinding,
  normalizeTitle,
} from '../src/finding.js';

const base: Omit<Finding, 'id'> = {
  reviewer: 'correctness',
  rubricId: 'RUB-COR-02',
  severity: 'S1',
  title: 'first.id throws when a tenant has no projects',
  body: 'Seed a tenant with zero projects and open /projects: TypeError. Test: render List with items: [].',
  file: 'apps/web/src/routes/projects/List.tsx',
  line: 4,
  evidence: [{ kind: 'code', ref: 'apps/web/src/routes/projects/List.tsx:4' }],
  confidence: 0.9,
  autofixable: false,
};

describe('Finding schema', () => {
  it('accepts a well-formed finding', () => {
    const f = makeFinding({ ...base });
    expect(FindingSchema.safeParse(f).success).toBe(true);
    expect(f.id).toMatch(/^[0-9a-f]{10}$/);
  });
  it('rejects a wrong severity', () => {
    const r = FindingSchema.safeParse({ ...makeFinding({ ...base }), severity: 'critical' });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0]?.path.join('.')).toBe('severity');
  });
  it('rejects a confidence over 1', () => {
    const r = FindingSchema.safeParse({ ...makeFinding({ ...base }), confidence: 1.2 });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0]?.path.join('.')).toBe('confidence');
  });
  it('rejects a missing evidence kind', () => {
    const r = FindingSchema.safeParse({ ...makeFinding({ ...base }), evidence: [{ ref: 'x' }] });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0]?.path.join('.')).toBe('evidence.0.kind');
  });
  it('rejects a rubric id outside the registry pattern', () => {
    expect(
      FindingSchema.safeParse({ ...makeFinding({ ...base }), rubricId: 'RUB-FOO-01' }).success,
    ).toBe(false);
  });
  it('requires a suggestion on autofixable findings and endLine >= line', () => {
    expect(
      FindingSchema.safeParse({ ...makeFinding({ ...base }), autofixable: true }).success,
    ).toBe(false);
    expect(FindingSchema.safeParse({ ...makeFinding({ ...base }), endLine: 2 }).success).toBe(
      false,
    );
  });
  it('accepts a waiver with the {reason, approvedBy, expires} shape', () => {
    const f = makeFinding({
      ...base,
      waiver: {
        reason: 'legacy import path, tracked in PAP-999',
        approvedBy: 'Sentinel',
        expires: '2026-10-31',
      },
    });
    expect(FindingSchema.safeParse(f).success).toBe(true);
    expect(effectiveSeverity(f, new Date('2026-10-01'))).toBe('question');
    expect(effectiveSeverity(f, new Date('2026-11-01'))).toBe('S1');
  });
});

describe('findingId', () => {
  it('is stable under whitespace and case changes in the title', () => {
    const a = findingId(
      'correctness',
      'RUB-COR-02',
      'a.ts',
      'First.id throws   when a tenant has no projects',
    );
    const b = findingId(
      'correctness',
      'RUB-COR-02',
      'a.ts',
      '  first.id THROWS when a tenant\nhas no projects. ',
    );
    expect(a).toBe(b);
    expect(a).toHaveLength(10);
  });
  it('changes when reviewer, rubric or file change', () => {
    const a = findingId('correctness', 'RUB-COR-02', 'a.ts', 't');
    expect(findingId('security', 'RUB-COR-02', 'a.ts', 't')).not.toBe(a);
    expect(findingId('correctness', 'RUB-COR-03', 'a.ts', 't')).not.toBe(a);
    expect(findingId('correctness', 'RUB-COR-02', 'b.ts', 't')).not.toBe(a);
    expect(findingId('correctness', 'RUB-COR-02', undefined, 't')).not.toBe(a);
  });
  it('does not collide on boundary shifts between fields', () => {
    expect(findingId('ab', 'RUB-COR-01', 'c', 't')).not.toBe(
      findingId('a', 'RUB-COR-01', 'bc', 't'),
    );
  });
  it('matches a known vector', () => {
    expect(findingId('correctness', 'RUB-COR-02', 'a.ts', 'Title')).toBe(
      findingId('correctness', 'RUB-COR-02', 'a.ts', 'title'),
    );
    expect(normalizeTitle('  Hello,   World!  ')).toBe('hello, world');
  });
});

describe('gate rule', () => {
  const mk = (severity: 'S0' | 'S1' | 'S2' | 'S3' | 'question' | 'praise', n: number) =>
    makeFinding({ ...base, severity, title: `${severity} finding ${n}` });
  it('passes on S2/S3/question/praise only', () => {
    expect(
      gateDecision([mk('S2', 1), mk('S3', 2), mk('question', 3), mk('praise', 4)]).status,
    ).toBe('pass');
  });
  it('fails on any S0', () => {
    const d = gateDecision([mk('S0', 1)]);
    expect(d.status).toBe('fail');
    expect(d.reasons[0]).toContain('S0');
  });
  it('passes on 3 S1 and fails on 4', () => {
    expect(gateDecision([1, 2, 3].map((n) => mk('S1', n))).status).toBe('pass');
    expect(gateDecision([1, 2, 3, 4].map((n) => mk('S1', n))).status).toBe('fail');
  });
  it('does not count waived findings', () => {
    const waived = makeFinding({
      ...base,
      severity: 'S0',
      waiver: { reason: 'r', approvedBy: 'Justin', expires: '2099-01-01' },
    });
    expect(gateDecision([waived], new Date('2026-09-19')).status).toBe('pass');
  });
});

describe('severity helpers', () => {
  it('posts low-confidence defects as questions', () => {
    expect(applyConfidenceRule(makeFinding({ ...base, confidence: 0.4 })).severity).toBe(
      'question',
    );
    expect(applyConfidenceRule(makeFinding({ ...base, confidence: 0.5 })).severity).toBe('S1');
    expect(
      applyConfidenceRule(makeFinding({ ...base, severity: 'praise', confidence: 0.1 })).severity,
    ).toBe('praise');
  });
  it('caps generated files at S2 and third-party code at S3', () => {
    expect(capSeverity('S0', 'S2')).toBe('S2');
    expect(capSeverity('S3', 'S2')).toBe('S3');
    expect(capSeverity('S1', 'S3')).toBe('S3');
    expect(capSeverity('question', 'S2')).toBe('question');
  });
  it('dedupes within a reviewer only and keeps the most severe', () => {
    const a = makeFinding({ ...base, severity: 'S2' });
    const b = makeFinding({ ...base, severity: 'S1' });
    const other = makeFinding({ ...base, reviewer: 'security' });
    const out = dedupeWithinReviewer([a, b, other]);
    expect(out).toHaveLength(2);
    expect(out.find((f) => f.reviewer === 'correctness')?.severity).toBe('S1');
  });
});
