/**
 * `<Slot name="nav" />` — renders whatever is currently registered for that
 * slot in the nearest `<ShellProvider>`'s registry (Interface contract;
 * module-system.md §4: "renders whatever is registered; an unknown slot or
 * invalid props fails at boot in dev and renders nothing in production").
 */
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { useShellContext } from './layout-context.js';
import { SLOT_NAMES, type SlotName } from './types.js';

export interface SlotProps {
  readonly name: SlotName;
  /** Rendered when nothing is registered for this slot. */
  readonly fallback?: ReactNode;
}

export function Slot({ name, fallback = null }: SlotProps) {
  const { registry, guardContext } = useShellContext();

  // Hook runs unconditionally (rules of hooks); the name check below only
  // decides what to render with the result.
  const registration = useSyncExternalStore(
    registry.subscribe,
    () => registry.resolve(name, guardContext),
    () => registry.resolve(name, guardContext),
  );

  if (!SLOT_NAMES.includes(name)) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `[paperos/shell] <Slot name="${name}"> is not one of the known slots: ${SLOT_NAMES.join(', ')}.`,
      );
    }
    return null;
  }

  if (!registration) return <>{fallback}</>;
  const Component = registration.component;
  return <Component />;
}
