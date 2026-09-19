/**
 * PAP-14 — Vitest snapshot of the generator output, plus a `BreakpointName`
 * exhaustiveness check.
 */
import { describe, expect, it } from 'vitest';
import {
  BREAKPOINTS,
  type BreakpointName,
  breakpointForWidth,
  DEVICE_CLASSES,
  MATRIX_VERSION,
  toBreakpointsJson,
} from './matrix.js';

describe('gen:breakpoints output', () => {
  it('matches the committed snapshot', () => {
    expect(toBreakpointsJson()).toMatchSnapshot();
  });

  it('carries the current MATRIX_VERSION', () => {
    expect(toBreakpointsJson().version).toBe(MATRIX_VERSION);
  });

  it('has exactly the seven canonical widths, ascending', () => {
    const widths = BREAKPOINTS.map((bp) => bp.minWidth);
    expect(widths).toEqual([360, 390, 768, 1280, 1920, 2560, 3840]);
  });
});

describe('BreakpointName exhaustiveness', () => {
  it('BREAKPOINTS covers every BreakpointName exactly once', () => {
    // If a name is added to/removed from the union without a matching entry
    // here, this object literal fails to type-check (excess/missing key).
    const seen: Record<BreakpointName, true> = {
      xs: true,
      sm: true,
      md: true,
      lg: true,
      xl: true,
      '2xl': true,
      '3xl': true,
    };
    expect(Object.keys(seen).sort()).toEqual(BREAKPOINTS.map((bp) => bp.name).sort());
  });
});

describe('DEVICE_CLASSES', () => {
  it('has all six ticket-required classes', () => {
    expect(DEVICE_CLASSES.map((c) => c.id).sort()).toEqual(
      ['desktop', 'foldable', 'laptop', 'phone', 'tablet', 'tv-kiosk'].sort(),
    );
  });
});

describe('breakpointForWidth', () => {
  it.each([
    [320, 'xs'],
    [360, 'xs'],
    [389, 'xs'],
    [390, 'sm'],
    [767, 'sm'],
    [768, 'md'],
    [984, 'md'],
    [1279, 'md'],
    [1280, 'lg'],
    [1920, 'xl'],
    [2560, '2xl'],
    [3840, '3xl'],
    [7680, '3xl'],
  ] as const)('maps %ipx to %s', (width: number, expected: BreakpointName) => {
    expect(breakpointForWidth(width)).toBe(expected);
  });
});
