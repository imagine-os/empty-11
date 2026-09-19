import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SpecIssue } from './issues.js';
import { parseSpec } from './parse.js';

const fixtures = resolve(import.meta.dirname, '../fixtures');
const pages = resolve(import.meta.dirname, '../../../specs/pages');

interface Expected {
  code: string;
  severity?: string;
  path?: string;
  line?: number;
  col?: number;
  hintIncludes?: string;
  messageIncludes?: string;
  relatedLines?: number[];
}

const specFiles = (dir: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.spec.yaml'))
    .sort();

describe('fixtures/valid', () => {
  for (const file of specFiles(resolve(fixtures, 'valid'))) {
    it(`${file} parses without errors`, () => {
      const result = parseSpec(readFileSync(resolve(fixtures, 'valid', file), 'utf8'), {
        filename: file,
      });
      expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
      if (!result.ok) return;
      expect(result.value.meta.id).toBe(file.replace('.spec.yaml', ''));
      expect(result.value.meta.specVersion).toBe(1);
      for (const issue of result.issues) expect(issue.severity).toBe('warning');
    });
  }

  it('reserved-keys warns once per reserved key and once for the missing version', () => {
    const result = parseSpec(
      readFileSync(resolve(fixtures, 'valid/reserved-keys.spec.yaml'), 'utf8'),
    );
    const codes = result.issues.map((i) => `${i.code}:${i.path}`);
    expect(codes).toEqual([
      'SPEC_VERSION_MISSING:meta',
      'SPEC_RESERVED_KEY:flags',
      'SPEC_RESERVED_KEY:help',
    ]);
    expect(result.ok && result.value.meta.specVersion).toBe(1);
    expect(result.ok && result.value['x-i18n']).toEqual({ strict: false });
  });

  it('anchors and merge keys resolve before validation', () => {
    const result = parseSpec(
      readFileSync(resolve(fixtures, 'valid/anchors-merge.spec.yaml'), 'utf8'),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.components.map((c) => [c.id, c.key, c.slot])).toEqual([
      ['ui.button', 'saveButton', 'main'],
      ['ui.button', 'cancelButton', 'main'],
    ]);
    expect(result.value.states.error?.component).toBe('ui.errorState');
  });
});

describe('fixtures/invalid', () => {
  for (const file of specFiles(resolve(fixtures, 'invalid'))) {
    it(`${file} fails with the expected codes and positions`, () => {
      const expected = JSON.parse(
        readFileSync(
          resolve(fixtures, 'invalid', file.replace('.spec.yaml', '.expected.json')),
          'utf8',
        ),
      ) as Expected[];
      const result = parseSpec(readFileSync(resolve(fixtures, 'invalid', file), 'utf8'), {
        filename: file,
      });
      expect(result.ok).toBe(false);
      for (const want of expected) {
        const match = result.issues.find((issue) => matches(issue, want));
        expect(
          match,
          `expected ${JSON.stringify(want)} in\n${render(result.issues)}`,
        ).toBeDefined();
      }
      for (const issue of result.issues) {
        expect(issue.path).toBeTypeOf('string');
        expect(issue.line, `${issue.code} at ${issue.path} has no line`).toBeTypeOf('number');
        expect(issue.col).toBeTypeOf('number');
      }
    });
  }
});

describe('specs/pages examples', () => {
  for (const file of specFiles(pages)) {
    it(`${file} is a clean spec (no issues at all)`, () => {
      const result = parseSpec(readFileSync(resolve(pages, file), 'utf8'), { filename: file });
      expect(result.ok, render(result.issues)).toBe(true);
      expect(result.issues).toEqual([]);
    });
  }
});

function matches(issue: SpecIssue, want: Expected): boolean {
  if (issue.code !== want.code) return false;
  if (want.severity !== undefined && issue.severity !== want.severity) return false;
  if (want.path !== undefined && issue.path !== want.path) return false;
  if (want.line !== undefined && issue.line !== want.line) return false;
  if (want.col !== undefined && issue.col !== want.col) return false;
  if (want.hintIncludes !== undefined && !(issue.hint ?? '').includes(want.hintIncludes))
    return false;
  if (want.messageIncludes !== undefined && !issue.message.includes(want.messageIncludes))
    return false;
  if (want.relatedLines !== undefined) {
    const lines = (issue.related ?? []).map((r) => r.line);
    if (JSON.stringify(lines) !== JSON.stringify(want.relatedLines)) return false;
  }
  return true;
}

function render(issues: SpecIssue[]): string {
  return issues
    .map(
      (i) =>
        `${i.severity} ${i.code} ${i.path} ${i.line ?? '-'}:${i.col ?? '-'} ${i.message} ${i.hint ?? ''}`,
    )
    .join('\n');
}
