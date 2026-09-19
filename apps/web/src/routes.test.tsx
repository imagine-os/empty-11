import '../src/components/registry.js';
import '../src/specs/registry.js';

import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { routeTree } from './routeTree.gen.js';

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('the three example routes render inside the shell', () => {
  afterEach(() => {
    // Each route's `useLayout`/`useSpecLayout` registers against the shared
    // default slot registry; nothing un-registers it faster than the next
    // test's own render replaces the same ids, so no explicit cleanup needed
    // beyond Testing Library's automatic unmount (see test-setup.ts).
  });

  it('renders the home route (/) with the nav filled from its spec', async () => {
    renderAt('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /paperos template/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument();
  });

  it('renders the dashboard route (/dashboard) with sidebar and inspector filled from its spec', async () => {
    renderAt('/dashboard');
    expect(
      await screen.findByRole('heading', { level: 1, name: /dashboard/i }),
    ).toBeInTheDocument();
    // Sidebar is visible by default (ShellSearch default: sidebar=expanded).
    expect(await screen.findByRole('heading', { level: 2, name: /filters/i })).toBeInTheDocument();
  });

  it('opens the inspector via the `?inspector=open` search param, per the spec demo', async () => {
    renderAt('/dashboard?inspector=open');
    expect(
      await screen.findByRole('heading', { level: 2, name: /inspector/i }),
    ).toBeInTheDocument();
  });

  it('renders the settings route (/settings), nested under _app, without a second nav', async () => {
    renderAt('/settings');
    expect(await screen.findByRole('heading', { level: 1, name: /settings/i })).toBeInTheDocument();
    // Exactly one nav landmark — nested layouts never double-render it (edge case).
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });
});

describe('route fallbacks', () => {
  it('renders the not-found route for an unknown path', async () => {
    renderAt('/this-route-does-not-exist');
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  it('renders the error boundary with a retry button when a loader throws, and retry does not crash', async () => {
    renderAt('/error-demo');
    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /retry/i });
    retry.click();
    // The loader throws again on retry (it's a demo route) — the boundary
    // should still be showing, not a blank page or an uncaught exception.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument(),
    );
  });
});
