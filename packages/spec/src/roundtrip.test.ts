/**
 * Property test: for generated valid specs, `parseSpec(stringify(spec))` returns
 * the same value as validating the object directly. Seeded PRNG, no dependency.
 */

import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { parseSpec } from './parse.js';
import type { PageSpecInput } from './schema/page.js';
import { validatePageSpec } from './validate.js';

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;

export function generateSpec(seed: number): PageSpecInput {
  const random = rng(seed);
  const id = `page-${seed}`;
  const actionNames = ['save', 'openRow', 'refresh', 'archive', 'exportCsv'].slice(
    0,
    1 + Math.floor(random() * 4),
  );
  const actions = Object.fromEntries(
    actionNames.map((name) => [
      name,
      {
        intent:
          random() > 0.5
            ? `${id}.actions.${name}.intent`
            : { id: `${id}.actions.${name}.intent`, default: `${name} it` },
        permission: pick(random, ['public', 'page.view', 'record.edit', 'record.archive']),
        steps: ['Do the thing.', 'Then refresh.'].slice(0, 1 + Math.floor(random() * 2)),
        effects:
          random() > 0.5
            ? ['prose effect', { kind: 'notify' as const, copy: `${id}.actions.${name}.done` }]
            : [],
        status: pick(random, ['wired', 'not-wired'] as const),
      },
    ]),
  );
  const components: NonNullable<PageSpecInput['components']> = [
    {
      id: pick(random, ['ui.dataTable', 'ui.card', 'app.widget']),
      key: 'root',
      props: {
        level: Math.floor(random() * 3),
        label: `${id}.components.root.label`,
        flags: [true, false],
      },
      slot: pick(random, ['main', 'sidebar', 'inspector'] as const),
      events: { onClick: pick(random, actionNames) },
      children: actionNames.map((name, i) => ({
        id: 'ui.button',
        key: `${name}Button${i}`,
        events: { onClick: name },
      })),
    },
  ];
  const ready = random() > 0.5;
  const spec: PageSpecInput = {
    meta: {
      id,
      title: { id: `${id}.meta.title`, default: `Page ${seed}` },
      route: pick(random, ['/', `/pages/${seed}`, `/pages/$pageId/edit`, '/a-b/c-d/']),
      surface: pick(random, ['customer', 'staff', 'developer', 'agent', 'public'] as const),
      owner: 'spec-builder',
      status: ready ? 'ready' : 'draft',
      specVersion: 1,
      tags: random() > 0.5 ? ['generated'] : [],
    },
    purpose: { summary: `Generated spec ${seed}.`, successMetric: 'It parses.' },
    logic: { actions },
    layout: {
      template: pick(random, ['app', 'public', 'focus', 'kiosk'] as const),
      density: pick(random, ['compact', 'default', 'comfortable'] as const),
    },
    components,
    states: {
      loading: { copy: `${id}.states.loading.copy` },
      empty: { copy: `${id}.states.empty.copy`, component: 'ui.emptyState' },
      error: {
        copy: `${id}.states.error.copy`,
        component: 'ui.errorState',
        action: actionNames[0] as string,
      },
      offline: { copy: `${id}.states.offline.copy` },
      denied: { copy: `${id}.states.denied.copy` },
    },
    events: [
      { on: actionNames[0] as string, to: '/somewhere/$id' },
      { on: 'root.onClick', to: 'https://example.com/docs', kind: 'external' },
      { on: 'page.load', to: '/home', kind: 'replace', guard: 'signed in' },
    ],
    edgeCases: [1, 2, 3].map((n) => ({
      id: `case-${n}`,
      scenario: `Scenario ${n}`,
      expected: 'Handled.',
      test: pick(random, ['unit', 'e2e', 'manual'] as const),
    })),
  };
  if (ready) {
    spec.access = {
      view: ['staff'],
      actions: Object.fromEntries(
        actionNames.map((name) => [
          name,
          { audiences: ['staff'], condition: { field: 'status', operator: 'eq', value: 'open' } },
        ]),
      ),
      rows: {
        record: {
          op: 'and',
          children: [{ field: 'ownerId', operator: 'eq', value: { $var: 'principal.id' } }],
        },
      },
    };
    spec.data = {
      entities: ['record'],
      queries: {
        rows: {
          entity: 'record',
          sync: pick(random, ['server', 'live', 'local'] as const),
          sort: [{ field: 'updatedAt', dir: 'desc' }],
        },
      },
      mutations: {
        save: { entity: 'record', action: 'update', input: { id: 'uuid', note: 'text' } },
      },
    };
  }
  return spec;
}

describe('parseSpec(stringify(spec)) round-trips', () => {
  const header =
    '# yaml-language-server: $schema=../../packages/spec/schema/page.spec.schema.json\n';
  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}`, () => {
      const spec = generateSpec(seed);
      const direct = validatePageSpec(spec);
      expect(direct.ok, JSON.stringify(direct.issues)).toBe(true);
      const parsed = parseSpec(header + stringify(spec));
      expect(parsed.ok, JSON.stringify(parsed.issues)).toBe(true);
      if (!parsed.ok || !direct.ok) return;
      expect(parsed.value).toEqual(direct.value);
      expect(parsed.issues).toEqual([]);
    });
  }
});
