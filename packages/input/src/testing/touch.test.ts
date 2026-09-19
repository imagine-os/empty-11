import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from '../thresholds.js';
import { planPen } from './pen.js';
import { planLongPress, planPan, planPinch, planSwipe, planTap } from './touch.js';

const centre = { x: 100, y: 200 };

describe('touch planners', () => {
  it('plans a tap as start then end inside the tap slop', () => {
    const steps = planTap(centre, { slopPx: 4, durationMs: 60 });
    expect(steps.map((step) => step.type)).toEqual(['touchStart', 'touchMove', 'touchEnd']);
    expect(steps[0]?.touchPoints[0]).toMatchObject({ x: 100, y: 200, id: 1 });
    expect(steps[1]?.touchPoints[0]?.x).toBe(104);
    expect(steps[2]).toMatchObject({ touchPoints: [], atMs: 60 });
    expect(4).toBeLessThan(THRESHOLDS.tapSlopPx.coarse);
  });

  it('holds a long press past the long-press threshold', () => {
    const steps = planLongPress(centre);
    expect(steps.at(-1)?.atMs).toBeGreaterThan(THRESHOLDS.longPressMs);
  });

  it('spreads pan moves evenly over the duration and ends at the target', () => {
    const steps = planPan(centre, { dx: 120, dy: 0, durationMs: 300, steps: 4 });
    const moves = steps.filter((step) => step.type === 'touchMove');
    expect(moves.map((step) => step.atMs)).toEqual([75, 150, 225, 300]);
    expect(moves.at(-1)?.touchPoints[0]).toMatchObject({ x: 220, y: 200 });
    expect(steps.at(-1)).toMatchObject({ type: 'touchEnd', atMs: 300 });
  });

  it('swipes in the named direction, fast enough to read as a fling', () => {
    const steps = planSwipe(centre, { direction: 'up', distancePx: 100 });
    const last = steps.filter((step) => step.type === 'touchMove').at(-1);
    expect(last?.touchPoints[0]).toMatchObject({ x: 100, y: 100 });
    expect(steps.at(-1)?.atMs).toBeLessThanOrEqual(250);
  });

  it('pinches with two fingers that end at the scaled distance', () => {
    const steps = planPinch(centre, { scale: 2, startDistancePx: 80, steps: 3 });
    expect(steps[1]?.touchPoints).toHaveLength(2);
    const lastMove = steps.filter((step) => step.type === 'touchMove').at(-1);
    const [a, b] = lastMove?.touchPoints ?? [];
    expect(b && a ? b.x - a.x : 0).toBe(160);
    expect(steps.filter((step) => step.type === 'touchEnd')).toHaveLength(2);
    expect(steps.at(-1)?.touchPoints).toEqual([]);
  });

  it('timestamps never go backwards', () => {
    for (const steps of [
      planTap(centre, { slopPx: 2 }),
      planLongPress(centre),
      planPan(centre, { dx: 10, dy: 10, holdMs: 100 }),
      planPinch(centre, { scale: 0.5 }),
    ]) {
      for (let i = 1; i < steps.length; i += 1) {
        expect(steps[i]?.atMs).toBeGreaterThanOrEqual(steps[i - 1]?.atMs ?? 0);
      }
    }
  });
});

describe('pen planner', () => {
  it('hovers, presses with pressure, moves and releases with zero force', () => {
    const steps = planPen(
      { x: 10, y: 20 },
      [
        [
          { x: 0, y: 0 },
          { x: 50, y: 0, pressure: 0.9 },
        ],
      ],
      { pressure: 0.4, durationMs: 100 },
    );
    expect(steps.map((step) => step.type)).toEqual([
      'mouseMoved',
      'mousePressed',
      'mouseMoved',
      'mouseReleased',
    ]);
    expect(steps[0]).toMatchObject({ x: 10, y: 20, force: 0 });
    expect(steps[1]).toMatchObject({ force: 0.4 });
    expect(steps[2]).toMatchObject({ x: 60, y: 20, force: 0.9 });
    expect(steps[3]).toMatchObject({ x: 60, y: 20, force: 0 });
  });

  it('separates strokes with a lift gap', () => {
    const steps = planPen({ x: 0, y: 0 }, [[{ x: 0, y: 0 }], [{ x: 5, y: 5 }]], {
      gapMs: 40,
      hoverFirst: false,
    });
    const released = steps.findIndex((step) => step.type === 'mouseReleased');
    const nextPress = steps.findIndex(
      (step, index) => index > released && step.type === 'mousePressed',
    );
    const gap = (steps[nextPress]?.atMs ?? 0) - (steps[released]?.atMs ?? 0);
    expect(gap).toBe(40);
  });
});
