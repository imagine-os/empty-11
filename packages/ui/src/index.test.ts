import { describe, expect, it } from 'vitest';
import { TEMPLATE_TITLE, UI_PACKAGE_ID } from './index.js';

describe('@paperos/ui', () => {
  it('owns the one string the placeholder page renders', () => {
    expect(TEMPLATE_TITLE).toBe('PaperOS template');
  });

  it('declares its package id', () => {
    expect(UI_PACKAGE_ID).toBe('@paperos/ui');
  });
});
