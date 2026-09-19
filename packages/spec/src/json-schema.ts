/**
 * JSON Schema (draft 2020-12) generated from `PageSpecSchema`. Never hand-written:
 * `pnpm --filter @paperos/spec gen:schemas` writes `schema/page.spec.schema.json`
 * and a Vitest drift test fails when the committed copy is stale.
 */
import { z } from 'zod';
import { KNOWN_STATES, PageSpecSchema, RESERVED_KEYS, StatesSectionSchema } from './schema/page.js';

export const PAGE_SPEC_SCHEMA_ID =
  'https://imagine-os.github.io/paperos-template/schema/page.spec.v1.json';

export type JsonSchema = Record<string, unknown>;

/** Build the JSON Schema for a page spec. Deterministic: same input, same output. */
export function buildPageJsonSchema(): JsonSchema {
  const schema = z.toJSONSchema(PageSpecSchema, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'any',
    override: (ctx) => {
      // The five standard states show up as completions; custom states still pass the key grammar.
      if (ctx.zodSchema === StatesSectionSchema) {
        const value = ctx.jsonSchema.additionalProperties;
        if (value && typeof value === 'object') {
          ctx.jsonSchema.properties = Object.fromEntries(KNOWN_STATES.map((name) => [name, value]));
        }
      }
    },
  }) as JsonSchema;

  // Top level: known keys and `x-*` extensions only. Zod emits `additionalProperties: {}` for the
  // catchall; the validator's rule is stricter and the editor should say so.
  schema.additionalProperties = false;
  schema.patternProperties = { '^x-': { description: 'Extension key; passes through untouched.' } };

  const ordered: JsonSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: PAGE_SPEC_SCHEMA_ID,
    title: schema.title,
    description: schema.description,
    'x-paperos': {
      specVersion: 1,
      generatedBy: 'pnpm --filter @paperos/spec gen:schemas',
      reservedKeys: [...RESERVED_KEYS],
    },
  };
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$schema' || key === 'title' || key === 'description') continue;
    ordered[key] = value;
  }
  return sortDefs(ordered);
}

function sortDefs(schema: JsonSchema): JsonSchema {
  const defs = schema.$defs;
  if (defs && typeof defs === 'object') {
    const sorted = Object.fromEntries(
      Object.entries(defs as JsonSchema).sort(([a], [b]) => a.localeCompare(b)),
    );
    return { ...schema, $defs: sorted };
  }
  return schema;
}

export function renderPageJsonSchema(): string {
  return `${JSON.stringify(buildPageJsonSchema(), null, 2)}\n`;
}
