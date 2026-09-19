import { describe, expect, it } from 'vitest';
import { presetSpecifier, TS_PRESETS } from './index.js';

describe('@paperos/config-ts', () => {
  it('names the three presets shipped with the template', () => {
    expect([...TS_PRESETS]).toEqual(['base', 'react', 'node']);
  });

  it('builds the specifier a package extends', () => {
    expect(presetSpecifier('react')).toBe('@paperos/config-ts/react.json');
  });
});
