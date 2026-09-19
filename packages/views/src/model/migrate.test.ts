import { describe, expect, it } from 'vitest';
import { loadJson } from '../test-helpers.js';
import {
  isCurrentViewSpec,
  migrateViewSpec,
  parseViewSpec,
  VIEW_SPEC_MIGRATIONS,
  ViewSpecVersionError,
} from './migrate.js';
import { VIEW_SPEC_VERSION, viewSpecSchema } from './view.js';

describe('migrateViewSpec', () => {
  const v1 = loadJson('migrations/v1-grid.view.json') as Record<string, unknown>;

  it('has one ordered step per version after v1, ending at the current version', () => {
    expect(VIEW_SPEC_MIGRATIONS.map((m) => m.to)).toEqual([2, 3]);
    expect(VIEW_SPEC_MIGRATIONS.at(-1)?.to).toBe(VIEW_SPEC_VERSION);
  });

  it('migrates a v1 spec to v2 (groups as objects, permissions, locked)', () => {
    const step = VIEW_SPEC_MIGRATIONS[0];
    const v2 = step?.apply(v1) as Record<string, unknown>;
    expect(v2.version).toBe(2);
    expect(v2.groups).toEqual([
      { fieldId: '0192a000-0000-7000-8000-0000000000f2', expandMulti: false },
    ]);
    expect(v2.permissions).toEqual({ canEditRecords: [], canEditView: [] });
    expect(v2.locked).toBe(false);
  });

  it('migrates v1 all the way and the result strict-parses', () => {
    expect(viewSpecSchema.safeParse(v1).success).toBe(false);
    const current = migrateViewSpec(v1);
    expect(current.version).toBe(VIEW_SPEC_VERSION);
    const parsed = viewSpecSchema.parse(current);
    expect(parsed.groups[0]?.expandMulti).toBe(false);
    expect(parseViewSpec(v1)).toEqual(parsed);
  });

  it('is a no-op on a current spec and never mutates its input', () => {
    const current = loadJson('grid.view.json') as Record<string, unknown>;
    const frozen = structuredClone(current);
    expect(isCurrentViewSpec(current)).toBe(true);
    expect(migrateViewSpec(current)).toEqual(current);
    expect(current).toEqual(frozen);
    expect(isCurrentViewSpec(v1)).toBe(false);
  });

  it('refuses missing, fractional and newer versions', () => {
    expect(() => migrateViewSpec({})).toThrow(ViewSpecVersionError);
    expect(() => migrateViewSpec({ version: 1.5 })).toThrow(ViewSpecVersionError);
    expect(() => migrateViewSpec({ version: VIEW_SPEC_VERSION + 1 })).toThrow(ViewSpecVersionError);
    expect(() => migrateViewSpec(null)).toThrow(ViewSpecVersionError);
  });
});
