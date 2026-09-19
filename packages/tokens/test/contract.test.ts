import { describe, expect, it } from 'vitest';
import { rawTokens, type TokenPath, tokens } from '../src/index.js';

function flattenPaths(obj: object, prefix: string[] = []): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = [...prefix, key];
    return typeof value === 'string' ? [path.join('.')] : flattenPaths(value as object, path);
  });
}

describe('rawTokens contract', () => {
  const themePaths = {
    light: new Set(flattenPaths(rawTokens.light)),
    dark: new Set(flattenPaths(rawTokens.dark)),
    hc: new Set(flattenPaths(rawTokens.hc)),
  };
  const tokenPaths = new Set(flattenPaths(tokens));

  it('tokens and rawTokens.* expose exactly the same set of paths', () => {
    expect(themePaths.light).toEqual(tokenPaths);
    expect(themePaths.dark).toEqual(tokenPaths);
    expect(themePaths.hc).toEqual(tokenPaths);
  });

  it('every TokenPath the type union names is a real, resolvable path (compile-time check via a sample)', () => {
    // A representative sample: if these compile and resolve, the generator's
    // TokenPath union and its `tokens` object are in sync by construction
    // (both come from the same sorted path list in generate-ts.ts).
    const sample: TokenPath[] = [
      'color.bg.surface',
      'color.fg.default',
      'space.16',
      'radius.md',
      'motion.duration.fast',
    ];
    for (const path of sample) {
      expect(tokenPaths.has(path)).toBe(true);
    }
  });

  it('no theme is missing a value for any token (DoD: rawTokens covers every TokenPath in every theme)', () => {
    for (const path of tokenPaths) {
      expect(themePaths.light.has(path), `light missing ${path}`).toBe(true);
      expect(themePaths.dark.has(path), `dark missing ${path}`).toBe(true);
      expect(themePaths.hc.has(path), `hc missing ${path}`).toBe(true);
    }
  });
});
