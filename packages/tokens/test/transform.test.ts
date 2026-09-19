import { describe, expect, it } from 'vitest';
import { fluidSizeToClamp, pxToRem } from '../src/lib/transform.js';

describe('pxToRem', () => {
  it('converts at a 16px root', () => {
    expect(pxToRem('16px')).toBe('1rem');
    expect(pxToRem('8px')).toBe('0.5rem');
  });

  it('rounds to 4 decimal places', () => {
    // 44px / 16 = 2.75 exactly; 10px / 16 = 0.625 exactly. Use a value that
    // does not divide evenly to exercise the rounding.
    expect(pxToRem('13px')).toBe('0.8125rem');
    expect(pxToRem('9px')).toBe('0.5625rem');
  });

  it('keeps zero unitless', () => {
    expect(pxToRem('0px')).toBe('0');
  });

  it('rejects a non-px dimension', () => {
    expect(() => pxToRem('1rem')).toThrow();
  });
});

describe('fluidSizeToClamp', () => {
  it('produces a clamp() with the min at the low end of the range and the max at the high end', () => {
    const css = fluidSizeToClamp({ min: '16px', max: '22px' }, { minVw: 360, maxVw: 3840 });
    expect(css).toContain('clamp(1rem,');
    expect(css).toContain('1.375rem)');
    expect(css).toContain('var(--pos-font-scale, 1)');
  });

  it('the preferred term evaluates to the min at minVw and the max at maxVw', () => {
    const range = { minVw: 360, maxVw: 3840 };
    const css = fluidSizeToClamp({ min: '16px', max: '22px' }, range);
    // calc(clamp(1rem, calc(<intercept>rem + <coef>vw), 1.375rem) * var(...))
    // `coef` is derived from a px/px slope, so "coef vw" resolves to PX at a
    // given viewport width W (Nvw = N * W/100 px) -- CSS calc() then sums
    // that px length with the rem intercept natively. Mirror the same
    // px-domain arithmetic here rather than mixing rem and vw by hand.
    const match = css.match(/calc\(([-\d.]+)rem \+ ([-\d.]+)vw\)/);
    expect(match).not.toBeNull();
    const interceptPx = Number.parseFloat(match?.[1] ?? 'NaN') * 16;
    const coefficient = Number.parseFloat(match?.[2] ?? 'NaN');
    const pxAtWidth = (vw: number) => interceptPx + coefficient * (vw / 100);
    expect(pxAtWidth(range.minVw)).toBeCloseTo(16, 1);
    expect(pxAtWidth(range.maxVw)).toBeCloseTo(22, 1);
  });

  it('rejects a value that is not a {min, max} pair', () => {
    expect(() => fluidSizeToClamp('16px', { minVw: 360, maxVw: 3840 })).toThrow();
  });
});
