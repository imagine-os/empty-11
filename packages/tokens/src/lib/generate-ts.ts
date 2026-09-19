import { cssVarName } from './dtcg.js';
import { DEFAULT_FLUID_RANGE } from './generate-css.js';
import type { ResolvedTheme, ThemeName } from './theme.js';
import type { FluidRange } from './transform.js';
import { toCssValue } from './transform.js';

type Tree = { [key: string]: Tree | string };

function setPath(tree: Tree, path: string[], value: string): void {
  let node = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] as string;
    const next = node[key];
    if (typeof next !== 'object' || next === null) {
      node[key] = {};
    }
    node = node[key] as Tree;
  }
  node[path[path.length - 1] as string] = value;
}

function serialize(tree: Tree, depth = 1): string {
  const pad = '  '.repeat(depth);
  const lines = Object.entries(tree).map(([key, value]) => {
    const safeKey = /^[a-zA-Z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    if (typeof value === 'string') {
      return `${pad}${safeKey}: ${JSON.stringify(value)},`;
    }
    return `${pad}${safeKey}: {\n${serialize(value, depth + 1)}\n${pad}},`;
  });
  return lines.join('\n');
}

const GENERATED_HEADER = `/**
 * GENERATED FILE -- do not edit by hand.
 * Source: packages/tokens/tokens/**.tokens.json
 * Run \`pnpm --filter @paperos/tokens build\` to regenerate.
 */
`;

/** The literal, alias-resolved value of every token, per theme, as plain nested objects. */
export function computeRawByTheme(
  themes: Record<ThemeName, ResolvedTheme>,
  range: FluidRange = DEFAULT_FLUID_RANGE,
): Record<ThemeName, Tree> {
  const rawByTheme: Record<ThemeName, Tree> = { light: {}, dark: {}, hc: {} };
  for (const [themeName, theme] of Object.entries(themes) as [ThemeName, ResolvedTheme][]) {
    for (const token of theme.tokens) {
      setPath(rawByTheme[themeName], token.path, toCssValue(token, range));
    }
  }
  return rawByTheme;
}

/**
 * Emits `raw-tokens.json`: the same data as `rawTokens` in tokens.ts, as
 * plain JSON. Anything that cannot execute TypeScript/ESM (a static HTML
 * page opened without a bundler, e.g. the PAP-66 evidence swatch page)
 * fetches this instead of importing tokens.ts.
 */
export function generateRawTokensJson(
  themes: Record<ThemeName, ResolvedTheme>,
  range: FluidRange = DEFAULT_FLUID_RANGE,
): string {
  return `${JSON.stringify(computeRawByTheme(themes, range), null, 2)}\n`;
}

/**
 * Emits `tokens.ts`: \`tokens\` (every leaf as a \`var(--pos-*)\` reference,
 * theme-agnostic since the CSS variable itself switches with
 * \`[data-theme]\`), \`rawTokens\` (the same shape with the literal resolved
 * value, once per theme -- for anywhere that needs a real value at build or
 * test time instead of a CSS variable, e.g. contrast checks or email/PDF
 * rendering that cannot use CSS custom properties), and the \`TokenPath\`
 * union type.
 */
export function generateTokensTs(
  themes: Record<ThemeName, ResolvedTheme>,
  range: FluidRange = DEFAULT_FLUID_RANGE,
): string {
  const allPaths = new Set<string>();
  for (const theme of Object.values(themes)) {
    for (const token of theme.tokens) {
      allPaths.add(token.path.join('.'));
    }
  }
  const sortedPaths = [...allPaths].sort();

  const varTree: Tree = {};
  for (const path of sortedPaths) {
    setPath(varTree, path.split('.'), `var(${cssVarName(path.split('.'))})`);
  }

  const rawByTheme = computeRawByTheme(themes, range);

  const tokenPathUnion = sortedPaths.map((p) => JSON.stringify(p)).join('\n  | ');

  return `${GENERATED_HEADER}
/** Every token path this build knows about, e.g. "color.bg.surface". */
export type TokenPath =
  | ${tokenPathUnion};

/**
 * \`tokens.color.bg.surface\` -> \`"var(--pos-color-bg-surface)"\`. Use this in
 * component styles; the CSS variable itself changes value with
 * \`[data-theme]\`, so the same reference works in every theme.
 */
export const tokens = {
${serialize(varTree)}
} as const;

/**
 * The literal, alias-resolved value of every token, per theme -- for
 * contexts that cannot read a CSS custom property (contrast tests, email
 * and PDF rendering, non-DOM snapshot tests).
 */
export const rawTokens = {
  light: {
${serialize(rawByTheme.light, 2)}
  },
  dark: {
${serialize(rawByTheme.dark, 2)}
  },
  hc: {
${serialize(rawByTheme.hc, 2)}
  },
} as const;
`;
}
