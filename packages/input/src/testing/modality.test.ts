import { describe, expect, it } from 'vitest';
import { auditTouchTargets, formatViolations, normaliseModality } from './modality.js';

describe('normaliseModality', () => {
  it('folds mouse, touch and pen onto "pointer" only when pointer is expected', () => {
    expect(normaliseModality('touch', 'pointer')).toBe('pointer');
    expect(normaliseModality('pen', 'pointer')).toBe('pointer');
    expect(normaliseModality('keyboard', 'pointer')).toBe('keyboard');
    expect(normaliseModality('touch', 'touch')).toBe('touch');
    expect(normaliseModality(null, 'keyboard')).toBeNull();
  });
});

describe('formatViolations', () => {
  it('prints one violation per line with size and label', () => {
    const text = formatViolations({
      minPx: 44,
      checked: 3,
      skipped: false,
      violations: [
        { selector: 'button#tiny', label: 'Close', width: 24, height: 24 },
        { selector: 'a#bare', label: '', width: 44, height: 20 },
      ],
    });
    expect(text).toBe('button#tiny (24×24 px, "Close")\na#bare (44×20 px)');
  });
});

describe('auditTouchTargets (jsdom, mocked layout)', () => {
  it('skips hidden and disabled controls and reports the small ones', () => {
    document.body.innerHTML = `
      <button id="ok">Fine</button>
      <button id="tiny" aria-label="Close">x</button>
      <button id="hidden" style="display:none">Hidden</button>
      <button id="off" disabled>Off</button>
      <div id="wrap"><a href="#">A</a><a href="#">B</a></div>`;
    const sizes: Record<string, [number, number]> = {
      ok: [48, 48],
      tiny: [24, 24],
      hidden: [10, 10],
      off: [10, 10],
    };
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('button, a'))) {
      const [width, height] = sizes[element.id] ?? [44, 44];
      element.getBoundingClientRect = () =>
        ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height }) as DOMRect;
    }
    const report = auditTouchTargets({
      minPx: 44,
      within: null,
      coarseOnly: false,
      selector: 'button, a[href]',
    });
    expect(report.checked).toBe(4);
    expect(report.violations).toEqual([
      { selector: 'button#tiny', label: 'Close', width: 24, height: 24 },
    ]);
  });

  it('describes anonymous elements by their path', () => {
    document.body.innerHTML = '<div id="wrap"><a href="#">A</a><a href="#">B</a></div>';
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('a'))) {
      element.getBoundingClientRect = () =>
        ({ width: 30, height: 30, x: 0, y: 0, top: 0, left: 0, right: 30, bottom: 30 }) as DOMRect;
    }
    const report = auditTouchTargets({
      minPx: 44,
      within: '#wrap',
      coarseOnly: false,
      selector: 'a[href]',
    });
    expect(report.violations.map((violation) => violation.selector)).toEqual([
      'div#wrap > a:nth-of-type(1)',
      'div#wrap > a:nth-of-type(2)',
    ]);
  });
});
