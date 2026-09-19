import { describe, expect, it } from 'vitest';
import { PAPEROS_VERSION } from './index.js';

describe('@paperos/core', () => {
  it('exports a semver platform version from the barrel', () => {
    expect(PAPEROS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
