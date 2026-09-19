import { cssVarName, type FlatToken } from './dtcg.js';
import { containsOklch, toSrgbFallback } from './srgb-fallback.js';
import type { ResolvedTheme, ThemeName } from './theme.js';
import { type FluidRange, toCssValue } from './transform.js';

export const DEFAULT_FLUID_RANGE: FluidRange = { minVw: 360, maxVw: 3840 };

const GENERATED_HEADER = `/**
 * GENERATED FILE -- do not edit by hand.
 * Source: packages/tokens/tokens/**.tokens.json
 * Run \`pnpm --filter @paperos/tokens build\` to regenerate.
 * CI's drift check fails if a commit changes the sources without also
 * committing a fresh build of this file.
 */
`;

interface Entry {
  name: string;
  type: FlatToken['type'];
  value: string;
}

function entriesFor(theme: ResolvedTheme, range: FluidRange): Map<string, Entry> {
  const out = new Map<string, Entry>();
  for (const token of theme.tokens) {
    const name = cssVarName(token.path);
    out.set(name, { name, type: token.type, value: toCssValue(token, range) });
  }
  return out;
}

function indent(lines: string[], depth = 1): string {
  const pad = '  '.repeat(depth);
  return lines.map((l) => `${pad}${l}`).join('\n');
}

function declarationBlock(entries: Entry[]): string {
  return indent(
    entries
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => `${e.name}: ${e.value};`),
  );
}

/**
 * Builds `tokens.css`: shared tokens once in `:root`, theme-varying tokens
 * (color roles, elevation shadows) in `:root`/`@media`/`[data-theme]` blocks,
 * and an `@supports not (color: oklch(0% 0 0))` sRGB fallback mirror of
 * every colour/shadow declaration for browsers without OKLCH support.
 */
export function generateTokensCss(
  themes: Record<ThemeName, ResolvedTheme>,
  range: FluidRange = DEFAULT_FLUID_RANGE,
): string {
  const byTheme = {
    light: entriesFor(themes.light, range),
    dark: entriesFor(themes.dark, range),
    hc: entriesFor(themes.hc, range),
  };

  const allNames = new Set<string>([
    ...byTheme.light.keys(),
    ...byTheme.dark.keys(),
    ...byTheme.hc.keys(),
  ]);

  const shared: Entry[] = [];
  const varying: Record<ThemeName, Entry[]> = { light: [], dark: [], hc: [] };

  for (const name of allNames) {
    const light = byTheme.light.get(name);
    const dark = byTheme.dark.get(name);
    const hc = byTheme.hc.get(name);
    if (!light || !dark || !hc) {
      throw new Error(`token "${name}" is missing from at least one theme`);
    }
    if (light.value === dark.value && light.value === hc.value) {
      shared.push(light);
    } else {
      varying.light.push(light);
      varying.dark.push(dark);
      varying.hc.push(hc);
    }
  }

  const fallbackOf = (e: Entry): Entry | undefined => {
    if ((e.type !== 'color' && e.type !== 'shadow') || !containsOklch(e.value)) {
      return undefined;
    }
    return { ...e, value: toSrgbFallback(e.value) };
  };

  const sections: string[] = [GENERATED_HEADER];

  sections.push(`:root {\n${declarationBlock([...shared, ...varying.light])}\n}`);
  sections.push(
    `@media (prefers-color-scheme: dark) {\n  /* Only applies when nobody has set data-theme explicitly. */\n  :root:not([data-theme]) {\n${declarationBlock(varying.dark)}\n  }\n}`,
  );
  sections.push(`[data-theme="light"] {\n${declarationBlock(varying.light)}\n}`);
  sections.push(`[data-theme="dark"] {\n${declarationBlock(varying.dark)}\n}`);
  sections.push(`[data-theme="hc"] {\n${declarationBlock(varying.hc)}\n}`);

  const fallbackShared = shared.map(fallbackOf).filter((e): e is Entry => e !== undefined);
  const fallbackLight = varying.light.map(fallbackOf).filter((e): e is Entry => e !== undefined);
  const fallbackDark = varying.dark.map(fallbackOf).filter((e): e is Entry => e !== undefined);
  const fallbackHc = varying.hc.map(fallbackOf).filter((e): e is Entry => e !== undefined);

  if (fallbackShared.length || fallbackLight.length || fallbackDark.length || fallbackHc.length) {
    const supportsBlock = [
      '@supports not (color: oklch(0% 0 0)) {',
      '  /* sRGB fallback for browsers without OKLCH support (DoD, PAP-66). */',
      // Mirror the main `:root` block: shared tokens plus the light default of
      // every theme-varying token, so a browser without OKLCH and no
      // `data-theme` attribute still gets its colours.
      fallbackShared.length || fallbackLight.length
        ? `  :root {\n${declarationBlock([...fallbackShared, ...fallbackLight])}\n  }`
        : '',
      fallbackDark.length
        ? `  @media (prefers-color-scheme: dark) {\n    :root:not([data-theme]) {\n${declarationBlock(fallbackDark)}\n    }\n  }`
        : '',
      fallbackLight.length
        ? `  [data-theme="light"] {\n${declarationBlock(fallbackLight)}\n  }`
        : '',
      fallbackDark.length ? `  [data-theme="dark"] {\n${declarationBlock(fallbackDark)}\n  }` : '',
      fallbackHc.length ? `  [data-theme="hc"] {\n${declarationBlock(fallbackHc)}\n  }` : '',
      '}',
    ]
      .filter(Boolean)
      .join('\n');
    sections.push(supportsBlock);
  }

  return `${sections.join('\n\n')}\n`;
}

/**
 * Builds `theme.css`: a Tailwind v4 `@theme` block mapping the semantic and
 * scale tokens into Tailwind's own namespaces (`--color-*`, `--font-*`,
 * `--text-*`, `--radius-*`, `--spacing-*`, `--breakpoint-*`, `--shadow-*`,
 * `--ease-*`), each pointing at the matching `--pos-*` variable so Tailwind
 * utilities and our own CSS agree on one value. Tailwind's default palette
 * is disabled (`--color-*: initial`) so `bg-red-500` cannot resolve to
 * Tailwind's built-in red instead of a PaperOS token.
 *
 * This file is inert until a consuming app installs Tailwind v4 (not yet
 * true anywhere in this template -- see docs/platform/design-tokens.md).
 * Forge owns the Tailwind wiring; treat the exact namespace choices here as
 * a starting point for that review, not a frozen contract.
 */
export function generateThemeCss(themes: Record<ThemeName, ResolvedTheme>): string {
  const light = themes.light.byPath;

  const colorMap: [string, string][] = [
    ['canvas', 'color.bg.canvas'],
    ['surface', 'color.bg.surface'],
    ['raised', 'color.bg.raised'],
    ['overlay', 'color.bg.overlay'],
    ['fg', 'color.fg.default'],
    ['fg-muted', 'color.fg.muted'],
    ['fg-subtle', 'color.fg.subtle'],
    ['on-accent', 'color.fg.on-accent'],
    ['border', 'color.border.default'],
    ['border-strong', 'color.border.strong'],
    ['accent', 'color.accent.default'],
    ['accent-hover', 'color.accent.hover'],
    ['accent-active', 'color.accent.active'],
    ['success', 'color.success.fg'],
    ['success-bg', 'color.success.bg'],
    ['warning', 'color.warning.fg'],
    ['warning-bg', 'color.warning.bg'],
    ['danger', 'color.danger.fg'],
    ['danger-bg', 'color.danger.bg'],
    ['info', 'color.info.fg'],
    ['info-bg', 'color.info.bg'],
    ['focus', 'color.focus'],
  ];

  const lines: string[] = [
    '@theme {',
    "  /* Disable Tailwind's built-in palette so only tokens resolve. */",
    '  --color-*: initial;',
    '',
  ];

  for (const [name, path] of colorMap) {
    if (!light.has(path)) {
      throw new Error(`theme.css: light theme has no token at "${path}"`);
    }
    lines.push(`  --color-${name}: var(${cssVarName(path.split('.'))});`);
  }

  lines.push('');
  for (const step of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']) {
    lines.push(`  --text-${step}: var(${cssVarName(['font', 'size', step])});`);
  }
  lines.push('');
  lines.push(`  --font-sans: var(${cssVarName(['font', 'family', 'sans'])});`);
  lines.push(`  --font-mono: var(${cssVarName(['font', 'family', 'mono'])});`);
  for (const weight of ['regular', 'medium', 'semibold', 'bold']) {
    lines.push(`  --font-weight-${weight}: var(${cssVarName(['font', 'weight', weight])});`);
  }
  lines.push('');
  for (const step of ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full']) {
    lines.push(`  --radius-${step}: var(${cssVarName(['radius', step])});`);
  }
  lines.push('');
  for (const step of ['0', '4', '8', '12', '16', '20', '24', '32', '40', '48', '64', '80', '96']) {
    lines.push(`  --spacing-${step}: var(${cssVarName(['space', step])});`);
  }
  lines.push('');
  for (const bp of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']) {
    lines.push(`  --breakpoint-${bp}: var(${cssVarName(['breakpoint', bp])});`);
  }
  lines.push('');
  for (const step of ['1', '2', '3', '4', '5']) {
    lines.push(`  --shadow-${step}: var(${cssVarName(['shadow', 'role', step])});`);
  }
  lines.push('');
  for (const ease of ['standard', 'enter', 'exit', 'spring']) {
    lines.push(`  --ease-${ease}: var(${cssVarName(['motion', 'ease', ease])});`);
  }
  lines.push('}');

  return `${GENERATED_HEADER}\n${lines.join('\n')}\n`;
}
