/**
 * The committed JSON Schema is generated. Two things must stay true: the file
 * on disk is exactly what the generator produces (drift), and it says the same
 * thing as the Zod schema it came from (ajv cross-check).
 */

import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { loadGoldenManifests, loadInvalidManifest } from './fixtures/load.js';
import { MANIFEST_SCHEMA_PATH, renderManifestJsonSchema } from './gen-schemas.js';
import { MODULE_MANIFEST_SCHEMA_ID, ModuleManifestSchema } from './manifest.js';

const committed = readFileSync(MANIFEST_SCHEMA_PATH, 'utf8');
const schema = JSON.parse(committed) as Record<string, unknown>;
const ajv = new Ajv2020({ strict: false, allErrors: true });
const validate = ajv.compile(schema);
const goldens = loadGoldenManifests();

describe('manifest.schema.json', () => {
  it('is identical to a fresh generation', () => {
    expect(committed).toBe(renderManifestJsonSchema());
  });

  it('carries the pinned $id', () => {
    expect(schema.$id).toBe(MODULE_MANIFEST_SCHEMA_ID);
    expect(schema).toHaveProperty('x-generated-by');
  });

  it('requires exactly the six documented fields', () => {
    expect(schema.required).toEqual([
      'id',
      'kind',
      'version',
      'owner',
      'provides',
      'requires',
      'swapRisk',
    ]);
    expect(schema.additionalProperties).toBe(false);
  });

  it.each(goldens.map((manifest) => [manifest.id, manifest] as const))(
    'accepts the %s golden',
    (_id, manifest) => {
      expect(validate(manifest), ajv.errorsText(validate.errors)).toBe(true);
      expect(ModuleManifestSchema.safeParse(manifest).success).toBe(true);
    },
  );

  /**
   * ajv and Zod must agree on everything JSON Schema can express. `version`
   * and `range` are the two fields it cannot: they are `type: string` in JSON
   * Schema and a semver parse in Zod, so those fixtures are Zod-only.
   */
  it.each([
    ['schema-invalid.json', true],
    ['owner-unknown.json', false],
  ])('%s: ajv rejects it too = %s', (file, ajvRejects) => {
    const manifest = loadInvalidManifest(file);
    expect(validate(manifest)).toBe(!ajvRejects);
  });

  it('is stricter in Zod than in ajv only for semver', () => {
    const golden = { ...goldens[0], version: 'not-semver' };
    expect(validate(golden)).toBe(true);
    expect(ModuleManifestSchema.safeParse(golden).success).toBe(false);
  });
});
