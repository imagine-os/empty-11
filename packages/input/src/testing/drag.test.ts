import { describe, expect, it } from 'vitest';
import { keyboardDragKeys, parseMoves, towards } from './drag.js';

describe('keyboardDragKeys (PAP-330 grammar)', () => {
  it('picks up with Space, moves with arrows and drops with Space', () => {
    expect(keyboardDragKeys('down down')).toEqual(['Space', 'ArrowDown', 'ArrowDown', 'Space']);
    expect(keyboardDragKeys(['up', 'left', 'right'])).toEqual([
      'Space',
      'ArrowUp',
      'ArrowLeft',
      'ArrowRight',
      'Space',
    ]);
  });

  it('changes container with PageUp/PageDown and jumps with Home/End', () => {
    expect(keyboardDragKeys('nextContainer first')).toEqual(['Space', 'PageDown', 'Home', 'Space']);
    expect(keyboardDragKeys('prevContainer last')).toEqual(['Space', 'PageUp', 'End', 'Space']);
  });

  it('accepts Enter for pick-up and Escape for cancel', () => {
    expect(keyboardDragKeys('down', { pickUp: 'Enter', cancel: true })).toEqual([
      'Enter',
      'ArrowDown',
      'Escape',
    ]);
  });

  it('rejects unknown moves loudly', () => {
    expect(() => parseMoves('down sideways')).toThrow(/Unknown keyboard drag move "sideways"/);
  });
});

describe('towards', () => {
  it('walks a fixed distance along the drag direction', () => {
    expect(towards({ x: 0, y: 0 }, { x: 10, y: 0 }, 5)).toEqual({ x: 5, y: 0 });
    const diagonal = towards({ x: 0, y: 0 }, { x: 3, y: 4 }, 5);
    expect(diagonal.x).toBeCloseTo(3);
    expect(diagonal.y).toBeCloseTo(4);
  });

  it('nudges right when the two points coincide', () => {
    expect(towards({ x: 1, y: 1 }, { x: 1, y: 1 }, 5)).toEqual({ x: 6, y: 1 });
  });
});
