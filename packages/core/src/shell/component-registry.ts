/**
 * Interim component registry — `resolveComponent(name)`.
 *
 * TODO(PAP-69): this is a stand-in for the real component registry project.
 * PAP-69 owns the permanent `ui.<component>` id scheme (module-system.md §4)
 * that a module manifest's slot `fills` reference; until it lands, the spec
 * adapter (`spec-adapter.ts`) resolves a spec's `layout.slots.<slot>.component`
 * string through this in-memory map, which `apps/web` populates at boot with
 * its example components.
 */
import type { ComponentType } from 'react';

const registry = new Map<string, ComponentType>();

/** Registers a component under a stable name so specs can reference it by string. */
export function registerComponent(name: string, component: ComponentType): void {
  registry.set(name, component);
}

/** Looks up a component by name; `undefined` when unregistered (edge case: spec names a missing component). */
export function resolveComponent(name: string): ComponentType | undefined {
  return registry.get(name);
}

/** Test/dev helper to reset between suites — never called from app code. */
export function clearComponentRegistry(): void {
  registry.clear();
}
