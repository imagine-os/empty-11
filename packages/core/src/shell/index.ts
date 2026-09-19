/**
 * `@paperos/core/shell` — the app-shell runtime (PAP-16).
 *
 * Separate package.json export subpath (`"./shell"`), not part of the root
 * `@paperos/core` barrel, so importing plain `@paperos/core` never pulls in
 * React (see `README.md`). Import CSS separately from `@paperos/core/shell/shell.css`.
 */

export type { AppShellProps, LayoutMode, PanelMode } from './AppShell.js';
export { AppShell, inspectorModeFor, sidebarModeFor } from './AppShell.js';
export type { ActionDescriptor, RegisteredPageActions } from './actions-registry.js';
export {
  clearActionsRegistry,
  getAllActions,
  registerPageActions,
  subscribeActions,
} from './actions-registry.js';

export {
  clearComponentRegistry,
  registerComponent,
  resolveComponent,
} from './component-registry.js';

export { isDevMode } from './dev-mode.js';
export type { ShellProviderProps } from './layout-context.js';
export { ShellProvider, useLayout, useShellContext } from './layout-context.js';
export type { ModuleRouteSource, RouteContribution } from './route-contribution.js';
export { composeRoutes } from './route-contribution.js';
export type { SlotProps } from './Slot.js';
export { Slot } from './Slot.js';
export type { ShellSearch } from './shell-search.js';
export {
  INSPECTOR_DEFAULT,
  parseShellSearch,
  SIDEBAR_DEFAULT,
  validateShellSearch,
} from './shell-search.js';
export type { RegistryListener, SlotRegistry } from './slot-registry.js';
export { createSlotRegistry, defaultSlotRegistry, registerSlot } from './slot-registry.js';
export type { SpecSlotFill } from './spec-adapter.js';
export { layoutFromSpec, useSpecLayout } from './spec-adapter.js';
export type { NotWiredYetProps } from './toast.js';
export { NotWiredYet, ToastProvider, useToast } from './toast.js';

export type {
  RouteStaticData,
  SlotFill,
  SlotGuard,
  SlotGuardContext,
  SlotName,
  SlotRegistration,
  SlotRegistrationOptions,
} from './types.js';
export { OPEN_GUARD_CONTEXT, SLOT_NAMES } from './types.js';

export { useAtLeastBreakpoint, useBreakpoint } from './use-breakpoint.js';
export type { ShellSearchApi } from './use-shell-search.js';
export { useShellSearch } from './use-shell-search.js';

export { clearSpecRegistry, getSpec, registerSpec, useSpec } from './use-spec.js';
