import { chordOf } from '../chord/index.js';
import type { KeyInputEvent } from '../contract/event.js';
import { MOUSE_NAV_CODES } from '../contract/keyboard.js';
import { INPUT_CONTRACT_VERSION } from '../contract/version.js';
import type { KeyboardEventLike, NormaliseOptions } from './dom.js';
import { newEventId } from './ids.js';
import { modifiersOf } from './pointer.js';

/**
 * DOM KeyboardEvent → `key`.
 *
 * `isComposing` is preserved (and inferred from the legacy 229 keyCode, which
 * is the only signal some IMEs give) because the command registry must not
 * match chords mid-composition: typing a Japanese word would otherwise fire
 * shortcuts.
 */
export function normaliseKeyboardEvent(
  event: KeyboardEventLike,
  options: NormaliseOptions = {},
): KeyInputEvent | null {
  if (event.type !== 'keydown' && event.type !== 'keyup') return null;

  const platform = options.platform ?? 'other';
  const modifiers = modifiersOf(event);
  const key = {
    code: event.code,
    key: event.key,
    repeat: event.repeat,
    isComposing: event.isComposing === true || event.keyCode === 229,
    location: event.location ?? 0,
  };

  return {
    id: (options.newId ?? newEventId)(),
    contract: INPUT_CONTRACT_VERSION,
    timeStamp: event.timeStamp,
    modality: 'keyboard',
    modifiers,
    surfaceId: options.surfaceId ?? null,
    kind: 'key',
    phase: event.type === 'keydown' ? 'down' : 'up',
    key,
    chord: chordOf(key, modifiers, platform),
  };
}

/**
 * Mouse side buttons → `key` events with the synthetic codes `MouseBack` and
 * `MouseForward`, which the default keymap binds to `nav.back` / `nav.forward`.
 * They are keys, not pointers: nobody wants a drag gesture on the back button.
 */
export function normaliseMouseNavButton(
  button: number,
  phase: 'down' | 'up',
  timeStamp: number,
  options: NormaliseOptions = {},
): KeyInputEvent | null {
  const code = button === 3 ? MOUSE_NAV_CODES.back : button === 4 ? MOUSE_NAV_CODES.forward : null;
  if (code === null) return null;

  const modifiers = { alt: false, ctrl: false, meta: false, shift: false };
  const key = { code, key: code, repeat: false, isComposing: false, location: 0 };

  return {
    id: (options.newId ?? newEventId)(),
    contract: INPUT_CONTRACT_VERSION,
    timeStamp,
    modality: 'mouse',
    modifiers,
    surfaceId: options.surfaceId ?? null,
    kind: 'key',
    phase,
    key,
    chord: chordOf(key, modifiers, options.platform ?? 'other'),
  };
}
