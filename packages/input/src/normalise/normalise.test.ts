/**
 * Normaliser tests, in jsdom.
 *
 * jsdom ships `KeyboardEvent` and `WheelEvent` but not `PointerEvent`, which is
 * exactly the situation the structural typing in `dom.ts` exists for: the
 * pointer cases are driven by a `MouseEvent` subclass built here, the same way
 * a browser without Pointer Events would be polyfilled, and the normaliser does
 * not know the difference.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { InputEventSchema } from '../contract/event.js';
import { DPAD_INDEX, gamepadSnapshot } from '../fixtures/raw.js';
import { THRESHOLDS } from '../thresholds.js';
import type { KeyboardEventLike, PointerEventLike, WheelEventLike } from './dom.js';
import { applyDeadzone, createGamepadDiffer, roleOf, stickDirection } from './gamepad.js';
import { sequentialIds } from './ids.js';
import { normaliseKeyboardEvent, normaliseMouseNavButton } from './keyboard.js';
import { normalisePointerEvent, syntheticCancel } from './pointer.js';
import { createTrackpadDetector, normaliseWheelEvent, toPixels } from './wheel.js';

/** A minimal PointerEvent over jsdom's MouseEvent, as a browser polyfill would. */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  readonly pressure: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
  readonly width: number;
  readonly height: number;

  constructor(type: string, init: MouseEventInit & Partial<PointerEventLike>) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
    this.pressure = init.pressure ?? 0;
    this.tiltX = init.tiltX ?? 0;
    this.tiltY = init.tiltY ?? 0;
    this.twist = init.twist ?? 0;
    this.width = init.width ?? 1;
    this.height = init.height ?? 1;
  }
}

let newId: () => string;

beforeEach(() => {
  newId = sequentialIds('t');
});

describe('normalisePointerEvent', () => {
  const surface = { surfaceId: 'canvas', surfaceRect: { left: 50, top: 80 } } as const;

  it('turns a real DOM event into a valid press', () => {
    const event = new TestPointerEvent('pointerdown', {
      clientX: 150,
      clientY: 180,
      buttons: 1,
      button: 0,
      pointerType: 'mouse',
    });
    const normalised = normalisePointerEvent(event, { ...surface, newId });
    expect(normalised?.kind).toBe('press');
    expect(InputEventSchema.safeParse(normalised).success).toBe(true);
  });

  it('places the pointer in all three coordinate spaces', () => {
    const event = new TestPointerEvent('pointermove', { clientX: 150, clientY: 180 });
    const normalised = normalisePointerEvent(event, { ...surface, newId });
    expect(normalised?.pointer.coordinates.client).toEqual({ x: 150, y: 180 });
    expect(normalised?.pointer.coordinates.surface).toEqual({ x: 100, y: 100 });
  });

  it('maps every DOM type it accepts and ignores the ones it does not', () => {
    const kinds = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ].map((type) => normalisePointerEvent(new TestPointerEvent(type, {}), { newId })?.kind);
    expect(kinds).toEqual(['press', 'move', 'release', 'cancel', 'cancel']);
    expect(normalisePointerEvent(new TestPointerEvent('click', {}), { newId })).toBeNull();
  });

  it('distinguishes a capture loss from a real cancel', () => {
    const lost = normalisePointerEvent(new TestPointerEvent('lostpointercapture', {}), { newId });
    const cancelled = normalisePointerEvent(new TestPointerEvent('pointercancel', {}), { newId });
    expect(lost?.kind === 'cancel' && lost.reason).toBe('capture-lost');
    expect(cancelled?.kind === 'cancel' && cancelled.reason).toBe('pointercancel');
  });

  it('clamps a misbehaving driver into the declared ranges', () => {
    const event = new TestPointerEvent('pointermove', {
      pointerType: 'pen',
      pressure: 1.4,
      tiltX: -120,
      tiltY: 200,
      twist: 400,
    });
    const normalised = normalisePointerEvent(event, { newId });
    expect(normalised?.pointer).toMatchObject({ pressure: 1, tiltX: -90, tiltY: 90, twist: 359 });
    expect(InputEventSchema.safeParse(normalised).success).toBe(true);
  });

  it('gives a mouse press the spec pressure of 0.5 and a hover 0', () => {
    const press = normalisePointerEvent(
      new TestPointerEvent('pointerdown', { buttons: 1, pressure: 0 }),
      { newId },
    );
    const hover = normalisePointerEvent(new TestPointerEvent('pointermove', { pressure: 0 }), {
      newId,
    });
    expect(press?.pointer.pressure).toBe(0.5);
    expect(hover?.pointer.pressure).toBe(0);
    expect(hover?.pointer.buttons).toBe(0);
  });

  it('keeps a pen press at its reported pressure', () => {
    const press = normalisePointerEvent(
      new TestPointerEvent('pointerdown', { pointerType: 'pen', buttons: 1, pressure: 0.08 }),
      { newId },
    );
    expect(press?.pointer.pressure).toBeCloseTo(0.08);
  });

  it('reports the modality a pointer kind implies', () => {
    for (const [pointerType, modality] of [
      ['mouse', 'mouse'],
      ['touch', 'touch'],
      ['pen', 'pen'],
      ['gamepad-cursor', 'gamepad'],
    ] as const) {
      const event = normalisePointerEvent(new TestPointerEvent('pointerdown', { pointerType }), {
        newId,
      });
      expect(event?.modality).toBe(modality);
    }
  });

  it('collects coalesced move samples in surface space', () => {
    const event = Object.assign(
      new TestPointerEvent('pointermove', { clientX: 150, clientY: 180 }),
      {
        getCoalescedEvents: () => [
          { clientX: 140, clientY: 170 },
          { clientX: 145, clientY: 175 },
        ],
      },
    );
    const normalised = normalisePointerEvent(event, { ...surface, newId });
    expect(normalised?.kind === 'move' && normalised.coalesced).toEqual([
      { x: 90, y: 90 },
      { x: 95, y: 95 },
    ]);
  });

  it('builds a synthetic cancel for blur, a hidden tab and palm rejection', () => {
    const press = normalisePointerEvent(new TestPointerEvent('pointerdown', { buttons: 1 }), {
      newId,
    });
    for (const reason of ['blur', 'visibility', 'palm-rejection'] as const) {
      const cancel = syntheticCancel(press?.pointer ?? never(), reason, 99, { newId });
      expect(cancel.reason).toBe(reason);
      expect(InputEventSchema.safeParse(cancel).success).toBe(true);
    }
  });
});

function never(): never {
  throw new Error('fixture did not produce a pointer');
}

describe('normaliseKeyboardEvent', () => {
  it('normalises a real KeyboardEvent and computes the chord', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyK',
      key: 'k',
      ctrlKey: true,
      shiftKey: true,
    });
    const normalised = normaliseKeyboardEvent(event, { newId, platform: 'other' });
    expect(normalised?.chord).toBe('mod+shift+k');
    expect(normalised?.phase).toBe('down');
    expect(InputEventSchema.safeParse(normalised).success).toBe(true);
  });

  it('spells the same keystroke differently per platform', () => {
    const event = new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', metaKey: true });
    expect(normaliseKeyboardEvent(event, { newId, platform: 'mac' })?.chord).toBe('mod+k');
    expect(normaliseKeyboardEvent(event, { newId, platform: 'other' })?.chord).toBe('meta+k');
  });

  it('infers `isComposing` from the legacy 229 keyCode', () => {
    // `keyCode` is read-only on a DOM event; an IME-aware polyfill hands the
    // normaliser the same structural shape, which is what is tested here.
    const real = new KeyboardEvent('keydown', { code: 'KeyA', key: 'Process' });
    const event: KeyboardEventLike = {
      type: real.type,
      code: real.code,
      key: real.key,
      repeat: real.repeat,
      location: real.location,
      altKey: real.altKey,
      ctrlKey: real.ctrlKey,
      metaKey: real.metaKey,
      shiftKey: real.shiftKey,
      timeStamp: real.timeStamp,
      keyCode: 229,
    };
    expect(normaliseKeyboardEvent(event, { newId })?.key.isComposing).toBe(true);
  });

  it('ignores DOM types that are not keydown or keyup', () => {
    expect(
      normaliseKeyboardEvent(new KeyboardEvent('keypress', { code: 'KeyA', key: 'a' }), { newId }),
    ).toBeNull();
  });

  it('turns the mouse side buttons into MouseBack / MouseForward keys', () => {
    expect(normaliseMouseNavButton(3, 'down', 1, { newId })?.key.code).toBe('MouseBack');
    expect(normaliseMouseNavButton(4, 'down', 1, { newId })?.key.code).toBe('MouseForward');
    expect(normaliseMouseNavButton(0, 'down', 1, { newId })).toBeNull();
  });
});

describe('normaliseWheelEvent', () => {
  it('converts line and page delta modes to pixels', () => {
    expect(toPixels(3, 1, 900)).toBe(3 * THRESHOLDS.wheelLineHeightPx);
    expect(toPixels(1, 2, 900)).toBe(900);
    expect(toPixels(42, 0, 900)).toBe(42);
  });

  it('normalises a real WheelEvent and reports pixels only', () => {
    const event = new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, clientX: 10, clientY: 20 });
    const normalised = normaliseWheelEvent(event, { newId, viewportHeight: 900 });
    expect(normalised.deltaY).toBe(48);
    expect(normalised.deltaMode).toBe('pixel');
    expect(InputEventSchema.safeParse(normalised).success).toBe(true);
  });

  it('promotes ctrl+wheel, the cross-platform pinch-zoom signal', () => {
    const event = new WheelEvent('wheel', { deltaY: -8.5, ctrlKey: true });
    expect(normaliseWheelEvent(event, { newId }).ctrlKey).toBe(true);
  });

  it('reads fractional deltas as a trackpad and whole notches as a wheel', () => {
    const detector = createTrackpadDetector();
    const wheel = normaliseWheelEvent(new WheelEvent('wheel', { deltaY: 120 }), {
      newId,
      detector,
    });
    expect(wheel.isTrackpad).toBe(false);
    detector.reset();
    const pad = normaliseWheelEvent(new WheelEvent('wheel', { deltaY: 11.75 }), {
      newId,
      detector,
    });
    expect(pad.isTrackpad).toBe(true);
  });

  it('stays trackpad for the rest of a burst once it has decided', () => {
    const detector = createTrackpadDetector();
    const at = (deltaY: number, timeStamp: number): WheelEventLike => {
      const real = new WheelEvent('wheel', { deltaY });
      return {
        deltaX: real.deltaX,
        deltaY: real.deltaY,
        deltaZ: real.deltaZ,
        deltaMode: real.deltaMode,
        clientX: real.clientX,
        clientY: real.clientY,
        pageX: real.pageX,
        pageY: real.pageY,
        altKey: real.altKey,
        ctrlKey: real.ctrlKey,
        metaKey: real.metaKey,
        shiftKey: real.shiftKey,
        timeStamp,
      };
    };
    normaliseWheelEvent(at(2.5, 0), { newId, detector });
    // A whole-number delta 30 ms later is the same burst, so it stays a pad.
    expect(normaliseWheelEvent(at(4, 30), { newId, detector }).isTrackpad).toBe(true);
    // A whole-number delta long afterwards is a fresh burst from a wheel.
    expect(normaliseWheelEvent(at(120, 5000), { newId, detector }).isTrackpad).toBe(false);
  });
});

describe('gamepad differ', () => {
  it('rescales the deadzone so the usable range is still [0, 1]', () => {
    expect(applyDeadzone(0.2)).toBe(0);
    expect(applyDeadzone(1)).toBe(1);
    expect(applyDeadzone(-1)).toBe(-1);
    expect(applyDeadzone(0.625)).toBeCloseTo(0.5);
  });

  it('picks the dominant stick direction and nothing inside the deadzone', () => {
    expect(stickDirection(0, 0)).toBeNull();
    expect(stickDirection(0.9, 0.2)).toBe('right');
    expect(stickDirection(0.1, -0.9)).toBe('up');
  });

  it('emits press, auto-repeat and release for a held d-pad direction', () => {
    const differ = createGamepadDiffer({ newId });
    const held = gamepadSnapshot([DPAD_INDEX.right]);

    expect(differ.poll([held], 0).map((event) => event.phase)).toEqual(['press']);
    // Before the repeat delay, nothing.
    expect(differ.poll([held], 100)).toEqual([]);
    expect(
      differ.poll([held], THRESHOLDS.gamepadRepeatDelayMs).map((event) => event.phase),
    ).toEqual(['repeat']);
    const release = differ.poll([gamepadSnapshot([])], 900);
    expect(release.map((event) => event.phase)).toEqual(['release']);
  });

  it('attaches focus-navigation semantics to d-pad presses and not to releases', () => {
    const differ = createGamepadDiffer({ newId });
    const [press] = differ.poll([gamepadSnapshot([DPAD_INDEX.up])], 0);
    const [release] = differ.poll([gamepadSnapshot([])], 10);
    expect(press?.navigation).toEqual({ direction: 'up', repeat: false, mode: 'focus' });
    expect(release?.navigation).toBeNull();
  });

  it('gives a face button no navigation, only a name', () => {
    const differ = createGamepadDiffer({ newId });
    const [press] = differ.poll([gamepadSnapshot([0])], 0);
    expect(press?.button).toBe('a');
    expect(press?.navigation).toBeNull();
  });

  it('treats the left stick as a d-pad so a pad without one still navigates', () => {
    const differ = createGamepadDiffer({ newId });
    const events = differ.poll([gamepadSnapshot([], [0, -0.95, 0, 0])], 0);
    expect(events.map((event) => event.navigation?.direction)).toEqual(['up']);
  });

  it('classifies a TV remote by id and by its missing sticks', () => {
    expect(roleOf(gamepadSnapshot([], [0, 0, 0, 0], { id: 'Android TV Remote' }))).toBe('remote');
    expect(roleOf(gamepadSnapshot([], [], { id: 'Unknown device' }))).toBe('remote');
    expect(roleOf(gamepadSnapshot([]))).toBe('gamepad');
  });

  it('reports a remote as the `remote` modality, which affordances key off', () => {
    const differ = createGamepadDiffer({ newId });
    const [press] = differ.poll(
      [gamepadSnapshot([DPAD_INDEX.down], [0, 0, 0, 0], { id: 'WebOS Magic Remote' })],
      0,
    );
    expect(press?.modality).toBe('remote');
    expect(InputEventSchema.safeParse(press).success).toBe(true);
  });

  it('skips disconnected slots', () => {
    const differ = createGamepadDiffer({ newId });
    expect(
      differ.poll([null, gamepadSnapshot([0], [0, 0, 0, 0], { connected: false })], 0),
    ).toEqual([]);
  });
});
