import type { Chord, Key } from '../contract/keyboard.js';
import type { Modifiers } from '../contract/primitives.js';

/**
 * Portable chords.
 *
 * A chord is stored once, in one spelling, and rendered per platform:
 * `mod+shift+k` is Cmd+Shift+K on macOS and Ctrl+Shift+K everywhere else. Every
 * keymap, menu accelerator, palette hint and help sheet reads this module, so
 * the product never disagrees with itself about what a shortcut is called.
 */

export type Platform = 'mac' | 'other';

/** A chord after parsing: required modifiers plus the key that completes it. */
export interface ParsedChord {
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
  /** True when the chord was written with `mod`. */
  readonly mod: boolean;
  /**
   * Physical key code (`KeyK`, `Digit1`, `ArrowUp`) when the token names a
   * letter, digit or named key; matching then survives a non-Latin layout.
   */
  readonly code: string | null;
  /** Produced character (`/`, `[`) when the token is a symbol. */
  readonly key: string | null;
  /** Canonical spelling, e.g. `mod+shift+k`. */
  readonly chord: Chord;
}

const MODIFIER_TOKENS = new Set([
  'mod',
  'ctrl',
  'control',
  'alt',
  'option',
  'shift',
  'meta',
  'cmd',
  'command',
  'super',
  'win',
]);

/** Named keys whose token maps straight onto `KeyboardEvent.code`. */
const NAMED_CODES: Record<string, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  enter: 'Enter',
  return: 'Enter',
  esc: 'Escape',
  escape: 'Escape',
  space: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  contextmenu: 'ContextMenu',
  mouseback: 'MouseBack',
  mouseforward: 'MouseForward',
};

/** How each token is written back out, per platform. */
const GLYPHS: Record<string, { mac: string; other: string }> = {
  mod: { mac: '⌘', other: 'Ctrl' },
  ctrl: { mac: '⌃', other: 'Ctrl' },
  alt: { mac: '⌥', other: 'Alt' },
  shift: { mac: '⇧', other: 'Shift' },
  meta: { mac: '⌘', other: 'Win' },
  ArrowUp: { mac: '↑', other: '↑' },
  ArrowDown: { mac: '↓', other: '↓' },
  ArrowLeft: { mac: '←', other: '←' },
  ArrowRight: { mac: '→', other: '→' },
  Enter: { mac: '↩', other: 'Enter' },
  Escape: { mac: '⎋', other: 'Esc' },
  Space: { mac: 'Space', other: 'Space' },
  Tab: { mac: '⇥', other: 'Tab' },
  Backspace: { mac: '⌫', other: 'Backspace' },
  Delete: { mac: '⌦', other: 'Del' },
};

function codeForToken(token: string): { code: string | null; key: string | null } {
  const named = NAMED_CODES[token];
  if (named !== undefined) return { code: named, key: null };
  if (/^[a-z]$/.test(token)) return { code: `Key${token.toUpperCase()}`, key: null };
  if (/^[0-9]$/.test(token)) return { code: `Digit${token}`, key: null };
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(token)) return { code: `F${token.slice(1)}`, key: null };
  // Anything else is a symbol: match on the produced character, because its
  // physical code moves between layouts.
  return { code: null, key: token };
}

/**
 * Parse `mod+shift+k` into the modifiers it requires and the key that completes
 * it. Throws on an empty chord or a chord that is only modifiers, because both
 * are almost always a typo in a keymap file.
 */
export function parseChord(chord: string): ParsedChord {
  const tokens = chord
    .trim()
    .toLowerCase()
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) throw new Error(`Empty chord: ${JSON.stringify(chord)}`);

  let alt = false;
  let ctrl = false;
  let meta = false;
  let shift = false;
  let mod = false;
  let keyToken: string | null = null;

  for (const token of tokens) {
    if (MODIFIER_TOKENS.has(token)) {
      if (token === 'mod') mod = true;
      else if (token === 'ctrl' || token === 'control') ctrl = true;
      else if (token === 'alt' || token === 'option') alt = true;
      else if (token === 'shift') shift = true;
      else meta = true;
      continue;
    }
    if (keyToken !== null) {
      throw new Error(`Chord ${JSON.stringify(chord)} names two keys: ${keyToken} and ${token}`);
    }
    keyToken = token;
  }

  if (keyToken === null)
    throw new Error(`Chord ${JSON.stringify(chord)} has no key, only modifiers`);

  const { code, key } = codeForToken(keyToken);
  const canonical = [
    ...(mod ? ['mod'] : []),
    ...(ctrl ? ['ctrl'] : []),
    ...(alt ? ['alt'] : []),
    ...(shift ? ['shift'] : []),
    ...(meta ? ['meta'] : []),
    keyToken,
  ].join('+');

  return { alt, ctrl, meta, shift, mod, code, key, chord: canonical };
}

/**
 * Render a chord for a platform: `⌘⇧K` on macOS, `Ctrl+Shift+K` elsewhere.
 * macOS joins glyphs without separators, which is the platform convention.
 */
export function formatChord(chord: string, platform: Platform = 'other'): string {
  const parsed = parseChord(chord);
  const parts: string[] = [];
  const push = (token: string) => {
    const glyph = GLYPHS[token];
    parts.push(glyph ? glyph[platform] : token);
  };

  // macOS orders modifiers ⌃⌥⇧⌘; other platforms Ctrl+Alt+Shift+Win.
  if (platform === 'mac') {
    if (parsed.ctrl) push('ctrl');
    if (parsed.alt) push('alt');
    if (parsed.shift) push('shift');
    if (parsed.mod || parsed.meta) push('mod');
  } else {
    if (parsed.mod || parsed.ctrl) push('mod');
    if (parsed.alt) push('alt');
    if (parsed.shift) push('shift');
    if (parsed.meta) push('meta');
  }

  if (parsed.code !== null) {
    const glyph = GLYPHS[parsed.code];
    if (glyph) parts.push(glyph[platform]);
    else if (parsed.code.startsWith('Key')) parts.push(parsed.code.slice(3));
    else if (parsed.code.startsWith('Digit')) parts.push(parsed.code.slice(5));
    else parts.push(parsed.code);
  } else if (parsed.key !== null) {
    parts.push(parsed.key.toUpperCase());
  }

  return platform === 'mac' ? parts.join('') : parts.join('+');
}

/** Does the held modifier set satisfy the chord, on this platform? */
function modifiersMatch(parsed: ParsedChord, modifiers: Modifiers, platform: Platform): boolean {
  const wantMeta = parsed.meta || (parsed.mod && platform === 'mac');
  const wantCtrl = parsed.ctrl || (parsed.mod && platform !== 'mac');
  return (
    modifiers.alt === parsed.alt &&
    modifiers.shift === parsed.shift &&
    modifiers.meta === wantMeta &&
    modifiers.ctrl === wantCtrl
  );
}

/**
 * Does a key event match a chord?
 *
 * Returns false while an IME composition is in flight (round 4 amendment): the
 * keystroke belongs to the editor, not to the command registry.
 */
export function matchChord(
  event: { key: Key; modifiers: Modifiers },
  chord: string,
  platform: Platform = 'other',
): boolean {
  if (event.key.isComposing) return false;
  const parsed = parseChord(chord);
  if (!modifiersMatch(parsed, event.modifiers, platform)) return false;
  if (parsed.code !== null) return event.key.code === parsed.code;
  if (parsed.key !== null) return event.key.key.toLowerCase() === parsed.key.toLowerCase();
  return false;
}

/** Detect the chord platform from a user-agent platform string. */
export function platformFrom(platformString: string | undefined): Platform {
  return /mac|iphone|ipad|ipod/i.test(platformString ?? '') ? 'mac' : 'other';
}

/** The portable chord a key event spells, e.g. `mod+shift+k`. */
export function chordOf(
  key: Pick<Key, 'code' | 'key'>,
  modifiers: Modifiers,
  platform: Platform = 'other',
): Chord {
  const parts: string[] = [];
  const modHeld = platform === 'mac' ? modifiers.meta : modifiers.ctrl;
  if (modHeld) parts.push('mod');
  if (platform === 'mac' && modifiers.ctrl) parts.push('ctrl');
  if (modifiers.alt) parts.push('alt');
  if (modifiers.shift) parts.push('shift');
  if (platform !== 'mac' && modifiers.meta) parts.push('meta');
  parts.push(tokenOf(key));
  return parts.join('+');
}

function tokenOf(key: Pick<Key, 'code' | 'key'>): string {
  if (/^Key[A-Z]$/.test(key.code)) return key.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(key.code)) return key.code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key.code)) return key.code.toLowerCase();
  // First spelling wins: NAMED_CODES lists the canonical token first (`up`
  // before `arrowup`), so a round-trip through parseChord is stable.
  for (const [token, code] of Object.entries(NAMED_CODES)) {
    if (code === key.code) return token;
  }
  return key.key.toLowerCase();
}
