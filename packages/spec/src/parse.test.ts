import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { errorsOf } from './issues.js';
import { normaliseSource, parseSpec } from './parse.js';

const valid = readFileSync(
  resolve(import.meta.dirname, '../fixtures/valid/customer-invoices.spec.yaml'),
  'utf8',
);

describe('parseSpec normalisation', () => {
  it('strips a BOM and CRLF without moving positions', () => {
    const lf = parseSpec(valid);
    const crlf = parseSpec(`﻿${valid.replace(/\n/g, '\r\n')}`);
    expect(crlf.ok).toBe(true);
    expect(crlf.issues).toEqual(lf.issues);
    expect(crlf.ok && lf.ok && crlf.value).toEqual(lf.ok && lf.value);
    expect(normaliseSource('﻿a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('keeps the same positions for a broken CRLF document', () => {
    const broken = valid.replace('route: /invoices', 'route: /invoices/:id');
    const a = parseSpec(broken);
    const b = parseSpec(broken.replace(/\n/g, '\r\n'));
    expect(a.ok).toBe(false);
    expect(b.issues.map((i) => [i.code, i.line, i.col])).toEqual(
      a.issues.map((i) => [i.code, i.line, i.col]),
    );
  });

  it('warns when the schema header is missing', () => {
    const result = parseSpec(valid.split('\n').slice(1).join('\n'));
    expect(result.ok).toBe(true);
    expect(result.issues.map((i) => i.code)).toEqual(['SPEC_SCHEMA_HEADER']);
    expect(result.issues[0]).toMatchObject({ line: 1, col: 1, severity: 'warning' });
  });

  it('warns over the size limit and suggests splitting', () => {
    const result = parseSpec(valid, { sizeLimitBytes: 100 });
    expect(result.ok).toBe(true);
    expect(result.issues[0]).toMatchObject({ code: 'SPEC_TOO_LARGE', severity: 'warning' });
    expect(result.issues[0]?.hint).toContain('split');
  });

  it('does not warn under 200 KB', () => {
    expect(parseSpec(valid).issues).toEqual([]);
  });
});

describe('parseSpec document rules', () => {
  it('reports SPEC_DUP_KEY with both lines and keeps the last value', () => {
    const result = parseSpec(`${valid}\nmeta:\n  id: customer-invoices\n`);
    expect(result.ok).toBe(false);
    const dup = result.issues.find((i) => i.code === 'SPEC_DUP_KEY');
    expect(dup?.message).toMatch(/lines 3 and \d+/);
    expect(dup?.related?.[0]?.line).toBe(3);
  });

  it('passes x-* keys through untouched and defaults specVersion', () => {
    const source = valid.replace('  specVersion: 1\n', '');
    const result = parseSpec(`${source}\nx-owner-notes: { reviewer: sentinel }\n`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value['x-owner-notes']).toEqual({ reviewer: 'sentinel' });
    expect(result.value['x-notes']).toBeTypeOf('string');
    expect(result.value.meta.specVersion).toBe(1);
    expect(result.issues.map((i) => i.code)).toEqual(['SPEC_VERSION_MISSING']);
  });

  it('rejects a non-mapping document', () => {
    const result = parseSpec('# yaml-language-server: $schema=x\n- just\n- a list\n');
    expect(result.ok).toBe(false);
    expect(errorsOf(result.issues)[0]?.code).toBe('SPEC_NOT_OBJECT');
  });

  it('reports the file name mismatch', () => {
    const result = parseSpec(valid, { filename: 'specs/pages/invoices.spec.yaml' });
    expect(result.ok).toBe(false);
    expect(errorsOf(result.issues)[0]).toMatchObject({
      code: 'SPEC_ID_FILENAME',
      path: 'meta.id',
      line: 4,
    });
    expect(errorsOf(result.issues)[0]?.hint).toContain('customer-invoices.spec.yaml');
  });

  it('resolves events[].to against knownRoutes', () => {
    const ready = parseSpec(valid, { knownRoutes: ['/invoices', '/settings'] });
    expect(ready.ok).toBe(false);
    expect(errorsOf(ready.issues).map((i) => [i.code, i.path])).toEqual([
      ['SPEC_ROUTE_UNRESOLVED', 'events[0].to'],
      ['SPEC_ROUTE_UNRESOLVED', 'events[2].to'],
    ]);

    const draft = parseSpec(valid.replace('status: ready', 'status: draft'), {
      knownRoutes: ['/invoices'],
    });
    expect(draft.ok).toBe(true);
    expect(
      draft.issues.every((i) => i.code === 'SPEC_ROUTE_UNRESOLVED' && i.severity === 'warning'),
    ).toBe(true);

    const resolved = parseSpec(valid, { knownRoutes: ['/invoices/$invoiceId/'] });
    expect(resolved.ok).toBe(true);
    expect(resolved.issues).toEqual([]);
  });
});
