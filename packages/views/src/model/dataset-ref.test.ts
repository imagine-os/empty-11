import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DATASET_LIMITS,
  type DatasetRef,
  datasetRefKeySchema,
  datasetRefSchema,
  formatDatasetRef,
  parseDatasetRef,
  sameDatasetRef,
} from './dataset-ref.js';

const ID = '0192a000-0000-7000-8000-0000000000d1';

describe('DatasetRef', () => {
  it('accepts the two object forms and rejects unknown keys', () => {
    expect(datasetRefSchema.parse({ kind: 'entity', key: 'memberships' })).toEqual({
      kind: 'entity',
      key: 'memberships',
    });
    expect(datasetRefSchema.parse({ kind: 'custom', datasetId: ID })).toEqual({
      kind: 'custom',
      datasetId: ID,
    });
    expect(datasetRefSchema.safeParse({ kind: 'entity', key: 'memberships', x: 1 }).success).toBe(
      false,
    );
    expect(datasetRefSchema.safeParse({ kind: 'custom', key: 'memberships' }).success).toBe(false);
  });

  it('round-trips the string grammar entity:key | custom:id', () => {
    const entity: DatasetRef = { kind: 'entity', key: 'pm_issue' };
    const custom: DatasetRef = { kind: 'custom', datasetId: ID };
    expect(formatDatasetRef(entity)).toBe('entity:pm_issue');
    expect(formatDatasetRef(custom)).toBe(`custom:${ID}`);
    expect(parseDatasetRef('entity:pm_issue')).toEqual(entity);
    expect(parseDatasetRef(`custom:${ID}`)).toEqual(custom);
    expect(sameDatasetRef(entity, parseDatasetRef(formatDatasetRef(entity)))).toBe(true);
  });

  it('rejects malformed keys with a path', () => {
    for (const bad of [
      'memberships',
      'entity:',
      'entity:Memberships',
      'entity:1abc',
      `custom:${ID.replace('-7', '-4')}`,
      'custom:not-a-uuid',
      'table:memberships',
    ]) {
      const result = datasetRefKeySchema.safeParse(bad);
      expect(result.success, bad).toBe(false);
    }
  });

  it('fixes the custom dataset limits from the spec', () => {
    expect(DATASET_LIMITS).toEqual({ maxFields: 500, maxRecordBytes: 100_000 });
  });

  it('types the union by kind', () => {
    expectTypeOf<DatasetRef>().toEqualTypeOf<
      { kind: 'entity'; key: string } | { kind: 'custom'; datasetId: string }
    >();
  });
});
