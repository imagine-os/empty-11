/**
 * `useBreakpoint()` — subscribes to `window.innerWidth` and returns the
 * current tier from `../devices/matrix.js` (PAP-14, BREAKPOINTS/DEVICE_CLASSES).
 *
 * Interim `matchMedia`-based implementation, as the spec calls for ("interim
 * media queries; PAP-21 replaces them with container queries"). Used by
 * `AppShell` to decide when the sidebar/inspector collapse to a drawer.
 */
import { useSyncExternalStore } from 'react';
import { BREAKPOINTS, type BreakpointName, breakpointForWidth } from '../devices/matrix.js';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

const LARGEST_BREAKPOINT_WIDTH = BREAKPOINTS.at(-1)?.minWidth ?? 3840;

function getWidth(): number {
  return typeof window === 'undefined' ? LARGEST_BREAKPOINT_WIDTH : window.innerWidth;
}

/** Current tier name (`'xs'..'3xl'`), reactive to resize. SSR-safe fallback: the largest tier. */
export function useBreakpoint(): BreakpointName {
  const width = useSyncExternalStore(subscribe, getWidth, getWidth);
  return breakpointForWidth(width);
}

/** True once the viewport is at least as wide as `name`'s tier. */
export function useAtLeastBreakpoint(name: BreakpointName): boolean {
  const current = useBreakpoint();
  const currentIndex = BREAKPOINTS.findIndex((b) => b.name === current);
  const targetIndex = BREAKPOINTS.findIndex((b) => b.name === name);
  return currentIndex >= targetIndex;
}
