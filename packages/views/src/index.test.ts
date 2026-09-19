import { describe, expect, it } from 'vitest';
import { VIEWS_PACKAGE_ID } from './index.js';

describe('@paperos/views', () => {
  it('declares its package id', () => {
    expect(VIEWS_PACKAGE_ID).toBe('@paperos/views');
  });
});
