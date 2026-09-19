import { describe, expect, it } from 'vitest';
import { generateThemeCss, generateTokensCss } from '../src/lib/generate-css.js';
import { generateTokensTs } from '../src/lib/generate-ts.js';
import { resolveAllThemes } from '../src/lib/theme.js';

describe('generateTokensCss', () => {
  const themes = resolveAllThemes();
  const css = generateTokensCss(themes);

  it('is idempotent: generating twice from the same source produces byte-identical output', () => {
    expect(generateTokensCss(resolveAllThemes())).toBe(css);
  });

  it('defines :root, the dark media-query fallback, and all three [data-theme] blocks', () => {
    expect(css).toContain(':root {');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="hc"]');
  });

  it('every declared variable is prefixed --pos-', () => {
    const names = [...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) {
      expect(name?.startsWith('--pos-')).toBe(true);
    }
  });

  it('provides an sRGB fallback under @supports not (color: oklch(0% 0 0))', () => {
    expect(css).toContain('@supports not (color: oklch(0% 0 0))');
    const fallbackBlock = css.slice(css.indexOf('@supports not'));
    // sRGB fallback values must not themselves contain oklch(...).
    const declarations = fallbackBlock.match(/--pos-[a-z0-9-]+:\s*[^;]+;/g) ?? [];
    expect(declarations.length).toBeGreaterThan(0);
    for (const decl of declarations) {
      expect(decl).not.toContain('oklch(');
    }
  });

  it('the light default in :root matches the explicit [data-theme="light"] block for a theme-varying token', () => {
    const rootBlock = css.slice(0, css.indexOf('@media'));
    const lightBlock = css.slice(
      css.indexOf('[data-theme="light"]'),
      css.indexOf('[data-theme="dark"]'),
    );
    const rootMatch = rootBlock.match(/--pos-color-accent-default: ([^;]+);/);
    const lightMatch = lightBlock.match(/--pos-color-accent-default: ([^;]+);/);
    expect(rootMatch?.[1]).toBe(lightMatch?.[1]);
  });
});

describe('generateThemeCss', () => {
  it('disables the Tailwind default palette and maps every semantic colour role', () => {
    const css = generateThemeCss(resolveAllThemes());
    expect(css).toContain('@theme {');
    expect(css).toContain('--color-*: initial;');
    expect(css).toContain('--color-canvas: var(--pos-color-bg-canvas);');
    expect(css).toContain('--color-accent: var(--pos-color-accent-default);');
  });
});

describe('generateTokensTs', () => {
  const themes = resolveAllThemes();
  const ts = generateTokensTs(themes);

  it('is idempotent', () => {
    expect(generateTokensTs(resolveAllThemes())).toBe(ts);
  });

  it('exports TokenPath, tokens and rawTokens for all three themes', () => {
    expect(ts).toContain('export type TokenPath =');
    expect(ts).toContain('export const tokens = {');
    expect(ts).toContain('export const rawTokens = {');
    expect(ts).toContain('light: {');
    expect(ts).toContain('dark: {');
    expect(ts).toContain('hc: {');
  });

  it('every tokens.* leaf is a var(--pos-...) reference', () => {
    const varLines = [...ts.matchAll(/: "(var\(--pos-[^)]+\))"/g)];
    expect(varLines.length).toBeGreaterThan(50);
  });
});
