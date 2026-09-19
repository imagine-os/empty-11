import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PKG_ROOT } from '../scripts/paths.js';
import { findingId } from '../src/finding.js';
import {
  GATE_KINDS,
  GATE_REPORT_SCHEMAS,
  GATE_REPORT_VERSION,
  Gate1ReportSchema,
  type GateReportOf,
  SUPPORTED_REPORT_VERSIONS,
  VisualReportSchema,
} from '../src/gates/index.js';
import { detectKind, parseArtifact, readGateReport, validateArtifact } from '../src/validate.js';

const FIXTURES = resolve(PKG_ROOT, 'fixtures');
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8'));

describe('pass fixtures', () => {
  it('exist for every kind and validate by kind, by auto-detection and by file name', () => {
    for (const kind of GATE_KINDS) {
      const name = `${kind}.pass.json`;
      expect(existsSync(resolve(FIXTURES, name)), name).toBe(true);
      const doc = fixture(name);
      const byKind = validateArtifact(kind, doc);
      expect(byKind.ok, `${name} by kind: ${JSON.stringify(!byKind.ok && byKind.issues)}`).toBe(
        true,
      );
      expect(validateArtifact('auto', doc).ok, `${name} auto`).toBe(true);
      expect(readGateReport(`reports/${kind}.json`, doc).ok, `${name} by file name`).toBe(true);
      expect(detectKind(doc)).toBe(kind);
      expect(GATE_REPORT_SCHEMAS[kind].safeParse(doc).success).toBe(true);
    }
  });
  it('gate1.fail.json validates and keeps its S1 finding', () => {
    const r = parseArtifact('gate1', fixture('gate1.fail.json'));
    expect(r.status).toBe('fail');
    expect(r.findings[0]?.severity).toBe('S1');
    expect(r.data.failures[0]?.job).toBe('lint');
  });
  it('every finding id in a fixture is the deterministic findingId of its fields', () => {
    for (const kind of GATE_KINDS) {
      const r = validateArtifact(kind, fixture(`${kind}.pass.json`));
      if (!r.ok) throw new Error(kind);
      for (const f of r.report.findings) {
        expect(f.id, `${kind}: ${f.title}`).toBe(
          findingId(f.reviewer, f.rubricId, f.file, f.title),
        );
      }
    }
  });
  it('a fixture validated against the wrong kind fails at kind', () => {
    const r = validateArtifact('gate1', fixture('visual.pass.json'));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues[0]?.path).toBe('kind');
  });
});

/** Invalid fixtures and the path of the first issue each must report. */
const INVALID: [string, string, RegExp?][] = [
  ['visual.bad-severity.json', 'findings.0.severity'],
  ['gate1.bad-status.json', 'status'],
  ['security.pass-with-s0.json', 'status', /gate rule/],
  ['videos.unknown-key.json', '', /Unrecognized key: "oops"/],
  ['perf.wrong-kind.json', 'kind', /unknown artifact kind/],
  ['coverage.time-travel.json', 'finishedAt'],
  ['edgecases.absolute-path.json', 'artifacts.0.path'],
  ['visual.unsupported-version.json', 'version', /unsupported report version 2/],
];

describe('invalid fixtures', () => {
  it.each(INVALID)('%s fails with its first issue at %s', (name, path, message) => {
    const r = validateArtifact('auto', fixture(name));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0]?.path).toBe(path);
    if (message) expect(r.issues[0]?.message).toMatch(message);
  });
  it('every fixture in the folder is covered by a test', () => {
    const files = readdirSync(FIXTURES).filter(
      (f) => f.endsWith('.json') && f !== 'sample-review.json',
    );
    const covered = new Set([
      ...GATE_KINDS.map((k) => `${k}.pass.json`),
      'gate1.fail.json',
      ...INVALID.map(([n]) => n),
    ]);
    expect(files.sort()).toEqual([...covered].sort());
  });
  it('parseArtifact throws with the issues listed', () => {
    expect(() => parseArtifact('visual', fixture('visual.bad-severity.json'))).toThrow(
      /findings\.0\.severity/,
    );
  });
  it('a document without a kind, or not an object, is rejected at kind', () => {
    expect(validateArtifact('auto', {})).toMatchObject({ ok: false, issues: [{ path: 'kind' }] });
    expect(validateArtifact('auto', 'x')).toMatchObject({ ok: false });
    expect(readGateReport('reports/nope.json', {})).toMatchObject({ ok: false, kind: undefined });
  });
});

describe('envelope rules', () => {
  const base = fixture('visual.pass.json') as GateReportOf<'visual'>;
  it('is version 1 and the only supported version today', () => {
    expect(GATE_REPORT_VERSION).toBe(1);
    expect(SUPPORTED_REPORT_VERSIONS).toEqual([1]);
    expect(base.version).toBe(1);
  });
  it('requires a summary on every status, including error and skipped', () => {
    for (const status of ['error', 'skipped'] as const) {
      expect(VisualReportSchema.safeParse({ ...base, status, summary: '' }).success).toBe(false);
      expect(
        VisualReportSchema.safeParse({ ...base, status, summary: 'runner died' }).success,
      ).toBe(true);
    }
  });
  it('a gate that errored with no findings is a valid error report, never an empty pass by accident', () => {
    const errored = {
      ...base,
      status: 'error',
      findings: [],
      summary: 'API unavailable after 3 retries',
      data: { images: [], sheets: [] },
    };
    expect(VisualReportSchema.safeParse(errored).success).toBe(true);
  });
  it('accepts an optional producer ActorRef and rejects a malformed one', () => {
    const producer = {
      id: '01923f6e-1c2b-7d3e-9a4f-0b1c2d3e4f5a',
      type: 'agent',
      character: 'sentinel',
    };
    expect(VisualReportSchema.safeParse({ ...base, producer }).success).toBe(true);
    expect(
      VisualReportSchema.safeParse({ ...base, producer: { id: 'nope', type: 'agent' } }).success,
    ).toBe(false);
  });
  it('a pass with more than three S1 findings is rejected at status', () => {
    const fail = fixture('gate1.fail.json') as GateReportOf<'gate1'>;
    const s1 = fail.findings[0];
    if (!s1) throw new Error('fixture has no finding');
    const four = [1, 2, 3, 4].map((n) => ({ ...s1, id: `${n}${s1.id.slice(1)}` }));
    const r = Gate1ReportSchema.safeParse({ ...fail, status: 'pass', findings: four });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.path.join('.')).toBe('status');
    expect(
      Gate1ReportSchema.safeParse({ ...fail, status: 'pass', findings: four.slice(0, 3) }).success,
    ).toBe(true);
  });
  it('pr is optional (main and nightly runs) and sha is 7..40 hex', () => {
    const { pr: _pr, ...noPr } = base;
    expect(VisualReportSchema.safeParse(noPr).success).toBe(true);
    expect(VisualReportSchema.safeParse({ ...base, sha: 'e525acd' }).success).toBe(true);
    expect(VisualReportSchema.safeParse({ ...base, sha: 'E525ACD' }).success).toBe(false);
  });
});
