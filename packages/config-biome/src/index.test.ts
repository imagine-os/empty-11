import { describe, expect, it } from 'vitest';
import { BIOME_PRESET, BIOME_STYLE } from './index.js';

describe('@paperos/config-biome', () => {
  it('exposes the preset specifier the root config extends', () => {
    expect(BIOME_PRESET).toBe('@paperos/config-biome/preset.json');
  });

  it('documents the house style', () => {
    expect(BIOME_STYLE).toMatchObject({ indentWidth: 2, quoteStyle: 'single' });
  });
});
