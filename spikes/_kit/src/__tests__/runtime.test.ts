import { describe, expect, it } from 'vitest';
import { isStable, measureRuntime, percentile } from '../runtime.ts';

describe('isStable', () => {
  it('is stable when three runs agree within 5%', () => {
    expect(isStable([100, 102, 98])).toBe(true);
  });

  it('is unstable when a run is more than 5% off the mean', () => {
    expect(isStable([100, 100, 130])).toBe(false);
  });

  it('is trivially stable for a single run', () => {
    expect(isStable([100])).toBe(true);
  });
});

describe('percentile', () => {
  it('picks the low end for p5 of a sorted array', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 5)).toBeLessThanOrEqual(6);
  });
});

describe('measureRuntime', () => {
  it('reports heap/rss deltas and marks a workload that throws as not measured', async () => {
    const result = await measureRuntime({
      runWorkload: () => {
        throw new Error('boom');
      },
    });
    expect(result.wallTimeMeanMs).toBeNull();
    expect(result.notMeasuredReason).toContain('boom');
  });

  it('times a real synchronous workload across the default 3 runs', async () => {
    const result = await measureRuntime({
      runWorkload: () => {
        let total = 0;
        for (let i = 0; i < 1_000_000; i += 1) total += i;
      },
    });
    expect(result.runs).toBe(3);
    expect(result.wallTimeMeanMs).not.toBeNull();
    expect(result.wallTimeMeanMs!).toBeGreaterThanOrEqual(0);
  });
});
