#!/usr/bin/env tsx
/**
 * Generates the 11-step OKLCH colour ramps (50-950) for every colour family
 * using `culori`, and prints a DTCG-format JSON fragment to stdout.
 *
 * This is a design-time tool, not part of `build`: a designer (or Iris) runs
 * it when a ramp's hue or chroma curve changes, reviews the printed OKLCH
 * strings (culori clamps each one into the sRGB gamut and reports if it had
 * to), and pastes the result into `tokens/core.tokens.json` by hand. Token
 * *build* only ever reads the committed JSON — it never regenerates colour
 * math on the fly, so a designer can hand-tune one stop without the whole
 * ramp recomputing under them.
 *
 * Run: `pnpm --filter @paperos/tokens ramps`
 */
import { clampChroma, formatCss } from 'culori';

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

/** Lightness (OKLCH L, 0-1) at each of the 11 steps, light to dark. */
const LIGHTNESS: Record<RampStep, number> = {
  50: 0.98,
  100: 0.95,
  200: 0.9,
  300: 0.83,
  400: 0.74,
  500: 0.64,
  600: 0.55,
  700: 0.46,
  800: 0.38,
  900: 0.3,
  950: 0.22,
};

/** Relative chroma shape (0-1) at each step; multiplied by a family's peak chroma. */
const CHROMA_SHAPE: Record<RampStep, number> = {
  50: 0.1,
  100: 0.2,
  200: 0.4,
  300: 0.65,
  400: 0.85,
  500: 1.0,
  600: 0.95,
  700: 0.82,
  800: 0.66,
  900: 0.5,
  950: 0.36,
};

export interface RampRecipe {
  /** OKLCH hue in degrees. */
  hue: number;
  /** Peak chroma reached around the 500 step. */
  peakChroma: number;
}

/** One recipe per family. Hues are spread for hue-only colour-blind separation; peak chroma keeps neutral near-achromatic. */
export const RAMP_RECIPES: Record<string, RampRecipe> = {
  neutral: { hue: 260, peakChroma: 0.012 },
  accent: { hue: 260, peakChroma: 0.19 },
  success: { hue: 145, peakChroma: 0.17 },
  warning: { hue: 80, peakChroma: 0.16 },
  danger: { hue: 25, peakChroma: 0.2 },
  info: { hue: 230, peakChroma: 0.15 },
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function buildRamp(
  recipe: RampRecipe,
): Record<RampStep, { value: string; wasClamped: boolean }> {
  const out = {} as Record<RampStep, { value: string; wasClamped: boolean }>;
  for (const step of RAMP_STEPS) {
    const requested = {
      mode: 'oklch' as const,
      l: LIGHTNESS[step],
      c: recipe.peakChroma * CHROMA_SHAPE[step],
      h: recipe.hue,
    };
    // Requested chroma at this lightness/hue may fall outside sRGB; clamp it to
    // the gamut boundary (culori walks chroma down until the colour fits) so
    // every emitted value round-trips through `color: oklch(...)` in real
    // browsers without the browser doing its own, unpredictable clamping.
    const fitted = clampChroma(requested, 'oklch', 'rgb');
    const wasClamped = fitted.c < requested.c - 1e-6;
    const rounded = {
      ...fitted,
      l: round4(fitted.l),
      c: round4(fitted.c),
      h: round4(fitted.h ?? 0),
    };
    out[step] = { value: formatCss(rounded), wasClamped };
  }
  return out;
}

function main() {
  const families: Record<string, Record<string, { $type: string; $value: string }>> = {};
  for (const [name, recipe] of Object.entries(RAMP_RECIPES)) {
    const ramp = buildRamp(recipe);
    const scale: Record<string, { $type: string; $value: string }> = {};
    for (const step of RAMP_STEPS) {
      const { value, wasClamped } = ramp[step];
      if (wasClamped) {
        process.stderr.write(`note: ${name}.${step} chroma clamped to sRGB gamut -> ${value}\n`);
      }
      scale[String(step)] = { $type: 'color', $value: value };
    }
    families[name] = scale;
  }
  process.stdout.write(`${JSON.stringify({ color: families }, null, 2)}\n`);
}

// Only run when executed directly (`tsx scripts/generate-ramps.ts`), not when imported by tests.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
