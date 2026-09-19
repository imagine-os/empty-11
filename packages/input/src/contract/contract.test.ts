import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Action, ActionDeclaration } from './action.js';
import { ActionDeclarationSchema, defineAction, toDeclaration } from './action.js';
import type {
  CancelEvent,
  GamepadInputEvent,
  InputEvent,
  KeyInputEvent,
  PointerInputEvent,
  PressEvent,
  VoiceInputEvent,
} from './event.js';
import { InputEventSchema, isFocusNavigation, isPointerEvent } from './event.js';
import type { Pointer } from './pointer.js';
import { BUTTON_BITS, hasBarrelButton, isHovering } from './pointer.js';
import type { InputModality } from './primitives.js';
import { INPUT_CONTRACT_VERSION } from './version.js';
import { VoiceIntentSchema } from './voice.js';

const pointer: Pointer = {
  id: 1,
  kind: 'pen',
  coordinates: {
    client: { x: 10, y: 20 },
    page: { x: 10, y: 120 },
    surface: { x: 0, y: 0 },
  },
  pressure: 0.4,
  tangentialPressure: 0,
  tiltX: 10,
  tiltY: -10,
  twist: 0,
  width: 2,
  height: 2,
  buttons: BUTTON_BITS.primary,
  button: 0,
  isPrimary: true,
};

const press: PressEvent = {
  id: 'evt-1',
  contract: INPUT_CONTRACT_VERSION,
  timeStamp: 1,
  modality: 'pen',
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  surfaceId: null,
  kind: 'press',
  pointer,
};

describe('InputEvent union', () => {
  it('narrows on `kind` alone', () => {
    const event: InputEvent = press;
    if (event.kind === 'press') {
      expectTypeOf(event).toEqualTypeOf<PressEvent>();
      expectTypeOf(event.pointer.pressure).toEqualTypeOf<number>();
    }
  });

  it('exposes exactly eight kinds', () => {
    expectTypeOf<InputEvent['kind']>().toEqualTypeOf<
      'press' | 'move' | 'release' | 'cancel' | 'wheel' | 'key' | 'gamepad' | 'voice'
    >();
  });

  it('gives every pointer-shaped event a `pointer`', () => {
    expectTypeOf<PointerInputEvent['pointer']>().toEqualTypeOf<Pointer>();
    expect(isPointerEvent(press)).toBe(true);
  });

  it('carries a reason on cancel and nowhere else', () => {
    expectTypeOf<CancelEvent['reason']>().toEqualTypeOf<
      'pointercancel' | 'blur' | 'visibility' | 'capture-lost' | 'palm-rejection'
    >();
    // @ts-expect-error a press has no `reason`
    expectTypeOf<PressEvent>().toHaveProperty('reason');
  });

  it('types the key event chord as a string and the phase as down|up', () => {
    expectTypeOf<KeyInputEvent['chord']>().toEqualTypeOf<string>();
    expectTypeOf<KeyInputEvent['phase']>().toEqualTypeOf<'down' | 'up'>();
  });

  it('types the voice intent with an action id, transcript and confidence', () => {
    expectTypeOf<VoiceInputEvent['intent']['actionId']>().toEqualTypeOf<string>();
    expectTypeOf<VoiceInputEvent['intent']['transcript']>().toEqualTypeOf<string>();
    expectTypeOf<VoiceInputEvent['intent']['confidence']>().toEqualTypeOf<number>();
  });

  it('makes focus navigation nullable on gamepad events and narrows it', () => {
    expectTypeOf<GamepadInputEvent['navigation']>().toBeNullable();
    const event: GamepadInputEvent = {
      ...press,
      kind: 'gamepad',
      modality: 'remote',
      device: { index: 0, id: 'remote', mapping: 'standard', role: 'remote' },
      phase: 'press',
      button: 'down',
      value: 1,
      axes: { leftX: 0, leftY: 0, rightX: 0, rightY: 0 },
      navigation: { direction: 'down', repeat: false, mode: 'focus' },
    };
    expect(isFocusNavigation(event)).toBe(true);
    if (isFocusNavigation(event)) {
      expectTypeOf(event.navigation.direction).toEqualTypeOf<'up' | 'down' | 'left' | 'right'>();
    }
  });

  it('validates a well-formed event and rejects an out-of-range pressure', () => {
    expect(InputEventSchema.safeParse(press).success).toBe(true);
    const bad = { ...press, pointer: { ...pointer, pressure: 1.5 } };
    expect(InputEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(InputEventSchema.safeParse({ ...press, kind: 'hover' }).success).toBe(false);
  });
});

describe('pointer helpers', () => {
  it('tells hover from press without a device check', () => {
    expect(isHovering({ ...pointer, buttons: 0 })).toBe(true);
    expect(isHovering(pointer)).toBe(false);
  });

  it('reads the barrel button and the right mouse button as the same bit', () => {
    expect(hasBarrelButton({ ...pointer, buttons: BUTTON_BITS.secondaryBarrel })).toBe(true);
    expect(hasBarrelButton(pointer)).toBe(false);
  });
});

describe('voice intent', () => {
  it('requires a confidence in [0, 1]', () => {
    const base = {
      actionId: 'record.duplicate',
      transcript: 'duplicate this record',
      locale: 'en',
      slots: {},
      final: true,
      matchedPhrase: 'duplicate this record',
    };
    expect(VoiceIntentSchema.safeParse({ ...base, confidence: 0.91 }).success).toBe(true);
    expect(VoiceIntentSchema.safeParse({ ...base, confidence: 1.4 }).success).toBe(false);
  });
});

describe('Action declarations', () => {
  const action = defineAction({
    id: 'record.duplicate',
    titleKey: 'record.action.duplicate',
    intent: { en: ['duplicate this record', 'copy this record'], es: ['duplicar este registro'] },
    permission: 'record:write',
    shortcut: 'mod+d',
    agentCallable: true,
    run: () => undefined,
  });

  it('fills the defaults a page should not have to spell out', () => {
    expect(action.scope).toBe('page');
    expect(action.placeholder).toBe(false);
    expect(action.descriptionKey).toBeNull();
    expect(action.modalities).toEqual([]);
  });

  it('separates the serialisable declaration from the handler', () => {
    const declaration = toDeclaration(action);
    expectTypeOf(declaration).toEqualTypeOf<ActionDeclaration>();
    expect('run' in declaration).toBe(false);
    expect(ActionDeclarationSchema.safeParse(declaration).success).toBe(true);
  });

  it('requires both locales, so Spanish is never a later pass', () => {
    expect(() =>
      defineAction({
        id: 'record.archive',
        titleKey: 'record.action.archive',
        // @ts-expect-error `es` is required
        intent: { en: ['archive this record'] },
        run: () => undefined,
      }),
    ).toThrow();
  });

  it('rejects an id that is not dot-namespaced', () => {
    expect(() =>
      defineAction({
        id: 'duplicate',
        titleKey: 'record.action.duplicate',
        intent: { en: ['duplicate'], es: ['duplicar'] },
        run: () => undefined,
      }),
    ).toThrow();
  });

  it('types the handler result and the context source', () => {
    expectTypeOf<Action<number>['run']>().returns.toEqualTypeOf<number | Promise<number>>();
    expectTypeOf<Parameters<Action['run']>[0]['source']>().toEqualTypeOf<
      'keyboard' | 'pointer' | 'voice' | 'gamepad' | 'menu' | 'palette' | 'agent'
    >();
  });

  it('keeps modality a closed set so a new device is a contract change', () => {
    expectTypeOf<InputModality>().toEqualTypeOf<
      'keyboard' | 'mouse' | 'touch' | 'pen' | 'gamepad' | 'remote' | 'voice' | 'unknown'
    >();
  });
});
