import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIENCES_SCHEMA_ID, audiencesJsonSchema, audiencesSectionSchema } from './app-spec.js';
import { AUDIENCE_ID_PATTERN } from './audience.js';

const readJson = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));

describe('audiences: section of app.spec.yaml', () => {
  it('the committed JSON Schema equals a fresh generation (run gen:audience-schema when this fails)', () => {
    expect(readJson('./audiences.schema.json')).toEqual(audiencesJsonSchema());
  });

  it('the schema is draft 2020-12, self-identified, generated-marked and names the Segment def', () => {
    const schema = audiencesJsonSchema() as Record<string, unknown> & {
      $defs: Record<string, unknown>;
      propertyNames: { pattern: string };
    };
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe(AUDIENCES_SCHEMA_ID);
    expect(String(schema.$comment)).toMatch(/^GENERATED/);
    expect(schema.type).toBe('object');
    expect(schema.propertyNames.pattern).toBe(AUDIENCE_ID_PATTERN.source);
    expect(Object.keys(schema.$defs)).toEqual(['Segment']);
    expect(JSON.stringify(schema)).toContain('"$ref":"#/$defs/Segment"');
  });

  it('round-trips the fixture section through the Zod schema and JSON', () => {
    const section = readJson('./fixtures/app-spec.audiences.json').audiences;
    const parsed = audiencesSectionSchema.parse(section);
    expect(parsed).toEqual(section);
    expect(audiencesSectionSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it('rejects bad ids and bad declarations', () => {
    expect(
      audiencesSectionSchema.safeParse({
        'Bad Id': { name: 'x', description: 'y', match: { all: [] } },
      }).success,
    ).toBe(false);
    expect(
      audiencesSectionSchema.safeParse({ ok: { name: 'x', match: { all: [] } } }).success,
    ).toBe(false);
    expect(
      audiencesSectionSchema.safeParse({ ok: { name: 'x', description: 'y', match: { nope: 1 } } })
        .success,
    ).toBe(false);
    expect(
      audiencesSectionSchema.safeParse({
        ok: { name: 'x', description: 'y', match: { all: [] }, extra: 1 },
      }).success,
    ).toBe(false);
  });
});
