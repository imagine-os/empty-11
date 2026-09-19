/**
 * Spec-to-shell adapter: turns a page spec's `components` (grouped by each
 * node's `slot`) into slot registrations, and its `logic.actions` into
 * actions-registry entries — the two things a route needs from its spec to
 * render inside `<AppShell>`.
 *
 * Structurally typed against `@paperos/spec`'s real `PageSpec`/`Component`/
 * `Action` shapes (PAP-114, landed after this issue's spec was written) —
 * deliberately *not* imported from `@paperos/spec`: `@paperos/spec` already
 * depends on `@paperos/core` (for shared value types like `FilterTree`), so
 * an import the other way would be a real dependency cycle, not just a type
 * one. TypeScript's structural typing means the real `PageSpec` satisfies
 * `SpecLike` without either package importing the other — a port
 * (`docs/module-system.md` §3), not a direct dependency. `apps/web`, which
 * depends on both packages, is where the real type and this port meet.
 */
import { type ComponentType, useEffect } from 'react';
import { registerPageActions } from './actions-registry.js';
import { resolveComponent } from './component-registry.js';
import { useShellContext } from './layout-context.js';
import { SLOT_NAMES, type SlotName } from './types.js';

/** Structural subset of `@paperos/spec`'s `Component` this adapter reads. */
export interface SpecComponentLike {
  readonly id: string;
  readonly slot?: string | undefined;
  readonly status?: string | undefined;
  readonly props?: Record<string, unknown> | undefined;
}

/** Structural subset of `@paperos/spec`'s `Action` (under `logic.actions`). */
export interface SpecActionLike {
  readonly intent: string | { readonly id: string; readonly default?: string | undefined };
  readonly permission: string;
  readonly status?: string | undefined;
}

/** Structural subset of `@paperos/spec`'s `PageSpec` this adapter needs. */
export interface SpecLike {
  readonly meta?: { readonly id?: string | undefined } | undefined;
  readonly components?: readonly SpecComponentLike[] | undefined;
  readonly logic?: { readonly actions?: Record<string, SpecActionLike> | undefined } | undefined;
}

export interface SpecSlotFill {
  readonly slot: SlotName;
  readonly componentId: string;
  readonly component: ComponentType | undefined;
  readonly notWired: boolean;
  readonly props: Record<string, unknown>;
}

/** Placeholder shown for a spec-named component missing from the registry (dev only). */
function MissingComponent({ id }: { id: string }) {
  return (
    <div role="alert" className="paperos-missing-component">
      Missing component: <code>{id}</code>
    </div>
  );
}

/** `messageKeyOf`-equivalent for the loose structural `intent` shape (bare key or `{ id, default }`). */
function intentText(intent: SpecActionLike['intent']): string {
  return typeof intent === 'string' ? intent : (intent.default ?? intent.id);
}

/**
 * Groups a spec's `components` by slot (default `main`, per the real schema's
 * `Component.slot` default). Only root-level nodes are placed in a slot; a
 * node's own `children` render as part of its parent (a generic
 * component-tree renderer is PAP-69/74's job, out of this issue's scope).
 * `header`/`footer` (public/kiosk-only slots `@paperos/spec` reserves beyond
 * this issue's six) are skipped with a dev warning until a later issue adds
 * those regions to `<AppShell>`.
 */
export function layoutFromSpec(
  components: readonly SpecComponentLike[] | undefined,
): readonly SpecSlotFill[] {
  if (!components) return [];
  const fills: SpecSlotFill[] = [];
  for (const node of components) {
    const slotName = node.slot ?? 'main';
    if (!SLOT_NAMES.includes(slotName as SlotName)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[paperos/shell] component "${node.id}" targets slot "${slotName}", which <AppShell> does not (yet) expose.`,
        );
      }
      continue;
    }
    fills.push({
      slot: slotName as SlotName,
      componentId: node.id,
      component: resolveComponent(node.id),
      notWired: node.status === 'not-wired',
      props: node.props ?? {},
    });
  }
  return fills;
}

/**
 * Registers every root-level component a spec declares against the current
 * `<ShellProvider>` registry, and every `logic.actions` entry against the
 * actions registry (org standard: every page declares its actions) — both
 * for the lifetime of the calling route component. One call replaces what
 * would otherwise be a separate `useLayout()` plus manual
 * `registerPageActions()` per route.
 */
export function useSpecLayout(spec: SpecLike | undefined): void {
  const { registry } = useShellContext();

  useEffect(() => {
    const fills = layoutFromSpec(spec?.components);
    const unregisterFns = fills.map(({ slot, component, componentId, notWired, props }) => {
      const Resolved: ComponentType = component
        ? () => {
            const Content = component;
            return notWired ? (
              <div
                className="paperos-not-wired"
                data-not-wired="true"
                title={`${componentId} — not wired yet`}
              >
                <Content {...props} />
              </div>
            ) : (
              <Content {...props} />
            );
          }
        : () => {
            if (process.env.NODE_ENV === 'production') {
              console.error(
                `[paperos/shell] spec names unknown component "${componentId}" for slot "${slot}".`,
              );
              return null;
            }
            return <MissingComponent id={componentId} />;
          };
      return registry.register(slot, Resolved, { id: `spec:${slot}:${componentId}` });
    });
    return () => {
      for (const unregister of unregisterFns) unregister();
    };
  }, [spec, registry]);

  useEffect(() => {
    if (!spec?.logic?.actions) return;
    const routeId = spec.meta?.id ?? 'unknown';
    return registerPageActions(
      routeId,
      Object.entries(spec.logic.actions).map(([id, action]) => ({
        id: `${routeId}.${id}`,
        intent: intentText(action.intent),
        permission: action.permission,
        wired: action.status !== 'not-wired',
      })),
    );
  }, [spec]);
}
