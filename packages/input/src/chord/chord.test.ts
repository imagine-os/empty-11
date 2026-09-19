import { describe, expect, it } from 'vitest';
import type { Key } from '../contract/keyboard.js';
import type { Modifiers } from '../contract/primitives.js';
import { chordOf, formatChord, matchChord, parseChord, platformFrom } from './index.js';

const key = (code: string, character: string, isComposing = false): Key => ({
  code,
  key: character,
  repeat: false,
  isComposing,
  location: 0,
});

const mods = (partial: Partial<Modifiers> = {}): Modifiers => ({
  alt: false,
  ctrl: false,
  meta: false,
  shift: false,
  ...partial,
});

describe('parseChord', () => {
  it('parses modifiers and the key, and canonicalises the spelling', () => {
    const parsed = parseChord('Shift+MOD+k');
    expect(parsed).toMatchObject({ mod: true, shift: true, code: 'KeyK', key: null });
    expect(parsed.chord).toBe('mod+shift+k');
  });

  it('maps letters, digits and function keys onto physical codes', () => {
    expect(parseChord('g').code).toBe('KeyG');
    expect(parseChord('mod+1').code).toBe('Digit1');
    expect(parseChord('f12').code).toBe('F12');
  });

  it('maps named keys onto their DOM code', () => {
    expect(parseChord('up').code).toBe('ArrowUp');
    expect(parseChord('mod+enter').code).toBe('Enter');
    expect(parseChord('escape').code).toBe('Escape');
  });

  it('matches symbols on the produced character, not the physical key', () => {
    const parsed = parseChord('mod+/');
    expect(parsed.code).toBeNull();
    expect(parsed.key).toBe('/');
  });

  it('accepts cmd, option, control and super as aliases', () => {
    expect(parseChord('cmd+k')).toMatchObject({ meta: true, mod: false });
    expect(parseChord('option+k')).toMatchObject({ alt: true });
    expect(parseChord('control+k')).toMatchObject({ ctrl: true });
  });

  it('rejects a chord with no key or with two', () => {
    expect(() => parseChord('mod+shift')).toThrow(/no key/);
    expect(() => parseChord('mod+k+j')).toThrow(/two keys/);
    expect(() => parseChord('   ')).toThrow(/Empty chord/);
  });
});

describe('formatChord', () => {
  it('renders the platform spelling', () => {
    expect(formatChord('mod+shift+k', 'mac')).toBe('⇧⌘K');
    expect(formatChord('mod+shift+k', 'other')).toBe('Ctrl+Shift+K');
  });

  it('renders named keys as glyphs on macOS and words elsewhere', () => {
    expect(formatChord('mod+enter', 'mac')).toBe('⌘↩');
    expect(formatChord('mod+enter', 'other')).toBe('Ctrl+Enter');
    expect(formatChord('up', 'other')).toBe('↑');
  });

  it('orders macOS modifiers ⌃⌥⇧⌘', () => {
    expect(formatChord('ctrl+alt+shift+cmd+k', 'mac')).toBe('⌃⌥⇧⌘K');
  });
});

describe('matchChord', () => {
  it('resolves `mod` to Cmd on macOS and Ctrl elsewhere', () => {
    const macPress = { key: key('KeyK', 'k'), modifiers: mods({ meta: true, shift: true }) };
    const otherPress = { key: key('KeyK', 'k'), modifiers: mods({ ctrl: true, shift: true }) };

    expect(matchChord(macPress, 'mod+shift+k', 'mac')).toBe(true);
    expect(matchChord(macPress, 'mod+shift+k', 'other')).toBe(false);
    expect(matchChord(otherPress, 'mod+shift+k', 'other')).toBe(true);
    expect(matchChord(otherPress, 'mod+shift+k', 'mac')).toBe(false);
  });

  it('matches letters by physical code, so a non-Latin layout still works', () => {
    // A Russian layout produces "л" on the physical K key.
    const press = { key: key('KeyK', 'л'), modifiers: mods({ ctrl: true }) };
    expect(matchChord(press, 'mod+k', 'other')).toBe(true);
  });

  it('matches symbols by produced character, so an AZERTY slash still works', () => {
    const press = { key: key('Digit7', '/'), modifiers: mods({ ctrl: true }) };
    expect(matchChord(press, 'mod+/', 'other')).toBe(true);
  });

  it('refuses to match a chord while an IME composition is in flight', () => {
    const press = { key: key('KeyK', 'k', true), modifiers: mods({ ctrl: true }) };
    expect(matchChord(press, 'mod+k', 'other')).toBe(false);
  });

  it('requires an exact modifier set, so mod+k does not fire on mod+shift+k', () => {
    const press = { key: key('KeyK', 'k'), modifiers: mods({ ctrl: true, shift: true }) };
    expect(matchChord(press, 'mod+k', 'other')).toBe(false);
  });
});

describe('chordOf', () => {
  it('spells the chord a keystroke produced', () => {
    expect(chordOf(key('KeyK', 'k'), mods({ ctrl: true, shift: true }), 'other')).toBe(
      'mod+shift+k',
    );
    expect(chordOf(key('KeyK', 'k'), mods({ meta: true }), 'mac')).toBe('mod+k');
    expect(chordOf(key('ArrowUp', 'ArrowUp'), mods(), 'other')).toBe('up');
  });

  it('round-trips through parseChord', () => {
    for (const code of ['KeyK', 'Digit4', 'F5', 'Enter', 'ArrowLeft', 'Escape']) {
      const chord = chordOf(key(code, code), mods({ ctrl: true }), 'other');
      expect(parseChord(chord).code).toBe(code);
    }
  });
});

describe('platformFrom', () => {
  it('detects macOS and iOS from the platform string', () => {
    expect(platformFrom('MacIntel')).toBe('mac');
    expect(platformFrom('iPhone')).toBe('mac');
    expect(platformFrom('Linux x86_64')).toBe('other');
    expect(platformFrom(undefined)).toBe('other');
  });
});
