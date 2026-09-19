import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { goldenFixtures, invalidFixtures, loadJson, SCHEMA_DIR } from '../test-helpers.js';
import { buildViewSpecJsonSchema, GENERATED_SCHEMAS } from './json-schema.js';

function committed(file: string): unknown {
  return JSON.parse(readFileSync(resolve(SCHEMA_DIR, file), 'utf8'));
}

function compile(schema: unknown) {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema as object);
}

describe('generated JSON Schema', () => {
  it.each(Object.keys(GENERATED_SCHEMAS))(
    'schema/%s is committed and not stale (run gen:schemas)',
    (file) => {
      const build = GENERATED_SCHEMAS[file];
      expect(build).toBeDefined();
      expect(committed(file)).toEqual(build?.());
    },
  );

  it('identifies the view schema with the spec version', () => {
    const schema = buildViewSpecJsonSchema();
    expect(schema.$id).toBe('https://paperos.dev/schema/view/3');
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.title).toBe('ViewSpec');
  });

  it('validates every golden fixture with ajv', () => {
    const validate = compile(committed('view.schema.json'));
    for (const { file, spec } of goldenFixtures()) {
      expect(validate(spec), `${file}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it('rejects the structurally invalid fixtures (refinement-only ones are Zod-only)', () => {
    const validate = compile(committed('view.schema.json'));
    const zodOnly = new Set(['duplicate-field.view.json', 'public-without-sharing.view.json']);
    for (const { file, spec } of invalidFixtures()) {
      const ok = validate(spec);
      if (zodOnly.has(file)) {
        expect(ok, `${file} is a refinement: JSON Schema cannot reject it`).toBe(true);
      } else {
        expect(ok, `${file} should be rejected by JSON Schema`).toBe(false);
      }
    }
  });

  it('validates the field lists of both dataset fixtures', () => {
    const validate = compile(committed('field-def.schema.json'));
    for (const name of ['tasks', 'memberships']) {
      const dataset = loadJson(`datasets/${name}.dataset.json`) as { fields: unknown[] };
      for (const field of dataset.fields) {
        expect(validate(field), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true);
      }
    }
    expect(validate({ id: 'x', key: 'x', name: 'x', type: 'barcode' })).toBe(false);
  });

  it('validates dataset refs', () => {
    const validate = compile(committed('dataset-ref.schema.json'));
    expect(validate({ kind: 'entity', key: 'memberships' })).toBe(true);
    expect(validate({ kind: 'custom', datasetId: '0192a000-0000-7000-8000-0000000000d1' })).toBe(
      true,
    );
    expect(validate({ kind: 'entity', key: 'Memberships' })).toBe(false);
    expect(validate({ kind: 'custom', datasetId: 'nope' })).toBe(false);
  });
});
