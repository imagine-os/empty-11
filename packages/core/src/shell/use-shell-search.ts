/**
 * `useShellSearch()` — typed read/write access to the `ShellSearch` panel
 * state that lives in the URL (`?inspector=open&sidebar=collapsed`).
 *
 * Reads through `@tanstack/react-router`'s `useSearch`/`useNavigate`; the
 * search itself is validated at the route tree's root via
 * `validateShellSearch` (`shell-search.ts`), so what comes back here is
 * always the fully-defaulted shape, never `undefined` or partial.
 */
import { useNavigate, useSearch } from '@tanstack/react-router';
import { INSPECTOR_DEFAULT, type ShellSearch, SIDEBAR_DEFAULT } from './shell-search.js';

export interface ShellSearchApi extends ShellSearch {
  readonly setInspector: (value: ShellSearch['inspector']) => void;
  readonly setSidebar: (value: ShellSearch['sidebar']) => void;
  readonly toggleInspector: () => void;
  readonly toggleSidebar: () => void;
}

/**
 * `strict: false` reads whatever the closest ancestor route validated,
 * falling back to the documented defaults if none did (e.g. a route rendered
 * outside the normal tree in a unit test) rather than throwing.
 */
export function useShellSearch(): ShellSearchApi {
  const search = useSearch({ strict: false }) as Partial<ShellSearch> | undefined;
  const navigate = useNavigate();

  const inspector = search?.inspector ?? INSPECTOR_DEFAULT;
  const sidebar = search?.sidebar ?? SIDEBAR_DEFAULT;

  function setInspector(value: ShellSearch['inspector']): void {
    void navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({ ...prev, inspector: value }),
    });
  }

  function setSidebar(value: ShellSearch['sidebar']): void {
    void navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({ ...prev, sidebar: value }),
    });
  }

  return {
    inspector,
    sidebar,
    setInspector,
    setSidebar,
    toggleInspector: () => setInspector(inspector === 'open' ? 'closed' : 'open'),
    toggleSidebar: () => setSidebar(sidebar === 'expanded' ? 'collapsed' : 'expanded'),
  };
}
