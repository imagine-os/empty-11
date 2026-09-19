import { describe, expect, it } from 'vitest';
import { getTarget, PAPEROS_VERSION } from './index.js';

describe('@paperos/core', () => {
  it('exports a semver platform version from the barrel', () => {
    expect(PAPEROS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('re-exports getTarget (the one config piece safe for the root barrel)', () => {
    expect(getTarget({})).toBe('web');
  });
});
