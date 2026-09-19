import { describe, expect, it } from 'vitest';
import { RUBRIC_ID_PATTERN } from '../src/finding.js';
import {
  allRubricItems,
  DOMAIN_CODE,
  findRubricItem,
  RUBRIC_DOMAINS,
  RUBRICS,
  rubricExists,
  rubricsForReviewer,
  SEVERITY_TAXONOMY,
} from '../src/rubrics.js';

describe('rubric registry', () => {
  it('has all eight domains with sequential ids', () => {
    expect(Object.keys(RUBRICS).sort()).toEqual([...RUBRIC_DOMAINS].sort());
    for (const r of Object.values(RUBRICS)) {
      expect(r.code).toBe(DOMAIN_CODE[r.domain]);
      r.items.forEach((item, i) => {
        expect(item.id).toBe(`RUB-${r.code}-${String(i + 1).padStart(2, '0')}`);
        expect(item.id).toMatch(RUBRIC_ID_PATTERN);
      });
    }
  });
  it('every item has a one-line test, a verification note and a false-positive note', () => {
    for (const item of allRubricItems()) {
      expect(item.test.length).toBeGreaterThan(20);
      expect(item.verify.length).toBeGreaterThan(20);
      expect(item.falsePositives.length).toBeGreaterThan(5);
      expect(item.test.split('\n')).toHaveLength(1);
    }
    expect(allRubricItems().length).toBeGreaterThanOrEqual(70);
  });
  it('ids are unique across domains', () => {
    const ids = allRubricItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('security items cite SEC-* controls, including the two PAP-80 anchors', () => {
    for (const item of RUBRICS.security.items) expect(item.controls?.length).toBeGreaterThan(0);
    expect(findRubricItem('RUB-SEC-01')?.item.controls).toContain('SEC-API-01');
    expect(findRubricItem('RUB-SEC-02')?.item.controls).toContain('SEC-DB-02');
  });
  it('lookups work', () => {
    expect(rubricExists('RUB-DOC-03')).toBe(true);
    expect(rubricExists('RUB-DOC-99')).toBe(false);
    expect(findRubricItem('RUB-VIS-03')?.item.typicalSeverity).toBe('S2');
    expect(rubricsForReviewer('security').map((r) => r.domain)).toContain('security');
    expect(rubricsForReviewer('nobody')).toHaveLength(0);
  });
  it('the severity taxonomy names the six severities and the gate rule', () => {
    expect(SEVERITY_TAXONOMY.severities.map((s) => s.id)).toEqual([
      'S0',
      'S1',
      'S2',
      'S3',
      'question',
      'praise',
    ]);
    expect(SEVERITY_TAXONOMY.gateRule.maxS1).toBe(3);
    expect(SEVERITY_TAXONOMY.gateRule.questionBelowConfidence).toBe(0.5);
    expect(SEVERITY_TAXONOMY.caps.map((c) => c.cap)).toEqual(['S2', 'S3']);
  });
});
