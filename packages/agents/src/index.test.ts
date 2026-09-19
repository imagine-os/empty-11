import { describe, expect, it } from 'vitest';
import { AGENTS_PACKAGE_ID } from './index.js';

describe('@paperos/agents', () => {
  it('declares its package id', () => {
    expect(AGENTS_PACKAGE_ID).toBe('@paperos/agents');
  });
});
