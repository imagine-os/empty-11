import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPageSpecDoc } from './docs.js';
import { SPEC_CODES } from './issues.js';
import { buildPageJsonSchema, PAGE_SPEC_SCHEMA_ID, renderPageJsonSchema } from './json-schema.js';

const schemaPath = resolve(import.meta.dirname, '../schema/page.spec.schema.json');
const docPath = resolve(import.meta.dirname, '../../../docs/platform/page-spec.md');
const regenerate = 'run `pnpm --filter @paperos/spec gen:schemas` and commit the result';

describe('generated JSON Schema', () => {
  it('committed schema/page.spec.schema.json is not stale', () => {
    const committed = JSON.parse(readFileSync(schemaPath, 'utf8'));
    expect(committed, regenerate).toEqual(buildPageJsonSchema());
  });

  it('committed docs/platform/page-spec.md is not stale', () => {
    expect(readFileSync(docPath, 'utf8'), regenerate).toBe(
      renderPageSpecDoc(buildPageJsonSchema()),
    );
  });

  it('is deterministic', () => {
    expect(renderPageJsonSchema()).toBe(renderPageJsonSchema());
  });

  it('declares draft 2020-12, the id, strict top level with x-* passthrough and named defs', () => {
    const schema = buildPageJsonSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe(PAGE_SPEC_SCHEMA_ID);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.patternProperties).toHaveProperty('^x-');
    expect(schema.required).toEqual(['meta', 'purpose', 'layout']);
    const defs = schema.$defs as Record<string, Record<string, unknown>>;
    for (const name of [
      'RouteRef',
      'ComponentRef',
      'MessageRef',
      'MessageKey',
      'PermissionRef',
      'Component',
      'FilterTree',
      'Meta',
      'Action',
    ]) {
      expect(defs, name).toHaveProperty(name);
    }
    expect(defs.RouteRef?.pattern).toContain('\\$');
    expect(Object.keys(defs)).toEqual([...Object.keys(defs)].sort((a, b) => a.localeCompare(b)));
    // Component tree is recursive through a $ref, standard states are completions.
    expect(JSON.stringify(defs.Component)).toContain('"#/$defs/Component"');
    const states = defs.StatesSection as { properties?: Record<string, unknown> } | undefined;
    expect(Object.keys(states?.properties ?? {})).toEqual([
      'loading',
      'empty',
      'error',
      'offline',
      'denied',
    ]);
    const meta = defs.Meta as { properties?: Record<string, unknown> } | undefined;
    expect(meta?.properties?.surface).toEqual({
      $ref: '#/$defs/Surface',
    });
  });

  it('the doc lists every issue code', () => {
    const doc = renderPageSpecDoc(buildPageJsonSchema());
    for (const code of Object.keys(SPEC_CODES)) expect(doc).toContain(`\`${code}\``);
    expect(doc).toContain('GENERATED');
  });
});
