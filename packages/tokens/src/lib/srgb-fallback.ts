import { formatRgb, parse } from 'culori';

const OKLCH_RE = /oklch\([^)]*\)/g;

/**
 * Replaces every `oklch(...)` function in a CSS value string with its sRGB
 * `rgb()` equivalent, for the `@supports not (color: oklch(0% 0 0))`
 * fallback block. Used on `color` tokens directly and on `shadow` tokens
 * (whose value embeds an `oklch()` for the shadow's own colour).
 */
export function toSrgbFallback(cssValue: string): string {
  return cssValue.replace(OKLCH_RE, (match) => {
    const parsed = parse(match);
    if (!parsed) {
      throw new Error(`could not parse colour for sRGB fallback: ${match}`);
    }
    return formatRgb(parsed);
  });
}

export function containsOklch(cssValue: string): boolean {
  return cssValue.includes('oklch(');
}
