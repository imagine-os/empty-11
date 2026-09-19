/**
 * Slot registry — `registerSlot(name, Component, { priority, when })` and
 * resolution (PAP-16 Interface contract, module-system.md §4 UI slot system).
 *
 * Pure, framework-agnostic state (no React) so it is trivial to unit test in
 * isolation; `layout-context.tsx` wraps it in a React context and re-renders
 * subscribers on change.
 */
import type { ComponentType } from 'react';
import {
  OPEN_GUARD_CONTEXT,
  type SlotGuardContext,
  type SlotName,
  type SlotRegistration,
  type SlotRegistrationOptions,
} from './types.js';

export type RegistryListener = () => void;

export interface SlotRegistry {
  register: (
    slot: SlotName,
    component: ComponentType,
    options?: SlotRegistrationOptions,
  ) => () => void;
  unregister: (id: string) => void;
  resolve: (slot: SlotName, ctx?: SlotGuardContext) => SlotRegistration | undefined;
  resolveAll: (slot: SlotName, ctx?: SlotGuardContext) => readonly SlotRegistration[];
  subscribe: (listener: RegistryListener) => () => void;
  /** Snapshot for `useSyncExternalStore` / tests. */
  getSnapshot: () => ReadonlyMap<string, SlotRegistration>;
  clear: () => void;
}

let nextAutoId = 0;

/**
 * Creates an independent registry. `packages/core/src/shell/index.ts` also
 * exports a module-level default instance for `registerSlot`/`<Slot>` to
 * share app-wide; tests create their own with `createSlotRegistry()` so they
 * never leak state into each other.
 */
export function createSlotRegistry(): SlotRegistry {
  const entries = new Map<string, SlotRegistration>();
  const listeners = new Set<RegistryListener>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function register(
    slot: SlotName,
    component: ComponentType,
    options: SlotRegistrationOptions = {},
  ): () => void {
    const id = options.id ?? `slot-${slot}-${++nextAutoId}`;
    const priority = options.priority ?? 0;

    // A re-registration under the *same* id (e.g. `useLayout()` re-running on
    // every render) is an intentional upsert, not a collision — only warn
    // when a *different* registration already holds this slot+priority.
    const existingAtPriority = [...entries.values()].filter(
      (e) => e.slot === slot && e.priority === priority && e.id !== id,
    );
    if (existingAtPriority.length > 0 && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[paperos/shell] two registrations for slot "${slot}" at priority ${priority} (ids: ${[...existingAtPriority.map((e) => e.id), id].join(', ')}). Last registered wins.`,
      );
    }

    entries.set(id, {
      id,
      slot,
      component,
      priority,
      when: options.when,
      registeredAt: Date.now() + performance.now() / 1e6, // monotonic tiebreak even within the same ms
    });
    notify();
    return () => unregister(id);
  }

  function unregister(id: string): void {
    if (entries.delete(id)) notify();
  }

  function candidatesFor(slot: SlotName, ctx: SlotGuardContext): SlotRegistration[] {
    return [...entries.values()]
      .filter((e) => e.slot === slot)
      .filter((e) => !e.when || e.when(ctx));
  }

  /** Highest priority wins; ties broken by most-recently-registered (last registration wins). */
  function bestOf(candidates: readonly SlotRegistration[]): SlotRegistration | undefined {
    return candidates.reduce<SlotRegistration | undefined>((best, current) => {
      if (!best) return current;
      if (current.priority > best.priority) return current;
      if (current.priority === best.priority && current.registeredAt >= best.registeredAt)
        return current;
      return best;
    }, undefined);
  }

  function resolve(
    slot: SlotName,
    ctx: SlotGuardContext = OPEN_GUARD_CONTEXT,
  ): SlotRegistration | undefined {
    return bestOf(candidatesFor(slot, ctx));
  }

  function resolveAll(
    slot: SlotName,
    ctx: SlotGuardContext = OPEN_GUARD_CONTEXT,
  ): readonly SlotRegistration[] {
    return candidatesFor(slot, ctx).sort(
      (a, b) => b.priority - a.priority || b.registeredAt - a.registeredAt,
    );
  }

  function subscribe(listener: RegistryListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot(): ReadonlyMap<string, SlotRegistration> {
    return entries;
  }

  function clear(): void {
    entries.clear();
    notify();
  }

  return { register, unregister, resolve, resolveAll, subscribe, getSnapshot, clear };
}

/** Module-wide default registry: what `registerSlot()` and the default `<Slot>` use. */
export const defaultSlotRegistry: SlotRegistry = createSlotRegistry();

/** `registerSlot(name, Component, { priority, when })` — Interface contract surface. */
export function registerSlot(
  slot: SlotName,
  component: ComponentType,
  options?: SlotRegistrationOptions,
): () => void {
  return defaultSlotRegistry.register(slot, component, options);
}
