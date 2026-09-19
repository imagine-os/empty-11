/**
 * `useSpec(routeId)` — loads the parsed page spec for a route.
 *
 * `vite-plugin-paperos-specs` (apps/web) imports `specs/pages/*.spec.yaml`
 * through `@paperos/spec`'s real `parseSpec` (PAP-114) at build time;
 * `apps/web/src/specs/registry.ts` calls `registerSpec(id, spec)` for each
 * at boot. This module just holds that registry — no YAML parsing, no
 * `@paperos/spec` import, keeping `@paperos/core` bundler-agnostic and free
 * of the dependency cycle noted in `spec-adapter.tsx` (`@paperos/spec`
 * already depends on `@paperos/core`). Generic over the spec type: a caller
 * that imports the real type says `useSpec<PageSpec>('dashboard')`.
 */
import { useSyncExternalStore } from 'react';

const specs = new Map<string, unknown>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Registers a parsed spec under its `meta.id` (or whatever id the caller chooses, e.g. the route's `staticData.spec`). */
export function registerSpec<T>(id: string, spec: T): void {
  specs.set(id, spec);
  notify();
}

export function getSpec<T>(id: string | undefined): T | undefined {
  return id ? (specs.get(id) as T | undefined) : undefined;
}

/** Reactive read, for components that render before boot-time registration finishes (e.g. lazy routes). */
export function useSpec<T>(id: string | undefined): T | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getSpec<T>(id),
    () => getSpec<T>(id),
  );
}

export function clearSpecRegistry(): void {
  specs.clear();
  notify();
}
