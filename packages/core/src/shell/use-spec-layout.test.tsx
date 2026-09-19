// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearActionsRegistry, getAllActions } from './actions-registry.js';
import { clearComponentRegistry, registerComponent } from './component-registry.js';
import { ShellProvider } from './layout-context.js';
import { createSlotRegistry } from './slot-registry.js';
import { useSpecLayout } from './spec-adapter.js';

afterEach(() => {
  cleanup();
  clearActionsRegistry();
  clearComponentRegistry();
});

function Nav() {
  return null;
}

const dashboardLikeSpec = {
  meta: { id: 'dashboard' },
  components: [{ id: 'app.appNav', slot: 'nav' as const }],
  logic: {
    actions: {
      refresh: { intent: 'dashboard.action.refresh', permission: 'public', status: 'not-wired' },
      openInvoice: {
        intent: { id: 'dashboard.actions.open.intent', default: 'open invoice' },
        permission: 'invoice.view',
      },
    },
  },
};

function DashboardLikeRoute() {
  useSpecLayout(dashboardLikeSpec);
  return null;
}

describe('useSpecLayout: logic.actions → actions registry', () => {
  it("registers every action under the spec's meta.id, resolving both intent shapes", () => {
    registerComponent('app.appNav', Nav);
    render(
      <ShellProvider registry={createSlotRegistry()}>
        <DashboardLikeRoute />
      </ShellProvider>,
    );

    const [entry] = getAllActions();
    expect(entry?.routeId).toBe('dashboard');
    expect(entry?.actions).toEqual(
      expect.arrayContaining([
        {
          id: 'dashboard.refresh',
          intent: 'dashboard.action.refresh',
          permission: 'public',
          wired: false,
        },
        {
          id: 'dashboard.openInvoice',
          intent: 'open invoice',
          permission: 'invoice.view',
          wired: true,
        },
      ]),
    );
  });

  it('clears its actions on unmount', () => {
    registerComponent('app.appNav', Nav);
    const { unmount } = render(
      <ShellProvider registry={createSlotRegistry()}>
        <DashboardLikeRoute />
      </ShellProvider>,
    );
    expect(getAllActions()).toHaveLength(1);

    unmount();
    expect(getAllActions()).toHaveLength(0);
  });
});
