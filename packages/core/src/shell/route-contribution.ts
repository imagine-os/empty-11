/**
 * `RouteContribution` / `composeRoutes` stub (Interface contract: "PAP-28
 * later composes the route tree from module manifests through
 * `composeRoutes(modules)`, which this issue exposes as a stub").
 *
 * A module manifest (PAP-264) will list the routes it contributes; PAP-28
 * folds every module's contributions into one route tree. Until PAP-264
 * defines the manifest shape, `ModuleRouteSource` is a minimal placeholder.
 */
import type { ComponentType } from 'react';
import type { RouteStaticData } from './types.js';

export interface RouteContribution {
  readonly path: string;
  /** `React.lazy`-wrapped: the round-4 amendment keeps a module's code out of the initial chunk. */
  readonly component: () => Promise<{ default: ComponentType }>;
  readonly staticData?: RouteStaticData;
}

export interface ModuleRouteSource {
  readonly moduleId: string;
  readonly routes: readonly RouteContribution[];
}

/**
 * TODO(PAP-28): fold every module's `RouteContribution[]` into the file-based
 * route tree this issue builds. Returns `[]` until then — `apps/web`'s three
 * example routes are hand-authored file routes, not module contributions.
 */
export function composeRoutes(modules: readonly ModuleRouteSource[]): readonly RouteContribution[] {
  return modules.flatMap((mod) => mod.routes);
}
