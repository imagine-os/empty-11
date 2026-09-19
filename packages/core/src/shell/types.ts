/**
 * Shared types for the app-shell slot system (PAP-16).
 *
 * `@paperos/core/shell` is the interim home for these types until PAP-447
 * publishes `@paperos/contract-app-shell` and PAP-453 wires it into the
 * kernel; the shapes here are what that contract package formalizes.
 */
import type { ComponentType, ReactNode } from 'react';

/** Exhaustive named slot ids the shell exposes (Interface & Data Contracts §2, PAP-16). */
export type SlotName = 'nav' | 'sidebar' | 'main' | 'inspector' | 'commandbar' | 'statusbar';

export const SLOT_NAMES: readonly SlotName[] = [
  'nav',
  'sidebar',
  'main',
  'inspector',
  'commandbar',
  'statusbar',
] as const;

/** Route-level metadata a page's `createFileRoute(...)` attaches via `staticData`. */
export interface RouteStaticData {
  readonly spec?: string;
  readonly audience?: string;
  readonly title?: string;
  readonly breadcrumb?: string;
}

/** A guard predicate a slot fill is shown under; evaluated against the current context. */
export type SlotGuard = (ctx: SlotGuardContext) => boolean;

/** Context passed to a `when` guard. Interim — PAP-59 (audience) and flags land the real checks. */
export interface SlotGuardContext {
  readonly can: (permission: string) => boolean;
  readonly flag: (name: string) => boolean;
}

/** Default guard context: everything allowed. Real audience/flag ports replace this later. */
export const OPEN_GUARD_CONTEXT: SlotGuardContext = {
  can: () => true,
  flag: () => false,
};

export interface SlotRegistrationOptions {
  /** Higher wins. Equal priority: last registration wins, with a dev warning. Default 0. */
  readonly priority?: number;
  /** Guard predicate; unset means always shown. */
  readonly when?: SlotGuard | undefined;
  /** Stable id for this fill, used to replace/unregister it (e.g. on route change). Defaults to an internal counter. */
  readonly id?: string;
}

export interface SlotRegistration extends SlotRegistrationOptions {
  readonly id: string;
  readonly slot: SlotName;
  readonly component: ComponentType;
  readonly priority: number;
  readonly registeredAt: number;
}

/** A resolved, render-ready fill: either a registered component or raw node content from `useLayout()`. */
export type SlotFill =
  | { readonly kind: 'component'; readonly Component: ComponentType }
  | { readonly kind: 'node'; readonly node: ReactNode };
