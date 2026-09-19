import { describe, expect, it } from 'vitest';
import { framesToFps } from '../fps.ts';

describe('framesToFps', () => {
  it('returns null for an empty trace', () => {
    expect(framesToFps([])).toBeNull();
  });

  it('computes 60fps from a steady 16.67ms trace', () => {
    const steady60fps = Array.from({ length: 300 }, () => 1000 / 60);
    const result = framesToFps(steady60fps)!;
    expect(result.meanFps).toBeCloseTo(60, 0);
    expect(result.p5Fps).toBeCloseTo(60, 0);
    expect(result.longFrames).toBe(0);
  });

  it('a recorded trace with stutters reports a lower p5 than mean, and counts the long frames', () => {
    // 90 frames at 60fps, 10 100ms stalls (10% of the trace, so the bottom-5%
    // percentile falls inside the stall bucket) — a stand-in for a captured
    // DrawFrame trace with jank frames; see browser.ts's deviation note for
    // why this kit samples rAF instead of parsing a real CDP trace.
    const trace = [...Array.from({ length: 90 }, () => 1000 / 60), ...Array.from({ length: 10 }, () => 100)];
    const result = framesToFps(trace)!;
    expect(result.longFrames).toBe(10);
    expect(result.p5Fps).toBeLessThan(result.meanFps);
    expect(result.p5Fps).toBeCloseTo(10, 0); // 1000ms / 100ms stall = 10fps
  });

  it('treats a zero-length interval as 0fps rather than dividing by zero', () => {
    const result = framesToFps([0, 16.67])!;
    expect(Number.isFinite(result.meanFps)).toBe(true);
    expect(result.meanFps).toBeGreaterThanOrEqual(0);
  });
});
