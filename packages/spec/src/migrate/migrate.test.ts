import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { SpecError } from '../issues.js';
import { PageSpecSchema } from '../schema/page.js';
import {
  CURRENT_SPEC_VERSION,
  findSpecVersion,
  migrateSpec,
  readSpecVersion,
  SPEC_VERSIONS,
} from './index.js';

const v1 = `# yaml-language-server: $schema=../../schema/page.spec.schema.json
meta:
  id: m
  title: m.meta.title
  route: /m
  surface: staff
  owner: spec-builder
  specVersion: 1
purpose:
  summary: Migration fixture.
layout:
  template: app
x-team: platform # comment kept
x-i18n: { strict: true }
`;

describe('version registry', () => {
  it('has exactly version 1 pointing at PageSpecSchema with no codemods', () => {
    expect(CURRENT_SPEC_VERSION).toBe(1);
    expect(SPEC_VERSIONS).toEqual([{ version: 1, schema: PageSpecSchema, codemodsFrom: {} }]);
    expect(findSpecVersion(1)?.schema).toBe(PageSpecSchema);
    expect(findSpecVersion(2)).toBeUndefined();
  });
});

describe('migrateSpec', () => {
  it('is the identity for specVersion 1 and leaves x-* keys and comments untouched', () => {
    const doc = parseDocument(v1);
    const before = doc.toString();
    const result = migrateSpec(doc);
    expect(result).toMatchObject({ from: 1, to: 1, changes: [], issues: [] });
    expect(result.doc).toBe(doc);
    expect(result.doc.toString()).toBe(before);
    expect(result.doc.get('x-team')).toBe('platform');
    expect(result.doc.toString()).toContain('# comment kept');
  });

  it('treats a missing specVersion as 1 with a warning', () => {
    const doc = parseDocument(v1.replace('  specVersion: 1\n', ''));
    expect(readSpecVersion(doc)).toBeUndefined();
    const result = migrateSpec(doc);
    expect(result.from).toBe(1);
    expect(result.issues.map((i) => [i.code, i.severity])).toEqual([
      ['SPEC_VERSION_MISSING', 'warning'],
    ]);
    expect(result.doc.toString()).not.toContain('specVersion');
  });

  it('throws SPEC_UNSUPPORTED_VERSION for version 2 and for an unregistered target', () => {
    const doc = parseDocument(v1.replace('specVersion: 1', 'specVersion: 2'));
    expect(readSpecVersion(doc)).toBe(2);
    let caught: unknown;
    try {
      migrateSpec(doc);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SpecError);
    expect((caught as SpecError).issue).toMatchObject({
      code: 'SPEC_UNSUPPORTED_VERSION',
      path: 'meta.specVersion',
      severity: 'error',
    });
    expect(() => migrateSpec(parseDocument(v1), 3)).toThrow(SpecError);
    expect(() =>
      migrateSpec(parseDocument(v1.replace('specVersion: 1', 'specVersion: one'))),
    ).toThrow(/one/);
  });
});
