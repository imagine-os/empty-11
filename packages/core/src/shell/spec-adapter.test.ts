import { beforeEach, describe, expect, it } from 'vitest';
import { clearComponentRegistry, registerComponent } from './component-registry.js';
import { layoutFromSpec, type SpecComponentLike } from './spec-adapter.js';

function Filters() {
  return null;
}
function Nav() {
  return null;
}

// Three fixtures mirroring the three example page specs' `components[]` (home/dashboard/settings).
const homeComponents: SpecComponentLike[] = [{ id: 'app.appNav', slot: 'nav' }];

const dashboardComponents: SpecComponentLike[] = [
  { id: 'app.appNav', slot: 'nav' },
  { id: 'app.dashboardFilters', slot: 'sidebar', status: 'not-wired' },
];

const settingsComponentsWithMissingComponent: SpecComponentLike[] = [
  { id: 'app.settingsNavThatDoesNotExist', slot: 'sidebar' },
];

describe('layoutFromSpec', () => {
  beforeEach(() => {
    clearComponentRegistry();
    registerComponent('app.appNav', Nav);
    registerComponent('app.dashboardFilters', Filters);
  });

  it('maps the home fixture: a component with no slot given defaults to main, one with slot: nav goes to nav', () => {
    const fills = layoutFromSpec(homeComponents);
    expect(fills).toEqual([
      { slot: 'nav', componentId: 'app.appNav', component: Nav, notWired: false, props: {} },
    ]);
  });

  it('maps the dashboard fixture: `status: not-wired` is carried through as `notWired: true`', () => {
    const fills = layoutFromSpec(dashboardComponents);
    expect(fills).toContainEqual({
      slot: 'sidebar',
      componentId: 'app.dashboardFilters',
      component: Filters,
      notWired: true,
      props: {},
    });
  });

  it('maps the settings fixture: a component id missing from the registry resolves to undefined, not a throw', () => {
    const fills = layoutFromSpec(settingsComponentsWithMissingComponent);
    expect(fills).toEqual([
      {
        slot: 'sidebar',
        componentId: 'app.settingsNavThatDoesNotExist',
        component: undefined,
        notWired: false,
        props: {},
      },
    ]);
  });

  it('a component with no `slot` field defaults to `main` (the real schema default)', () => {
    registerComponent('app.card', Filters);
    const fills = layoutFromSpec([{ id: 'app.card' }]);
    expect(fills[0]?.slot).toBe('main');
  });

  it('returns an empty list for no components', () => {
    expect(layoutFromSpec(undefined)).toEqual([]);
    expect(layoutFromSpec([])).toEqual([]);
  });
});
