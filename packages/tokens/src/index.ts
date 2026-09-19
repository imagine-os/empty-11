/**
 * `@paperos/tokens` -- the design-system module's design tokens (PAP-66).
 *
 * DTCG JSON source lives in `tokens/`; `pnpm --filter @paperos/tokens build`
 * compiles it to `src/generated/{tokens.css,theme.css,tokens.ts}`, which
 * this file re-exports. See docs/platform/design-tokens.md for the full
 * contract (naming grammar, theme switching, the `--pos-font-scale` hook).
 */
export { rawTokens, type TokenPath, tokens } from './generated/tokens.js';

/** Registry id of this package, used by the module manifest once it lands (PAP-433). */
export const TOKENS_PACKAGE_ID = '@paperos/tokens' as const;

/** The `data-theme` attribute's only valid values (DoD: explicit attribute beats system preference). */
export const THEME_NAMES = ['light', 'dark', 'hc'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];
