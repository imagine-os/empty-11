import { describe, expect, it } from 'vitest';
import { SPEC_PACKAGE_ID } from './index.js';

describe('@paperos/spec', () => {
  it('declares its package id', () => {
    expect(SPEC_PACKAGE_ID).toBe('@paperos/spec');
  });
});
