// @vitest-environment jsdom
//
// This package's default environment is `node` (`filter/`'s PGlite tests
// need it); this is the one file in `shell/` that renders a component, so it
// opts into jsdom per-file instead of changing the package default.
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from './AppShell.js';
import { useLayout } from './layout-context.js';
import { createSlotRegistry } from './slot-registry.js';

afterEach(cleanup);

function FakeDashboardRoute() {
  useLayout({
    nav: <span data-testid="nav-content">Dashboard nav</span>,
    sidebar: <span data-testid="sidebar-content">Dashboard filters</span>,
    inspector: <span data-testid="inspector-content">Record details</span>,
  });
  return <p data-testid="main-content">Dashboard body</p>;
}

describe('<AppShell>', () => {
  it("renders a fake route's slot fills into nav, sidebar, main and inspector", () => {
    render(
      <AppShell registry={createSlotRegistry()} search={{ inspector: 'open', sidebar: 'expanded' }}>
        <FakeDashboardRoute />
      </AppShell>,
    );

    expect(screen.getByTestId('nav-content')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-content')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('hides the sidebar and inspector panels entirely when their search state says so', () => {
    render(
      <AppShell
        registry={createSlotRegistry()}
        search={{ inspector: 'closed', sidebar: 'collapsed' }}
      >
        <FakeDashboardRoute />
      </AppShell>,
    );

    expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspector-content')).not.toBeInTheDocument();
    // Nav has no visibility flag — it always renders.
    expect(screen.getByTestId('nav-content')).toBeInTheDocument();
  });

  it('exposes the current layout mode via data-layout, computed from the viewport width', () => {
    const { container } = render(
      <AppShell registry={createSlotRegistry()}>
        <FakeDashboardRoute />
      </AppShell>,
    );
    // jsdom defaults to a 1024px viewport → the `md` tier: sidebar is persistent,
    // inspector is still a drawer below `lg` (1280).
    const shell = container.querySelector('.paperos-shell');
    expect(shell).toHaveAttribute('data-breakpoint', 'md');
    expect(shell).toHaveAttribute('data-sidebar-mode', 'persistent');
    expect(shell).toHaveAttribute('data-inspector-mode', 'drawer');
    expect(shell).toHaveAttribute('data-layout', 'inspector-drawer');
  });

  it('renders a not-wired-yet command bar placeholder (PAP-151 has not landed)', () => {
    render(
      <AppShell registry={createSlotRegistry()}>
        <FakeDashboardRoute />
      </AppShell>,
    );
    expect(screen.getByRole('button', { name: /command bar/i })).toBeInTheDocument();
  });
});
