import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type FlatToken,
  flatten,
  loadTokenFile,
  mergeTrees,
  resolveAliases,
  type TokenGroup,
} from './dtcg.js';
import { applyRemTransform } from './transform.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TOKENS_DIR = join(HERE, '..', '..', 'tokens');

export const THEME_NAMES = ['light', 'dark', 'hc'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Files merged into every theme, in order (later wins on a leaf collision). */
export const SHARED_TOKEN_FILES = [
  'core.tokens.json',
  'semantic.tokens.json',
  'reserved/dataviz.tokens.json',
  'reserved/density.tokens.json',
] as const;

export function themeFile(theme: ThemeName): string {
  return `themes/${theme}.tokens.json`;
}

export function loadSharedTree(): TokenGroup {
  return mergeTrees(...SHARED_TOKEN_FILES.map((f) => loadTokenFile(join(TOKENS_DIR, f))));
}

export function loadRawThemeTree(theme: ThemeName): TokenGroup {
  return mergeTrees(loadSharedTree(), loadTokenFile(join(TOKENS_DIR, themeFile(theme))));
}

export interface ResolvedTheme {
  theme: ThemeName;
  /** Alias-resolved, rem-transformed leaf tokens, keyed by dotted path for quick lookup. */
  tokens: FlatToken[];
  byPath: Map<string, FlatToken>;
}

export function resolveTheme(theme: ThemeName, usedPaths?: Set<string>): ResolvedTheme {
  const raw = loadRawThemeTree(theme);
  const resolved = resolveAliases(raw, usedPaths);
  const tokens = applyRemTransform(flatten(resolved));
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  return { theme, tokens, byPath };
}

export function resolveAllThemes(): Record<ThemeName, ResolvedTheme> {
  const usedPaths = new Set<string>();
  const entries = THEME_NAMES.map((theme) => [theme, resolveTheme(theme, usedPaths)] as const);
  return Object.fromEntries(entries) as Record<ThemeName, ResolvedTheme>;
}
