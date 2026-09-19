/**
 * Pathless layout for marketing/auth pages (Interface contract: "`_public.tsx`
 * for marketing and auth"). Contributes no URL segment; a child's own path
 * is the full path (e.g. `_public/index.tsx` → `/`). No slot fills of its
 * own in this template — each public page declares `layout.slots.nav` via
 * its spec, same as `_app`'s pages.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_public')({
  component: () => <Outlet />,
});
