import { describe, expect, it } from 'vitest';
import { toPlaywrightKey } from './chords.js';

describe('toPlaywrightKey', () => {
  it('resolves mod to Control off macOS and Meta on it', () => {
    expect(toPlaywrightKey('mod+shift+k', 'other')).toBe('Control+Shift+KeyK');
    expect(toPlaywrightKey('mod+shift+k', 'mac')).toBe('Shift+Meta+KeyK');
  });

  it('keeps explicit modifiers and orders them Control, Alt, Shift, Meta', () => {
    expect(toPlaywrightKey('meta+alt+ctrl+shift+1', 'other')).toBe('Control+Alt+Shift+Meta+Digit1');
    expect(toPlaywrightKey('ctrl+k', 'mac')).toBe('Control+KeyK');
  });

  it('maps named keys onto codes and symbols onto characters', () => {
    expect(toPlaywrightKey('up', 'other')).toBe('ArrowUp');
    expect(toPlaywrightKey('esc', 'other')).toBe('Escape');
    expect(toPlaywrightKey('space', 'other')).toBe('Space');
    expect(toPlaywrightKey('f5', 'other')).toBe('F5');
    expect(toPlaywrightKey('mod+/', 'other')).toBe('Control+/');
  });

  it('rejects chords the grammar rejects', () => {
    expect(() => toPlaywrightKey('mod+shift', 'other')).toThrow(/no key/);
    expect(() => toPlaywrightKey('', 'other')).toThrow(/Empty chord/);
  });
});
