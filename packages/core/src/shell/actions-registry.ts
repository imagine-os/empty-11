/**
 * Actions registry (org standard, CLAUDE.md "Every page declares its
 * actions"): every route/page declares `{ id, intent, permission }` entries.
 * The shell aggregates them onto `window.__paperos.actions` in dev mode,
 * which is the WebMCP surface and the voice controller's vocabulary
 * (module-system.md §4).
 */
import { isDevMode } from './dev-mode.js';

export interface ActionDescriptor {
  /** Stable id, e.g. `dashboard.refresh`. */
  readonly id: string;
  /** Human intent phrase a voice/WebMCP controller matches against, e.g. "refresh the dashboard". */
  readonly intent: string;
  /** Permission required to invoke it, or `'public'` when none. */
  readonly permission: string;
  /** True until the action is actually wired to a handler (org standard "not wired yet"). */
  readonly wired?: boolean;
}

export interface RegisteredPageActions {
  readonly routeId: string;
  readonly actions: readonly ActionDescriptor[];
}

const byRoute = new Map<string, readonly ActionDescriptor[]>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
  publishToWindow();
}

function publishToWindow(): void {
  if (typeof window === 'undefined' || !isDevMode()) return;
  const target = window as unknown as { __paperos?: Record<string, unknown> };
  if (!target.__paperos) target.__paperos = {};
  target.__paperos.actions = [...byRoute.entries()].flatMap(([routeId, actions]) =>
    actions.map((action) => ({ ...action, routeId })),
  );
}

/** A route registers (and, on unmount, clears) its actions. Returns the unregister function. */
export function registerPageActions(
  routeId: string,
  actions: readonly ActionDescriptor[],
): () => void {
  byRoute.set(routeId, actions);
  notify();
  return () => {
    byRoute.delete(routeId);
    notify();
  };
}

export function subscribeActions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** All currently-registered actions across every mounted route. */
export function getAllActions(): readonly RegisteredPageActions[] {
  return [...byRoute.entries()].map(([routeId, actions]) => ({ routeId, actions }));
}

export function clearActionsRegistry(): void {
  byRoute.clear();
  notify();
}
