/**
 * Pathless layout for authenticated pages (Interface contract: "`_app.tsx`
 * for authenticated pages"). Auth guards land later (out of scope, per the
 * spec) — this is purely the routing/layout grouping today.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app')({
  component: () => <Outlet />,
});
