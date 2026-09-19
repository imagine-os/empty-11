import { describe, expect, it } from 'vitest';
import type { FocusCandidate, Rect } from './index.js';
import { ARROW_DIRECTIONS, createSpatialNavigator, nearestInDirection } from './index.js';

/** A 3 x 3 grid of 100 x 40 cells at a 20 px gap, labelled r{row}c{column}. */
function grid(): FocusCandidate<string>[] {
  const cells: FocusCandidate<string>[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      cells.push({
        target: `r${row}c${column}`,
        rect: { x: column * 120, y: row * 60, width: 100, height: 40 },
        group: `row-${row}`,
      });
    }
  }
  return cells;
}

const rectOf = (cells: FocusCandidate<string>[], target: string): Rect => {
  const found = cells.find((cell) => cell.target === target);
  if (found === undefined) throw new Error(`no such cell: ${target}`);
  return found.rect;
};

describe('nearestInDirection', () => {
  const cells = grid();

  it('moves one cell per press in each direction', () => {
    const centre = rectOf(cells, 'r1c1');
    expect(nearestInDirection(centre, cells, 'up')?.target).toBe('r0c1');
    expect(nearestInDirection(centre, cells, 'down')?.target).toBe('r2c1');
    expect(nearestInDirection(centre, cells, 'left')?.target).toBe('r1c0');
    expect(nearestInDirection(centre, cells, 'right')?.target).toBe('r1c2');
  });

  it('returns null at the edge rather than wrapping', () => {
    expect(nearestInDirection(rectOf(cells, 'r0c0'), cells, 'up')).toBeNull();
    expect(nearestInDirection(rectOf(cells, 'r2c2'), cells, 'down')).toBeNull();
  });

  it('prefers a candidate whose projection overlaps over a closer one that does not', () => {
    const origin: Rect = { x: 0, y: 0, width: 100, height: 40 };
    const candidates: FocusCandidate<string>[] = [
      // Nearer, but off to the side: a pure centre-distance metric would pick it.
      { target: 'diagonal', rect: { x: 140, y: 50, width: 100, height: 40 } },
      { target: 'below', rect: { x: 0, y: 120, width: 100, height: 40 } },
    ];
    expect(nearestInDirection(origin, candidates, 'down')?.target).toBe('below');
  });

  it('skips disabled candidates', () => {
    const withDisabled = cells.map((cell) =>
      cell.target === 'r0c1' ? { ...cell, disabled: true } : cell,
    );
    expect(nearestInDirection(rectOf(cells, 'r1c1'), withDisabled, 'up')?.target).toBe('r0c0');
  });

  it('keeps focus in its group when the scores are close', () => {
    const candidates: FocusCandidate<string>[] = [
      { target: 'origin', rect: { x: 0, y: 0, width: 40, height: 40 }, group: 'toolbar' },
      { target: 'in-group', rect: { x: 100, y: 0, width: 40, height: 40 }, group: 'toolbar' },
      { target: 'out-of-group', rect: { x: 96, y: 0, width: 40, height: 40 }, group: 'canvas' },
    ];
    const origin = candidates[0]?.rect;
    expect(origin).toBeDefined();
    expect(
      nearestInDirection(origin as Rect, candidates, 'right', { originGroup: 'toolbar' })?.target,
    ).toBe('in-group');
  });

  it('counts a shared edge as ahead, so adjacent table cells navigate', () => {
    const origin: Rect = { x: 0, y: 0, width: 100, height: 40 };
    const touching: FocusCandidate<string>[] = [
      { target: 'next', rect: { x: 100, y: 0, width: 100, height: 40 } },
    ];
    expect(nearestInDirection(origin, touching, 'right')?.target).toBe('next');
  });

  it('is deterministic: the same input gives the same answer', () => {
    const first = nearestInDirection(rectOf(cells, 'r1c1'), cells, 'down')?.target;
    const second = nearestInDirection(rectOf(cells, 'r1c1'), [...cells].reverse(), 'down')?.target;
    expect(first).toBe('r2c1');
    expect(second).toBe('r2c1');
  });
});

describe('createSpatialNavigator', () => {
  it('enters from the middle of the edge the first press comes from', () => {
    const cells = grid();
    const navigator = createSpatialNavigator(() => cells);
    // Nothing is focused yet, so `down` enters at the top edge, centred.
    expect(navigator.move('down')).toBe('r0c1');
    expect(navigator.move('right')).toBe('r0c2');
    expect(navigator.current()).toBe('r0c2');
  });

  it('enters from the bottom when the first press is `up`', () => {
    const navigator = createSpatialNavigator(grid);
    expect(navigator.move('up')).toBe('r2c1');
  });

  it('stays put at the edge and reports null', () => {
    const navigator = createSpatialNavigator(grid);
    navigator.focus('r0c0');
    expect(navigator.move('up')).toBeNull();
    expect(navigator.current()).toBe('r0c0');
  });

  it('re-reads the candidates on every move, so a virtualised list works', () => {
    let cells = grid();
    const navigator = createSpatialNavigator(() => cells);
    navigator.focus('r1c1');
    cells = cells.filter((cell) => cell.target !== 'r2c1');
    expect(navigator.move('down')).toBe('r2c0');
  });

  it('returns null when there is nothing focusable at all', () => {
    expect(createSpatialNavigator<string>(() => []).move('down')).toBeNull();
  });
});

describe('ARROW_DIRECTIONS', () => {
  it('lets the arrow keys and the d-pad share one code path', () => {
    expect(ARROW_DIRECTIONS.ArrowUp).toBe('up');
    expect(ARROW_DIRECTIONS.ArrowRight).toBe('right');
    expect(ARROW_DIRECTIONS.Enter).toBeUndefined();
  });
});
