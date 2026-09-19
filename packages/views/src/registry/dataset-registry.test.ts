import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { DatasetRef } from '../model/dataset-ref.js';
import type { FieldDefInput } from '../model/field.js';
import { viewSpecSchema } from '../model/view.js';
import { loadJson } from '../test-helpers.js';
import {
  createDatasetRegistry,
  type DatasetDefinition,
  DatasetRegistryError,
  type DatasetRegistryPort,
  datasetRegistry,
  getDataset,
  registerDataset,
  toEntityRef,
} from './dataset-registry.js';

type DatasetFixture = { key?: string; datasetId?: string; name: string; fields: FieldDefInput[] };
const memberships = loadJson('datasets/memberships.dataset.json') as DatasetFixture;
const tasks = loadJson('datasets/tasks.dataset.json') as DatasetFixture;

/** Stand-in for a Drizzle table object; the registry never looks inside it. */
const membershipTable = { _: { name: 'membership' } } as const;

describe('dataset registry', () => {
  let registry: DatasetRegistryPort;
  beforeEach(() => {
    registry = createDatasetRegistry();
  });

  it('exposes the memberships entity as a dataset', () => {
    const def = registry.register({
      key: 'memberships',
      name: memberships.name,
      table: membershipTable,
      fields: memberships.fields,
      rls: true,
    });
    expect(def.key).toBe('entity:memberships');
    expect(def.source).toBe('entity');
    expect(def.rls).toBe(true);
    expect(def.fields.map((f) => f.key)).toEqual([
      'user_id',
      'workspace_id',
      'role',
      'status',
      'invited_at',
      'accepted_at',
      'created_at',
    ]);
    expect(def.table).toBe(membershipTable);
    expectTypeOf(def).toEqualTypeOf<DatasetDefinition<typeof membershipTable>>();

    const ref: DatasetRef = { kind: 'entity', key: 'memberships' };
    expect(registry.get(ref)).toBe(def);
    expect(registry.get('entity:memberships')).toBe(def);
    expect(registry.has(ref)).toBe(true);
    expect(registry.resolve(ref).name).toBe('Memberships');
  });

  it('resolves the list view fixture against the memberships dataset', () => {
    registry.register({
      key: 'memberships',
      table: membershipTable,
      fields: memberships.fields,
      rls: true,
    });
    const list = viewSpecSchema.parse(loadJson('list.view.json'));
    const dataset = registry.resolve(list.datasetRef);
    const known = new Set(dataset.fields.map((f) => f.id));
    for (const field of list.fields) expect(known.has(field.fieldId)).toBe(true);
  });

  it('registers a custom dataset from its dataset row', () => {
    const def = registry.registerCustom({
      datasetId: tasks.datasetId as string,
      name: tasks.name,
      fields: tasks.fields,
    });
    expect(def.source).toBe('custom');
    expect(def.table).toBeUndefined();
    expect(def.rls).toBe(true);
    expect(registry.get(`custom:${tasks.datasetId}`)).toBe(def);
    expect(registry.list().map((d) => d.source)).toEqual(['custom']);
  });

  it('refuses duplicates and unknown refs with coded errors', () => {
    registry.register({
      key: 'memberships',
      table: membershipTable,
      fields: memberships.fields,
      rls: true,
    });
    expect(() =>
      registry.register({ key: 'memberships', table: membershipTable, fields: [], rls: true }),
    ).toThrow(DatasetRegistryError);
    try {
      registry.resolve('entity:nothing');
    } catch (error) {
      expect(error).toBeInstanceOf(DatasetRegistryError);
      expect((error as DatasetRegistryError).code).toBe('NOT_FOUND');
    }
    expect(registry.get({ kind: 'entity', key: 'nothing' })).toBeUndefined();
  });

  it('validates the field list at registration (duplicate keys, bad slugs)', () => {
    expect(() =>
      registry.register({
        key: 'Bad Key',
        table: membershipTable,
        fields: memberships.fields,
        rls: true,
      }),
    ).toThrow();
    expect(() =>
      registry.register({
        key: 'dup',
        table: membershipTable,
        fields: [memberships.fields[0] as FieldDefInput, memberships.fields[0] as FieldDefInput],
        rls: true,
      }),
    ).toThrow(/duplicate field/);
  });

  it('lists entity datasets before custom ones and can unregister', () => {
    registry.registerCustom({
      datasetId: tasks.datasetId as string,
      name: 'Tasks',
      fields: tasks.fields,
    });
    registry.register({
      key: 'memberships',
      table: membershipTable,
      fields: memberships.fields,
      rls: true,
    });
    expect(registry.list().map((d) => d.key)).toEqual([
      'entity:memberships',
      `custom:${tasks.datasetId}`,
    ]);
    expect(registry.unregister('entity:memberships')).toBe(true);
    expect(registry.unregister('entity:memberships')).toBe(false);
  });

  it('derives EntityRef.type from the dataset key', () => {
    const id = '0192a000-0000-7000-8000-0000000000e1';
    expect(toEntityRef({ kind: 'entity', key: 'memberships' }, id)).toEqual({
      type: 'memberships',
      id,
    });
    const custom = toEntityRef({ kind: 'custom', datasetId: tasks.datasetId as string }, id);
    expect(custom.type).toMatch(/^custom_[0-9a-f]{32}$/);
  });
});

describe('default registry helpers', () => {
  it('registerDataset and getDataset use the module-level registry', () => {
    datasetRegistry.clear();
    registerDataset({
      key: 'memberships',
      table: membershipTable,
      fields: memberships.fields,
      rls: true,
    });
    expect(getDataset('entity:memberships')?.name).toBe('memberships');
    datasetRegistry.clear();
    expect(getDataset('entity:memberships')).toBeUndefined();
  });
});
