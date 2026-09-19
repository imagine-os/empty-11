/**
 * `ShellProvider` / `useLayout()` — React glue around the pure slot registry.
 *
 * A page calls `useLayout({ sidebar: <Filters /> })` to fill a slot with
 * arbitrary content (Interface contract). The spec adapter (`spec-adapter.ts`)
 * calls the same registry directly with resolved named components, so both
 * paths (ad hoc JSX and spec-declared `layout.slots`) compose through one
 * registry per `<ShellProvider>`.
 */
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';
import { defaultSlotRegistry, type SlotRegistry } from './slot-registry.js';
import {
  OPEN_GUARD_CONTEXT,
  type SlotGuardContext,
  type SlotName,
  type SlotRegistrationOptions,
} from './types.js';

interface ShellContextValue {
  readonly registry: SlotRegistry;
  readonly guardContext: SlotGuardContext;
}

const ShellContext = createContext<ShellContextValue | undefined>(undefined);

export interface ShellProviderProps {
  /** Injected for tests; defaults to the shared app-wide registry. */
  readonly registry?: SlotRegistry | undefined;
  readonly guardContext?: SlotGuardContext | undefined;
  readonly children?: ReactNode;
}

export function ShellProvider({ registry, guardContext, children }: ShellProviderProps) {
  const value = useMemo<ShellContextValue>(
    () => ({
      registry: registry ?? defaultSlotRegistry,
      guardContext: guardContext ?? OPEN_GUARD_CONTEXT,
    }),
    [registry, guardContext],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/** Throws outside `<ShellProvider>` (mirrors how `useSearch`/`useNavigate` behave outside a router). */
export function useShellContext(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error(
      'useShellContext / useLayout / <Slot> must be used inside <ShellProvider> (rendered by <AppShell>).',
    );
  }
  return ctx;
}

/**
 * Fills one or more named slots with arbitrary JSX for as long as the caller
 * is mounted; unregisters on unmount. `options` (priority/when) applies to
 * every slot passed in this call — call it more than once for per-slot
 * priorities.
 */
export function useLayout(
  fills: Partial<Record<SlotName, ReactNode>>,
  options: SlotRegistrationOptions = {},
): void {
  const { registry } = useShellContext();
  const idBase = useId();
  const fillsRef = useRef(fills);
  fillsRef.current = fills;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Intentionally no dependency array: re-registers on every render so slot
  // content stays in sync with the caller's latest render, replacing (not
  // accumulating) entries because each slot's registration id is stable
  // per hook instance (`idBase`).
  useEffect(() => {
    const slots = Object.keys(fillsRef.current) as SlotName[];
    const unregisterFns = slots.map((slot) => {
      const id = `layout:${idBase}:${slot}`;
      function LayoutFill() {
        return <>{fillsRef.current[slot]}</>;
      }
      return registry.register(slot, LayoutFill, { ...optionsRef.current, id });
    });
    return () => {
      for (const unregister of unregisterFns) unregister();
    };
  });
}
