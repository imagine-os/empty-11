/**
 * Root route: renders `<AppShell>` once for the whole app (Interface
 * contract: "`__root.tsx` renders `<AppShell>`"). `_app.tsx`/`_public.tsx`
 * and pages only fill slots (`useLayout`/spec adapter) — nothing below here
 * renders a second `<AppShell>`, which is what keeps nested layouts from
 * double-rendering nav (edge case).
 *
 * `ShellSearch` (`?inspector=`/`?sidebar=`) is validated here so every route
 * inherits it (TanStack Router merges parent `validateSearch` into children).
 */
import { AppShell, useShellSearch, validateShellSearch } from '@paperos/core/shell';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ErrorRoute, NotFoundRoute, PendingRoute } from '../shell/route-fallbacks.js';

export const Route = createRootRoute({
  validateSearch: validateShellSearch,
  component: RootComponent,
  notFoundComponent: NotFoundRoute,
  errorComponent: ErrorRoute,
  pendingComponent: PendingRoute,
  pendingMs: 300,
});

function RootComponent() {
  const search = useShellSearch();
  return (
    <AppShell search={search}>
      <Outlet />
    </AppShell>
  );
}
