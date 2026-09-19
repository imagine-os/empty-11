import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Component, ComponentInput } from './components.js';
import type { FilterTree } from './filter.js';
import type { Action } from './logic.js';
import {
  KNOWN_STATES,
  PAGE_SPEC_KEYS,
  type PageSpec,
  type PageSpecInput,
  PageSpecSchema,
  RESERVED_KEYS,
  type SpecStatus,
  type Surface,
} from './page.js';
import {
  COMPONENT_REF_RE,
  MESSAGE_KEY_RE,
  type MessageRef,
  messageKeyOf,
  ROUTE_REF_RE,
  type RouteRef,
  RouteRef as RouteRefSchema,
} from './refs.js';

describe('PageSpec types', () => {
  it('expose the contract shapes', () => {
    expectTypeOf<Surface>().toEqualTypeOf<
      'customer' | 'staff' | 'developer' | 'agent' | 'public'
    >();
    expectTypeOf<SpecStatus>().toEqualTypeOf<'draft' | 'ready' | 'built' | 'deprecated'>();
    expectTypeOf<PageSpec['meta']['specVersion']>().toEqualTypeOf<1>();
    expectTypeOf<PageSpec['meta']['route']>().toEqualTypeOf<RouteRef>();
    expectTypeOf<PageSpec['meta']['title']>().toEqualTypeOf<MessageRef>();
    expectTypeOf<PageSpec['layout']['template']>().toEqualTypeOf<
      'app' | 'public' | 'focus' | 'kiosk'
    >();
    expectTypeOf<PageSpec['components']>().toEqualTypeOf<Component[]>();
    expectTypeOf<PageSpec['logic']['actions']>().toEqualTypeOf<Record<string, Action>>();
    expectTypeOf<Action['permission']>().toEqualTypeOf<string>();
    expectTypeOf<Action['status']>().toEqualTypeOf<'wired' | 'not-wired'>();
    expectTypeOf<Component['status']>().toEqualTypeOf<'wired' | 'not-wired'>();
    expectTypeOf<Component['children']>().toEqualTypeOf<Component[]>();
    expectTypeOf<PageSpec['edgeCases'][number]['test']>().toEqualTypeOf<
      'unit' | 'e2e' | 'manual'
    >();
    expectTypeOf<PageSpec['events'][number]['kind']>().toEqualTypeOf<
      'navigate' | 'replace' | 'modal' | 'external'
    >();
    expectTypeOf<PageSpec['access']>().toEqualTypeOf<PageSpec['access'] | undefined>();
    expectTypeOf<NonNullable<PageSpec['access']>['rows']>().toEqualTypeOf<
      Record<string, FilterTree>
    >();
    // Input type: defaults are optional, output type: they are present.
    expectTypeOf<PageSpecInput['components']>().toEqualTypeOf<ComponentInput[] | undefined>();
    expectTypeOf<PageSpecInput['meta']['status']>().toEqualTypeOf<SpecStatus | undefined>();
    expectTypeOf<PageSpec['meta']['status']>().toEqualTypeOf<SpecStatus>();
    // x-* keys are preserved
    expectTypeOf<PageSpec['x-static']>().toEqualTypeOf<unknown>();
  });

  it('lists the eleven sections and the six reserved keys in order', () => {
    expect(PAGE_SPEC_KEYS).toEqual([
      'meta',
      'purpose',
      'logic',
      'access',
      'data',
      'integrations',
      'layout',
      'components',
      'states',
      'events',
      'edgeCases',
      ...RESERVED_KEYS,
    ]);
    expect(KNOWN_STATES).toEqual(['loading', 'empty', 'error', 'offline', 'denied']);
  });
});

describe('reference grammars', () => {
  it.each(['/', '/invoices', '/invoices/$invoiceId', '/a-b/$id/edit/', '/settings/members'])(
    'accepts route %s',
    (route) => {
      expect(ROUTE_REF_RE.test(route)).toBe(true);
      expect(RouteRefSchema.safeParse(route).success).toBe(true);
    },
  );
  it.each(['invoices', '/invoices/:id', '/Invoices', '//x', '/inv oices', '/$', '/a_b'])(
    'rejects route %s',
    (route) => {
      expect(ROUTE_REF_RE.test(route)).toBe(false);
    },
  );
  it.each(['ui.button', 'app.invoiceCard', 'print.header', 'ui.a1'])(
    'accepts component %s',
    (id) => {
      expect(COMPONENT_REF_RE.test(id)).toBe(true);
    },
  );
  it.each(['Button', 'ui.Button', 'ux.button', 'ui.', 'ui.button.small'])(
    'rejects component %s',
    (id) => {
      expect(COMPONENT_REF_RE.test(id)).toBe(false);
    },
  );
  it('message keys are dotted and never a sentence', () => {
    expect(MESSAGE_KEY_RE.test('customer-invoices.states.empty.copy')).toBe(true);
    expect(MESSAGE_KEY_RE.test('No invoices yet')).toBe(false);
    expect(MESSAGE_KEY_RE.test('single')).toBe(false);
    expect(messageKeyOf('a.b')).toBe('a.b');
    expect(messageKeyOf({ id: 'a.b', default: 'x' })).toBe('a.b');
  });
  it('the schema strips nothing and keeps x-* keys', () => {
    const parsed = PageSpecSchema.parse({
      meta: { id: 'a', title: 'a.t', route: '/', surface: 'public', owner: 'o' },
      purpose: { summary: 's' },
      layout: { template: 'public' },
      'x-static': true,
    });
    expect(parsed['x-static']).toBe(true);
    expect(parsed.meta.specVersion).toBe(1);
    expect(parsed.states).toEqual({});
  });
});
