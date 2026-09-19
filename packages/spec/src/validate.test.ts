import { describe, expect, it } from 'vitest';
import { errorsOf } from './issues.js';
import { type PageSpecInput, PageSpecSchema } from './schema/page.js';
import { candidateKeysAt, validatePageSpec } from './validate.js';

const base = (): PageSpecInput => ({
  meta: {
    id: 'demo',
    title: 'demo.meta.title',
    route: '/demo',
    surface: 'staff',
    owner: 'spec-builder',
    specVersion: 1,
  },
  purpose: { summary: 'A demo.' },
  logic: {
    actions: {
      save: { intent: 'demo.actions.save.intent', permission: 'demo.edit', steps: ['Persist.'] },
    },
  },
  layout: { template: 'app' },
  components: [{ id: 'ui.button', key: 'saveButton', events: { onClick: 'save' } }],
  states: {
    error: { copy: 'demo.states.error.copy' },
    denied: { copy: 'demo.states.denied.copy' },
  },
});

describe('validatePageSpec on plain objects', () => {
  it('accepts a minimal draft and fills defaults', () => {
    const result = validatePageSpec(base());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.meta.status).toBe('draft');
    expect(result.value.components[0]).toMatchObject({
      slot: 'main',
      status: 'wired',
      props: {},
      children: [],
    });
    expect(result.value.logic.actions.save?.effects).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('names paths without positions', () => {
    const spec = base();
    spec.components = [{ id: 'ui.button', key: 'a', events: { onClick: 'sav' } }];
    const result = validatePageSpec(spec);
    expect(result.ok).toBe(false);
    expect(errorsOf(result.issues)[0]).toMatchObject({
      code: 'SPEC_ACTION_UNBOUND',
      path: 'components[0].events.onClick',
    });
    expect(errorsOf(result.issues)[0]?.line).toBeUndefined();
    expect(errorsOf(result.issues)[0]?.hint).toContain('save');
  });

  it('rejects unknown top-level keys, suggests the closest one, keeps x-*', () => {
    const spec = { ...base(), layuot: {}, 'x-extra': 1 } as Record<string, unknown>;
    const result = validatePageSpec(spec);
    expect(result.ok).toBe(false);
    expect(errorsOf(result.issues)).toHaveLength(1);
    expect(errorsOf(result.issues)[0]).toMatchObject({ code: 'SPEC_UNKNOWN_KEY', path: 'layuot' });
    expect(errorsOf(result.issues)[0]?.hint).toContain('`layout`');
  });

  it('PageSpecSchema.safeParse alone also flags unknown top-level keys', () => {
    const parsed = PageSpecSchema.safeParse({ ...base(), bogus: true });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      code: 'custom',
      path: ['bogus'],
      params: { code: 'SPEC_UNKNOWN_KEY' },
    });
    expect(PageSpecSchema.safeParse({ ...base(), 'x-bogus': true }).success).toBe(true);
  });

  it('suggests keys for nested typos', () => {
    const spec = base();
    (spec.layout as Record<string, unknown>).templte = 'app';
    const result = validatePageSpec(spec);
    expect(result.ok).toBe(false);
    expect(errorsOf(result.issues).find((i) => i.code === 'SPEC_UNKNOWN_KEY')).toMatchObject({
      path: 'layout.templte',
    });
    expect(errorsOf(result.issues).find((i) => i.code === 'SPEC_UNKNOWN_KEY')?.hint).toContain(
      '`template`',
    );
    expect(candidateKeysAt(['layout'])).toEqual(['template', 'slots', 'density']);
    expect(candidateKeysAt(['components', 0])).toContain('events');
    expect(candidateKeysAt(['logic', 'actions', 'save', 'onError'])).toEqual([
      'strategy',
      'copy',
      'to',
    ]);
    expect(candidateKeysAt(['nope'])).toEqual([]);
  });

  it('warns on undeclared slots when layout.slots is given', () => {
    const spec = base();
    spec.layout = { template: 'app', slots: { main: {} } };
    spec.components = [{ id: 'ui.card', key: 'c', slot: 'inspector' }];
    const result = validatePageSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.issues.map((i) => i.code)).toEqual(['SPEC_SLOT_UNDECLARED']);
  });

  it('warns on built pages with placeholders', () => {
    const spec = base();
    spec.meta.status = 'built';
    spec.components = [{ id: 'ui.button', key: 'later', status: 'not-wired' }];
    spec.logic = {
      actions: {
        save: {
          intent: 'demo.actions.save.intent',
          permission: 'demo.edit',
          steps: ['Persist.'],
          status: 'not-wired',
        },
      },
    };
    const result = validatePageSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.issues.map((i) => [i.code, i.path])).toEqual([
      ['SPEC_BUILT_NOT_WIRED', 'components[0].status'],
      ['SPEC_BUILT_NOT_WIRED', 'logic.actions.save.status'],
    ]);
  });

  it('ready gate accepts x-static pages and requires offline state for live data', () => {
    const spec = { ...base(), 'x-static': true } as PageSpecInput & Record<string, unknown>;
    spec.meta.status = 'ready';
    spec.access = { view: ['staff'] };
    spec.edgeCases = [1, 2, 3].map((n) => ({
      id: `case-${n}`,
      scenario: 's',
      expected: 'e',
      test: 'unit' as const,
    }));
    expect(validatePageSpec(spec).ok).toBe(true);

    const live = {
      ...spec,
      data: { queries: { rows: { entity: 'invoice', sync: 'live' as const } } },
    };
    const result = validatePageSpec(live);
    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe('SPEC_READY_STATES');
    expect(result.issues[0]?.message).toContain('`offline`');
  });

  it('reports duplicate edge-case ids and bad permission grammar', () => {
    const spec = base();
    spec.edgeCases = [
      { id: 'same', scenario: 's', expected: 'e', test: 'unit' },
      { id: 'same', scenario: 's', expected: 'e', test: 'e2e' },
    ];
    spec.logic = {
      actions: {
        save: { intent: 'demo.actions.save.intent', permission: 'Pay Invoice', steps: ['x'] },
      },
    };
    const result = validatePageSpec(spec);
    expect(result.ok).toBe(false);
    expect(errorsOf(result.issues).map((i) => i.code)).toEqual(['SPEC_BAD_PERMISSION']);
    spec.logic = {
      actions: {
        save: { intent: 'demo.actions.save.intent', permission: 'invoice.pay', steps: ['x'] },
      },
    };
    const again = validatePageSpec(spec);
    expect(again.ok).toBe(false);
    expect(errorsOf(again.issues).map((i) => [i.code, i.path])).toEqual([
      ['SPEC_DUP_EDGE_ID', 'edgeCases[1].id'],
    ]);
  });

  it('rejects record keys outside their grammar', () => {
    const spec = base();
    spec.logic = {
      actions: {
        'Save Draft': { intent: 'demo.actions.save.intent', permission: 'demo.edit', steps: ['x'] },
      },
    };
    const result = validatePageSpec(spec);
    expect(result.ok).toBe(false);
    expect(errorsOf(result.issues)[0]).toMatchObject({
      code: 'SPEC_BAD_KEY',
      path: 'logic.actions["Save Draft"]',
    });
  });

  it('rejects non-objects', () => {
    expect(errorsOf(validatePageSpec(null).issues)[0]?.code).toBe('SPEC_NOT_OBJECT');
    expect(validatePageSpec([]).ok).toBe(false);
  });
});
