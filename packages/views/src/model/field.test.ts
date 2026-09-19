import { describe, expect, expectTypeOf, it } from 'vitest';
import { loadJson } from '../test-helpers.js';
import {
  COMPUTED_FIELD_TYPES,
  FIELD_TYPE_OWNERS,
  FIELD_TYPES,
  type FieldDef,
  type FieldType,
  fieldDefSchema,
  fieldDefsSchema,
} from './field.js';

const minimal = { id: 'title', key: 'title', name: 'Title', type: 'text' } as const;

describe('FieldType', () => {
  it('is the 17 PAP-164 types plus geo, button and the reserved round-4 names', () => {
    const pap164 = [
      'text',
      'number',
      'currency',
      'date',
      'select',
      'multiSelect',
      'relation',
      'lookup',
      'rollup',
      'formula',
      'attachment',
      'user',
      'checkbox',
      'rating',
      'url',
      'email',
      'phone',
    ];
    expect(pap164).toHaveLength(17);
    for (const type of [...pap164, 'geo', 'button']) expect(FIELD_TYPES).toContain(type);
    expect(new Set(FIELD_TYPES).size).toBe(FIELD_TYPES.length);
    for (const type of FIELD_TYPES) expect(FIELD_TYPE_OWNERS[type]).toMatch(/^PAP-\d+$/);
  });

  it('narrows to the literal union', () => {
    expectTypeOf<FieldType>().toMatchTypeOf<string>();
    expectTypeOf<'geo'>().toMatchTypeOf<FieldType>();
    expectTypeOf<'button'>().toMatchTypeOf<FieldType>();
    // @ts-expect-error not a field type
    const bad: FieldType = 'barcode';
    expect(bad).toBe('barcode');
  });
});

describe('FieldDef', () => {
  it('applies defaults and keeps reserved round-4 keys', () => {
    const parsed = fieldDefSchema.parse({
      ...minimal,
      description: 'Shown as a header tooltip',
      group: 'Basics',
      defaultValue: { token: 'now' },
      permissions: { read: ['viewer'] },
    });
    expect(parsed).toMatchObject({
      options: {},
      required: false,
      unique: false,
      hidden: false,
      computed: false,
      group: 'Basics',
    });
    expectTypeOf(parsed).toEqualTypeOf<FieldDef>();
  });

  it('is strict and validates the key slug', () => {
    expect(fieldDefSchema.safeParse({ ...minimal, label: 'x' }).success).toBe(false);
    expect(fieldDefSchema.safeParse({ ...minimal, key: 'Title' }).success).toBe(false);
    expect(fieldDefSchema.safeParse({ ...minimal, key: 'a'.repeat(65) }).success).toBe(false);
    expect(fieldDefSchema.safeParse({ ...minimal, type: 'barcode' }).success).toBe(false);
  });

  it('requires computed: true for derived types', () => {
    for (const type of COMPUTED_FIELD_TYPES) {
      expect(fieldDefSchema.safeParse({ ...minimal, type }).success, type).toBe(false);
      expect(fieldDefSchema.safeParse({ ...minimal, type, computed: true }).success, type).toBe(
        true,
      );
    }
  });
});

describe('FieldDef[]', () => {
  it('parses both dataset fixtures', () => {
    const tasks = loadJson('datasets/tasks.dataset.json') as { fields: unknown };
    const memberships = loadJson('datasets/memberships.dataset.json') as { fields: unknown };
    expect(fieldDefsSchema.parse(tasks.fields)).toHaveLength(15);
    expect(fieldDefsSchema.parse(memberships.fields)).toHaveLength(7);
  });

  it('rejects duplicate keys and duplicate ids with the offending path', () => {
    const dupKey = fieldDefsSchema.safeParse([minimal, { ...minimal, id: 'title2' }]);
    expect(dupKey.success).toBe(false);
    expect(dupKey.error?.issues.map((i) => i.path.join('.'))).toContain('1.key');
    const dupId = fieldDefsSchema.safeParse([minimal, { ...minimal, key: 'title2' }]);
    expect(dupId.success).toBe(false);
    expect(dupId.error?.issues.map((i) => i.path.join('.'))).toContain('1.id');
  });

  it('accepts 500 fields and rejects 501', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...minimal, id: `f${i}`, key: `f${i}` }));
    expect(fieldDefsSchema.safeParse(many(500)).success).toBe(true);
    const tooMany = fieldDefsSchema.safeParse(many(501));
    expect(tooMany.success).toBe(false);
    expect(tooMany.error?.issues[0]?.message).toMatch(/at most 500/);
  });
});
