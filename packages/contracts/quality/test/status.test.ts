import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GATES_DOC } from '../scripts/paths.js';
import {
  artifactFileName,
  GATE_KIND_INFO,
  GATE_KINDS,
  kindFromFileName,
} from '../src/gates/index.js';
import {
  AGGREGATE_STATUS,
  GATE_STATES,
  GATE_STATUS_INFO,
  GATE_STATUSES,
  GateStatusNameSchema,
  isGateStatusName,
} from '../src/status.js';

/** The twelve statuses named in the PAP-239 spec, verbatim. */
const SPEC_STATUSES = [
  'gate/1-static',
  'gate/1-security',
  'gate/1-perf',
  'gate/2-correctness',
  'gate/2-security',
  'gate/2-spec',
  'gate/2-review',
  'gate/3-visual',
  'gate/3-video',
  'gate/3-vision',
  'gate/3-e2e',
  'gate/4-edge',
];
/** Round-4 additions PAP-462 names. */
const ROUND4_STATUSES = ['gate/2-docs', 'gate/1-coverage', 'gate/1-migrations', 'gate/dast'];

describe('status registry', () => {
  it('contains the spec statuses and the round-4 additions, nothing else, no duplicates', () => {
    expect([...GATE_STATUSES].sort()).toEqual([...SPEC_STATUSES, ...ROUND4_STATUSES].sort());
    expect(new Set(GATE_STATUSES).size).toBe(GATE_STATUSES.length);
    expect(GATE_STATUSES.length).toBe(16);
  });
  it('rejects a typo at runtime and at the type level', () => {
    expect(GateStatusNameSchema.safeParse('gate/1-statc').success).toBe(false);
    expect(isGateStatusName('gate/1-static')).toBe(true);
    expect(isGateStatusName('gates/required')).toBe(false);
    // @ts-expect-error a misspelt status is not a GateStatusName
    const bad: (typeof GATE_STATUSES)[number] = 'gate/1-statc';
    expect(bad).toBeDefined();
  });
  it('is not the aggregate status', () => {
    expect(AGGREGATE_STATUS).toBe('gates/required');
    expect((GATE_STATUSES as readonly string[]).includes(AGGREGATE_STATUS)).toBe(false);
  });
  it('has four gate states', () => {
    expect(GATE_STATES).toEqual(['pass', 'fail', 'error', 'skipped']);
  });
  it('every status has docs info and is produced by at least one kind', () => {
    for (const s of GATE_STATUSES) {
      expect(GATE_STATUS_INFO[s].owner, s).toMatch(/^PAP-\d+$/);
      const producers = GATE_KINDS.filter((k) => GATE_KIND_INFO[k].statuses.includes(s));
      expect(producers.length, `${s} has no producing kind`).toBeGreaterThan(0);
    }
  });
});

describe('kind registry', () => {
  it('lists the nine spec kinds plus the round-4 kinds PAP-462 names, no duplicates', () => {
    const spec = [
      'gate1',
      'security',
      'visual',
      'videos',
      'vision',
      'edgecases',
      'perf',
      'review-cost',
      'flakes-delta',
    ];
    const round4 = [
      'review',
      'certification',
      'calibration',
      'conformance',
      'coverage',
      'migrations',
      'mutation',
      'e2e',
    ];
    expect([...GATE_KINDS].sort()).toEqual([...spec, ...round4].sort());
    expect(new Set(GATE_KINDS).size).toBe(GATE_KINDS.length);
  });
  it('maps kinds to file names and back', () => {
    for (const k of GATE_KINDS) {
      expect(artifactFileName(k)).toBe(`${k}.json`);
      expect(kindFromFileName(`reports/${k}.json`)).toBe(k);
      expect(kindFromFileName(k)).toBe(k);
    }
    expect(kindFromFileName('reports/lighthouse.json')).toBeUndefined();
    expect(kindFromFileName('reports/visual/sheets/home.png')).toBeUndefined();
  });
  it('the docs table names every kind, file and status (registry completeness against the docs)', () => {
    const doc = readFileSync(GATES_DOC, 'utf8');
    for (const k of GATE_KINDS) expect(doc, k).toContain(`\`reports/${k}.json\``);
    for (const s of GATE_STATUSES) expect(doc, s).toContain(`\`${s}\``);
    expect(doc).toContain('## Artifacts and statuses');
  });
});
