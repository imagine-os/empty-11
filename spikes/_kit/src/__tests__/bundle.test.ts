import { describe, expect, it } from 'vitest';
import { subtractBaseline } from '../bundle.ts';

describe('subtractBaseline', () => {
  it('subtracts the shared baseline from the candidate build', () => {
    expect(subtractBaseline(126_600, 45_000)).toBe(81_600);
  });

  it('returns null when the candidate was not measured', () => {
    expect(subtractBaseline(null, 45_000)).toBeNull();
  });

  it('returns null when the baseline was not measured', () => {
    expect(subtractBaseline(126_600, null)).toBeNull();
  });

  it('never returns a bare 0 standing in for "not measured" — a real zero-diff is a legitimate value', () => {
    expect(subtractBaseline(45_000, 45_000)).toBe(0);
  });
});
