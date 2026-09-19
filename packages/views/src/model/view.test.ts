import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { clone, goldenFixtures, invalidFixtures, loadJson } from '../test-helpers.js';
import type { FieldDef } from './field.js';
import type { FilterTree } from './shims.js';
import {
  AGGREGATE_FNS,
  type AggregateFn,
  findOrphanedFieldIds,
  referencedFieldIds,
  VIEW_KINDS,
  VIEW_LIMITS,
  VIEW_OPTION_SCHEMAS,
  VIEW_SPEC_VERSION,
  type ViewKind,
  type ViewSpec,
  type ViewSpecInput,
  type ViewSpecOf,
  viewSpecSchema,
} from './view.js';

const golden = goldenFixtures();

describe('ViewSpec golden fixtures', () => {
  it('has exactly ten kinds with one fixture each', () => {
    expect(VIEW_KINDS).toHaveLength(10);
    expect(golden.map((g) => g.kind)).toEqual([...VIEW_KINDS]);
  });

  it.each(golden)('$file parses strictly as kind $kind', ({ kind, spec }) => {
    const parsed = viewSpecSchema.parse(spec);
    expect(parsed.kind).toBe(kind);
    expect(parsed.version).toBe(VIEW_SPEC_VERSION);
    // defaults applied
    expect(Array.isArray(parsed.sorts)).toBe(true);
    expect(typeof parsed.locked).toBe('boolean');
    // options validated by the kind's named schema
    expect(VIEW_OPTION_SCHEMAS[kind].safeParse(parsed.options).success).toBe(true);
  });

  it.each(golden)('$file rejects an unknown top-level key', ({ spec }) => {
    const result = viewSpecSchema.safeParse({ ...(spec as object), extra: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
  });

  it.each(golden)('$file rejects an unknown options key', ({ spec }) => {
    const mutated = clone(spec) as { options: Record<string, unknown> };
    mutated.options.unexpected = 1;
    expect(viewSpecSchema.safeParse(mutated).success).toBe(false);
  });

  it.each(golden)('$file rejects a version that is not current', ({ spec }) => {
    const mutated = clone(spec) as { version: number };
    mutated.version = VIEW_SPEC_VERSION + 1;
    expect(viewSpecSchema.safeParse(mutated).success).toBe(false);
    mutated.version = 1;
    expect(viewSpecSchema.safeParse(mutated).success).toBe(false);
  });
});

describe('ViewSpec invalid fixtures', () => {
  const expectedReason: Record<string, RegExp> = {
    'unknown-key.view.json': /Unrecognized key|unrecognized/i,
    'six-sorts.view.json': /Too big|at most 5/i,
    'four-groups.view.json': /Too big|at most 3/i,
    'duplicate-field.view.json': /duplicate fieldId/,
    'public-without-sharing.view.json': /public view must declare sharing/,
    'kanban-missing-stack.view.json': /stackByFieldId/,
    'bad-dataset-ref.view.json': /slug/,
    'options-of-other-kind.view.json': /Unrecognized key|unrecognized/i,
    'old-version.view.json': /version|Invalid input/i,
  };

  it('covers every invalid fixture with an expected reason', () => {
    expect(invalidFixtures().map((f) => f.file)).toEqual(Object.keys(expectedReason).sort());
  });

  it.each(invalidFixtures())('$file is rejected for the documented reason', ({ file, spec }) => {
    const result = viewSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    const text = z.prettifyError(result.error as z.ZodError);
    expect(text).toMatch(expectedReason[file] as RegExp);
  });
});

describe('ViewSpec limits and rules', () => {
  const grid = golden[0]?.spec as Record<string, unknown>;

  it('fixes the limits from the spec', () => {
    expect(VIEW_LIMITS.maxSorts).toBe(5);
    expect(VIEW_LIMITS.maxGroups).toBe(3);
    expect(VIEW_LIMITS.maxFields).toBe(500);
  });

  it('accepts exactly 5 sorts and 3 groups', () => {
    const ok = {
      ...grid,
      sorts: ['a', 'b', 'c', 'd', 'e'].map((f) => ({ fieldId: f, direction: 'asc' })),
      groups: ['a', 'b', 'c'].map((f) => ({ fieldId: f })),
    };
    expect(viewSpecSchema.safeParse(ok).success).toBe(true);
  });

  it('applies group defaults (combination semantics, expandMulti false)', () => {
    const parsed = viewSpecSchema.parse({ ...grid, groups: [{ fieldId: 'x' }] });
    expect(parsed.groups[0]).toEqual({
      fieldId: 'x',
      direction: 'asc',
      expandMulti: false,
      collapsed: false,
      hideEmpty: false,
    });
  });

  it('lets a public view with sharing through and hides nothing by default', () => {
    const parsed = viewSpecSchema.parse({ ...grid, visibility: 'public', sharing: {} });
    expect(parsed.sharing).toEqual({
      allowExport: false,
      allowEmbed: false,
      allowCopy: false,
      allowViewerFilters: false,
    });
  });

  it('accepts a spec without a filter (absent means no filter)', () => {
    const { filter: _filter, ...noFilter } = grid;
    expect(viewSpecSchema.parse(noFilter).filter).toBeUndefined();
  });

  it('rejects a chart series without a fieldId unless fn is count', () => {
    const chart = clone(golden.find((g) => g.kind === 'chart')?.spec) as {
      options: { series: unknown[] };
    };
    chart.options.series = [{ fn: 'sum' }];
    expect(viewSpecSchema.safeParse(chart).success).toBe(false);
    chart.options.series = [{ fn: 'count' }];
    expect(viewSpecSchema.safeParse(chart).success).toBe(true);
  });

  it('rejects a non-number chart without an xAxis', () => {
    const chart = clone(golden.find((g) => g.kind === 'chart')?.spec) as {
      options: Record<string, unknown>;
    };
    delete chart.options.xAxis;
    expect(viewSpecSchema.safeParse(chart).success).toBe(false);
    chart.options.chartType = 'number';
    expect(viewSpecSchema.safeParse(chart).success).toBe(true);
  });

  it('enumerates the aggregate functions once each', () => {
    expect(new Set(AGGREGATE_FNS).size).toBe(AGGREGATE_FNS.length);
    for (const fn of ['count', 'sum', 'avg', 'median', 'min', 'max', 'percentChecked']) {
      expect(AGGREGATE_FNS).toContain(fn);
    }
  });

  it.todo(
    'PAP-279: strict FilterTree shape (depth 6 rejected, operator vs type) once @paperos/core/filter lands; filter is `unknown` until then',
  );
});

describe('orphaned field references', () => {
  it('lists every field id a spec references outside its filter', () => {
    const gantt = viewSpecSchema.parse(golden.find((g) => g.kind === 'gantt')?.spec);
    const ids = referencedFieldIds(gantt);
    expect(ids.has('0192a000-0000-7000-8000-0000000000fe')).toBe(true); // dependencyFieldId
    expect(ids.has('0192a000-0000-7000-8000-0000000000fb')).toBe(true); // milestoneFieldId
    expect(ids.has('0192a000-0000-7000-8000-0000000000f5')).toBe(true); // sort + start
  });

  it('flags ids the dataset no longer has and keeps the spec valid', () => {
    const tasks = loadJson('datasets/tasks.dataset.json') as { fields: FieldDef[] };
    const grid = viewSpecSchema.parse(golden[0]?.spec);
    expect(
      findOrphanedFieldIds(
        grid,
        tasks.fields.map((f) => f.id),
      ),
    ).toEqual([]);
    const withoutBudget = tasks.fields.filter((f) => f.key !== 'budget').map((f) => f.id);
    expect(findOrphanedFieldIds(grid, withoutBudget)).toEqual([
      '0192a000-0000-7000-8000-0000000000fd',
    ]);
    expect(viewSpecSchema.safeParse(golden[0]?.spec).success).toBe(true);
  });
});

describe('ViewSpec types', () => {
  it('narrows options by kind', () => {
    expectTypeOf<ViewSpecOf<'kanban'>['options']['stackByFieldId']>().toEqualTypeOf<string>();
    expectTypeOf<ViewSpecOf<'chart'>['options']['chartType']>().toEqualTypeOf<
      'bar' | 'stackedBar' | 'line' | 'area' | 'pie' | 'donut' | 'number'
    >();
    expectTypeOf<ViewSpec['kind']>().toEqualTypeOf<ViewKind>();
    expectTypeOf<ViewSpec['visibility']>().toEqualTypeOf<'personal' | 'shared' | 'public'>();
    expectTypeOf<ViewSpec['filter']>().toEqualTypeOf<FilterTree | undefined>();
    expectTypeOf<ViewSpec['locked']>().toEqualTypeOf<boolean>();
    expectTypeOf<ViewSpecInput['locked']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ViewSpec['permissions']>().toEqualTypeOf<{
      canEditRecords: string[];
      canEditView: string[];
    }>();
    expectTypeOf<AggregateFn>().toMatchTypeOf<string>();
  });
});
