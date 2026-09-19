import { describe, expect, it, vi } from 'vitest';
import type { InputEvent } from '../contract/event.js';
import { DATA_ATTRIBUTES } from '../contract/modality.js';
import type { InputModality } from '../contract/primitives.js';
import { INPUT_CONTRACT_VERSION } from '../contract/version.js';
import type { ModalityEnvironment } from './index.js';
import {
  createModalityDetector,
  isDeliberate,
  preferredModalitySignal,
  queryCapabilities,
} from './index.js';

let counter = 0;

/** A minimal event of a modality, enough to drive the detector. */
function event(
  modality: InputModality,
  kind: InputEvent['kind'] = 'press',
  extra = {},
): InputEvent {
  counter += 1;
  const base = {
    id: `m-${counter}`,
    contract: INPUT_CONTRACT_VERSION,
    timeStamp: counter,
    modality,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    surfaceId: null,
  };
  const pointer = {
    id: 1,
    kind: modality === 'touch' ? ('touch' as const) : ('mouse' as const),
    coordinates: { client: { x: 0, y: 0 }, page: { x: 0, y: 0 }, surface: { x: 0, y: 0 } },
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    width: 1,
    height: 1,
    buttons: 1,
    button: 0,
    isPrimary: true,
  };
  if (kind === 'key') {
    return {
      ...base,
      kind: 'key',
      phase: 'down',
      key: { code: 'KeyA', key: 'a', repeat: false, isComposing: false, location: 0 },
      chord: 'a',
      ...extra,
    } as InputEvent;
  }
  if (kind === 'move')
    return { ...base, kind: 'move', pointer, coalesced: [], ...extra } as InputEvent;
  return { ...base, kind: 'press', pointer, ...extra } as InputEvent;
}

const mediaEnvironment = (matches: Record<string, boolean>): ModalityEnvironment => ({
  matchMedia: (query) => ({ matches: matches[query] ?? false }),
  navigator: { maxTouchPoints: matches['(pointer: coarse)'] === true ? 5 : 0 },
  now: () => 0,
});

describe('queryCapabilities', () => {
  it('reads the media queries the design system styles against', () => {
    const capabilities = queryCapabilities(
      mediaEnvironment({ '(pointer: coarse)': true, '(any-hover: hover)': false }),
    );
    expect(capabilities).toMatchObject({ coarsePointer: true, hover: false, touchPoints: 5 });
  });

  it('assumes a fine, hover-capable pointer when nothing can be queried', () => {
    expect(queryCapabilities()).toMatchObject({
      finePointer: true,
      hover: true,
      coarsePointer: false,
    });
  });
});

describe('isDeliberate', () => {
  it('counts presses, key-downs, d-pad presses and final voice intents', () => {
    expect(isDeliberate(event('mouse', 'press'))).toBe(true);
    expect(isDeliberate(event('keyboard', 'key'))).toBe(true);
  });

  it('does not count a bare pointer move, so a stray nudge keeps the focus ring', () => {
    expect(isDeliberate(event('mouse', 'move'))).toBe(false);
  });

  it('does not count a keystroke that belongs to an IME composition', () => {
    const composing = event('keyboard', 'key', {
      key: { code: 'KeyA', key: 'Process', repeat: false, isComposing: true, location: 0 },
    });
    expect(isDeliberate(composing)).toBe(false);
  });
});

describe('createModalityDetector', () => {
  it('switches the preferred modality on a deliberate interaction', () => {
    const detector = createModalityDetector();
    detector.observe(event('mouse'));
    expect(detector.getState().preferred).toBe('mouse');
    detector.observe(event('keyboard', 'key'));
    expect(detector.getState().preferred).toBe('keyboard');
  });

  it('keeps the preferred modality when a mouse only moves', () => {
    const detector = createModalityDetector();
    detector.observe(event('keyboard', 'key'));
    detector.observe(event('mouse', 'move'));
    expect(detector.getState().current).toBe('mouse');
    expect(detector.getState().preferred).toBe('keyboard');
  });

  it('records what it has seen and never un-sees it', () => {
    const detector = createModalityDetector();
    detector.observe(event('touch'));
    detector.observe(event('pen'));
    detector.observe(event('keyboard', 'key'));
    const { capabilities } = detector.getState();
    expect(capabilities).toMatchObject({ penSeen: true, keyboardSeen: true, coarsePointer: true });

    // A media-query refresh must not drop an observed capability: a tablet with
    // a keyboard attached keeps its touch affordances.
    detector.refreshCapabilities();
    expect(detector.getState().capabilities).toMatchObject({
      penSeen: true,
      keyboardSeen: true,
      coarsePointer: true,
    });
  });

  it('starts on touch when the device has only a coarse pointer', () => {
    const detector = createModalityDetector(
      mediaEnvironment({ '(pointer: coarse)': true, '(any-pointer: fine)': false }),
    );
    expect(detector.getState().preferred).toBe('touch');
  });

  it('notifies subscribers and stops on unsubscribe', () => {
    const detector = createModalityDetector();
    const listener = vi.fn();
    const unsubscribe = detector.subscribe(listener);
    detector.observe(event('mouse'));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    detector.observe(event('touch'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tracks a connected gamepad and a connected remote separately', () => {
    const detector = createModalityDetector();
    detector.setGamepadConnected(true, 'remote');
    expect(detector.getState().capabilities).toMatchObject({
      remoteConnected: true,
      gamepadConnected: false,
    });
  });

  it('mirrors the state onto <html> as data-input-* attributes', () => {
    const root = document.documentElement;
    const detector = createModalityDetector({ documentElement: root, now: () => 0 });
    detector.observe(event('touch'));
    detector.syncAttributes();

    expect(root.getAttribute(DATA_ATTRIBUTES.modality)).toBe('touch');
    expect(root.getAttribute(DATA_ATTRIBUTES.preferred)).toBe('touch');
    expect(root.hasAttribute(DATA_ATTRIBUTES.coarse)).toBe(true);
    expect(root.hasAttribute(DATA_ATTRIBUTES.pen)).toBe(false);

    detector.observe(event('pen'));
    detector.syncAttributes();
    expect(root.hasAttribute(DATA_ATTRIBUTES.pen)).toBe(true);
  });
});

describe('preferredModalitySignal', () => {
  it('fires only when the preferred modality actually changes', () => {
    const detector = createModalityDetector();
    const signal = preferredModalitySignal(detector);
    const listener = vi.fn();
    signal.subscribe(listener);

    detector.observe(event('keyboard', 'key'));
    detector.observe(event('keyboard', 'key'));
    detector.observe(event('touch'));

    expect(listener.mock.calls.map(([modality]) => modality)).toEqual(['keyboard', 'touch']);
    expect(signal.get()).toBe('touch');
  });
});
