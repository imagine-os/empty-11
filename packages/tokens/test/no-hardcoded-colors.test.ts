import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_HSL_LITERAL_RE = /\b(rgb|rgba|hsl|hsla)\(\s*\d/g;

// Every hard-coded colour in this package belongs in a `*.tokens.json` file
// or in the sRGB-fallback converter (which necessarily *produces* rgb()
// strings from a token's own oklch() value at build time -- it does not
// introduce a new colour). No other source file should ever spell out a
// colour literal: that would be a token bypass a component could copy.
const ALLOWED_FILES = new Set(['src/lib/srgb-fallback.ts']);

describe('no hard-coded colours outside tokens/*.tokens.json', () => {
  const root = join(import.meta.dirname, '..');
  const files = globSync(['src/**/*.ts', 'scripts/**/*.ts'], { cwd: root }).filter(
    (f) => !f.startsWith('src/generated/') && !ALLOWED_FILES.has(f),
  );

  it('scanned at least the library and script source files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} has no hex or rgb()/hsl() colour literal`, () => {
      const content = readFileSync(join(root, file), 'utf8');
      expect(content.match(HEX_COLOR_RE)).toBeNull();
      expect(content.match(RGB_HSL_LITERAL_RE)).toBeNull();
    });
  }
});
