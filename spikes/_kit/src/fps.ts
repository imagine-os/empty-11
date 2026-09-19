/**
 * Pure frame-interval -> FPS math, split out of `browser.ts` so it is unit
 * testable against a fixed, recorded array of frame intervals (a stand-in for
 * a Chrome trace's `DrawFrame` deltas — see the deviation note in
 * `browser.ts`) without needing a real browser.
 */
export interface FpsSummary {
  meanFps: number;
  p5Fps: number;
  longFrames: number;
}

/** `intervalsMs` are consecutive frame-to-frame deltas in milliseconds, in capture order. */
export function framesToFps(intervalsMs: number[]): FpsSummary | null {
  if (intervalsMs.length === 0) return null;

  const fpsSamples = intervalsMs.map((ms) => (ms > 0 ? 1000 / ms : 0));
  const sorted = [...fpsSamples].sort((a, b) => a - b);
  const meanFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
  const p5Index = Math.max(0, Math.floor(0.05 * sorted.length));
  const p5Fps = sorted[p5Index]!;
  const longFrames = intervalsMs.filter((ms) => ms > 50).length;

  return { meanFps, p5Fps, longFrames };
}
