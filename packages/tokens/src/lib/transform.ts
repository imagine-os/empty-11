import type { FlatToken } from './dtcg.js';

const REM_BASE = 16;

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** `"16px"` -> 16. Throws on anything else so a bad token fails the build, not the browser. */
function parsePx(value: unknown): number {
  if (typeof value !== 'string' || !value.endsWith('px')) {
    throw new Error(`expected a "<number>px" dimension, got ${JSON.stringify(value)}`);
  }
  const n = Number.parseFloat(value.slice(0, -2));
  if (Number.isNaN(n)) {
    throw new Error(`expected a "<number>px" dimension, got ${JSON.stringify(value)}`);
  }
  return n;
}

/** `size/px-to-rem`: px -> rem at a 16px root, rounded to 4 decimals. */
export function pxToRem(pxValue: string): string {
  const px = parsePx(pxValue);
  if (px === 0) {
    return '0';
  }
  return `${round4(px / REM_BASE)}rem`;
}

export interface FluidRange {
  minVw: number;
  maxVw: number;
}

/**
 * `fluid-size`: expands a `{min, max}` dimension pair into a `clamp()` that
 * scales linearly with viewport width between `range.minVw` and
 * `range.maxVw` (360-3840 by default: the brief's phone-to-TV matrix,
 * pending PAP-14's device matrix), then multiplies the result by
 * `--pos-font-scale` (default 1) so PAP-647's text-size preference can scale
 * every fluid size from one variable.
 */
export function fluidSizeToClamp(value: unknown, range: FluidRange): string {
  if (typeof value !== 'object' || value === null || !('min' in value) || !('max' in value)) {
    throw new Error(`expected a fluid-size {min, max} value, got ${JSON.stringify(value)}`);
  }
  const minPx = parsePx((value as { min: unknown }).min);
  const maxPx = parsePx((value as { max: unknown }).max);
  const { minVw, maxVw } = range;
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const interceptPx = minPx - slope * minVw;
  const minRem = round4(minPx / REM_BASE);
  const maxRem = round4(maxPx / REM_BASE);
  const interceptRem = round4(interceptPx / REM_BASE);
  const vwCoefficient = round4(slope * 100);
  const preferred = `calc(${interceptRem}rem + ${vwCoefficient}vw)`;
  return `calc(clamp(${minRem}rem, ${preferred}, ${maxRem}rem) * var(--pos-font-scale, 1))`;
}

function formatFontFamily(value: unknown): string {
  if (!Array.isArray(value)) {
    throw new Error(`expected a font-family array, got ${JSON.stringify(value)}`);
  }
  return value.map((name) => (/\s/.test(name) ? `"${name}"` : name)).join(', ');
}

function formatCubicBezier(value: unknown): string {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(`expected a 4-number cubic-bezier array, got ${JSON.stringify(value)}`);
  }
  return `cubic-bezier(${value.join(', ')})`;
}

/** Converts one alias-resolved token into the literal string a CSS custom property gets. */
export function toCssValue(token: Pick<FlatToken, 'type' | 'value'>, range: FluidRange): string {
  switch (token.type) {
    case 'color':
    case 'duration':
    case 'shadow':
      return String(token.value);
    case 'dimension':
      // Breakpoints stay in px: they describe real viewport widths a media
      // query or matchMedia() call reasons about, not a type/space scale
      // that should track the root font size.
      return typeof token.value === 'string' && token.value.endsWith('px')
        ? token.value
        : String(token.value);
    case 'fluid-size':
      return fluidSizeToClamp(token.value, range);
    case 'font-family':
      return formatFontFamily(token.value);
    case 'font-weight':
    case 'number':
      return String(token.value);
    case 'cubic-bezier':
      return formatCubicBezier(token.value);
    default:
      return String(token.value);
  }
}

/** `dimension` tokens under `breakpoint.*` are the one group kept in px (see toCssValue). */
export function isBreakpointPath(path: string[]): boolean {
  return path[0] === 'breakpoint';
}

/** Applies `px-to-rem` to every non-breakpoint `dimension` token in place. */
export function applyRemTransform(tokens: FlatToken[]): FlatToken[] {
  return tokens.map((token) => {
    if (
      token.type === 'dimension' &&
      !isBreakpointPath(token.path) &&
      typeof token.value === 'string'
    ) {
      return { ...token, value: pxToRem(token.value) };
    }
    return token;
  });
}
