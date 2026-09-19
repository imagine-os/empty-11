/**
 * `<AppShell>` — the grid shell with named slots (nav, sidebar, main,
 * inspector, commandbar, statusbar). Rendered once, at the route tree's
 * `__root.tsx`; `_app.tsx`/`_public.tsx` and pages fill slots through
 * `useLayout()` / the spec adapter, never render a second `<AppShell>`
 * (edge case: "Nested layouts under `_app/settings/*` never double-render nav").
 *
 * Panel visibility (sidebar/inspector shown or not) is controlled by the
 * caller via `search` (normally `useShellSearch()`, from the URL); whether
 * a visible panel is a persistent grid column or an overlay drawer is
 * decided here, from the viewport breakpoint (`useBreakpoint`, PAP-14) —
 * "interim media queries" per the spec, until PAP-21's container queries.
 */
import type { ReactNode } from 'react';
import type { BreakpointName } from '../devices/matrix.js';
import { ShellProvider } from './layout-context.js';
import { Slot } from './Slot.js';
import { INSPECTOR_DEFAULT, type ShellSearch, SIDEBAR_DEFAULT } from './shell-search.js';
import type { SlotRegistry } from './slot-registry.js';
import { NotWiredYet, ToastProvider } from './toast.js';
import type { SlotGuardContext } from './types.js';
import { useBreakpoint } from './use-breakpoint.js';

export type PanelMode = 'drawer' | 'persistent';
export type LayoutMode = 'drawer' | 'inspector-drawer' | 'grid';

/** Sidebar is a drawer below `md` (< 768). */
const DRAWER_SIDEBAR_BREAKPOINTS: ReadonlySet<BreakpointName> = new Set(['xs', 'sm']);
/** Inspector is a drawer below `lg` (< 1280). */
const DRAWER_INSPECTOR_BREAKPOINTS: ReadonlySet<BreakpointName> = new Set(['xs', 'sm', 'md']);

export function sidebarModeFor(breakpoint: BreakpointName): PanelMode {
  return DRAWER_SIDEBAR_BREAKPOINTS.has(breakpoint) ? 'drawer' : 'persistent';
}

export function inspectorModeFor(breakpoint: BreakpointName): PanelMode {
  return DRAWER_INSPECTOR_BREAKPOINTS.has(breakpoint) ? 'drawer' : 'persistent';
}

export interface AppShellProps {
  /** Routed page content (`<Outlet />` in `__root.tsx`). */
  readonly children?: ReactNode;
  /** Panel state; normally `useShellSearch()`. Defaults applied when omitted (e.g. in tests). */
  readonly search?: ShellSearch;
  /** Test-only: an isolated slot registry instead of the shared default one. */
  readonly registry?: SlotRegistry | undefined;
  readonly guardContext?: SlotGuardContext | undefined;
}

export function AppShell({ children, search, registry, guardContext }: AppShellProps) {
  const breakpoint = useBreakpoint();
  const sidebarMode = sidebarModeFor(breakpoint);
  const inspectorMode = inspectorModeFor(breakpoint);
  const inspector = search?.inspector ?? INSPECTOR_DEFAULT;
  const sidebar = search?.sidebar ?? SIDEBAR_DEFAULT;
  const sidebarVisible = sidebar === 'expanded';
  const inspectorVisible = inspector === 'open';
  const layoutMode: LayoutMode =
    sidebarMode === 'drawer' ? 'drawer' : inspectorMode === 'drawer' ? 'inspector-drawer' : 'grid';

  return (
    <ShellProvider registry={registry} guardContext={guardContext}>
      <ToastProvider>
        <div
          className="paperos-shell"
          data-layout={layoutMode}
          data-breakpoint={breakpoint}
          data-sidebar-mode={sidebarMode}
          data-inspector-mode={inspectorMode}
          data-sidebar-visible={sidebarVisible}
          data-inspector-visible={inspectorVisible}
        >
          <a className="paperos-skip-link" href="#paperos-main">
            Skip to main content
          </a>

          {/* <header> already has the implicit `banner` landmark role. */}
          <header className="paperos-shell__nav">
            <Slot name="nav" />
          </header>

          {sidebarVisible && (
            <aside className="paperos-shell__sidebar" data-mode={sidebarMode} aria-label="Sidebar">
              <Slot name="sidebar" />
            </aside>
          )}

          <main id="paperos-main" className="paperos-shell__main" tabIndex={-1}>
            <Slot name="main" fallback={children} />
          </main>

          {inspectorVisible && (
            <aside
              className="paperos-shell__inspector"
              data-mode={inspectorMode}
              aria-label="Inspector"
            >
              <Slot name="inspector" />
            </aside>
          )}

          <footer className="paperos-shell__statusbar" role="contentinfo">
            <Slot name="statusbar" />
          </footer>

          <div className="paperos-shell__commandbar">
            <Slot
              name="commandbar"
              fallback={
                <NotWiredYet label="Command bar" className="paperos-shell__commandbar-trigger">
                  ⌘K Command bar
                </NotWiredYet>
              }
            />
          </div>
        </div>
      </ToastProvider>
    </ShellProvider>
  );
}
