import type {
  CancelEvent,
  MoveEvent,
  PointerInputEvent,
  PressEvent,
  ReleaseEvent,
} from '../contract/event.js';
import type { PointerKind } from '../contract/pointer.js';
import type { InputModality, Modifiers, Point } from '../contract/primitives.js';
import { INPUT_CONTRACT_VERSION } from '../contract/version.js';
import type { NormaliseOptions, PointerEventLike } from './dom.js';
import { newEventId } from './ids.js';

/**
 * DOM Pointer Events → `press | move | release | cancel`.
 *
 * Mouse, touch, pen and the synthetic gamepad cursor all take this path, which
 * is the point of the abstraction: one code path, one set of fields, and no
 * component that has to ask what kind of device it is talking to.
 */

const TYPE_TO_KIND: Record<string, PointerInputEvent['kind']> = {
  pointerdown: 'press',
  pointermove: 'move',
  pointerrawupdate: 'move',
  pointerup: 'release',
  pointercancel: 'cancel',
  lostpointercapture: 'cancel',
  pointerover: 'move',
  pointerout: 'move',
};

const CANCEL_REASON: Record<string, CancelEvent['reason']> = {
  pointercancel: 'pointercancel',
  lostpointercapture: 'capture-lost',
};

export function pointerKindOf(pointerType: string): PointerKind {
  if (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'mouse')
    return pointerType;
  if (pointerType === 'gamepad-cursor') return 'gamepad-cursor';
  // Unknown device strings behave like a mouse: fine pointer, hover-capable.
  return 'mouse';
}

/** The modality a pointer kind reports as. */
export function modalityOfPointer(kind: PointerKind): InputModality {
  return kind === 'gamepad-cursor' ? 'gamepad' : kind;
}

export function modifiersOf(event: {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): Modifiers {
  return { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * Normalise one DOM pointer event.
 *
 * Returns `null` for a DOM type that has no place in the abstraction, so a
 * listener can forward everything it receives without filtering first.
 */
export function normalisePointerEvent(
  event: PointerEventLike,
  options: NormaliseOptions = {},
): PointerInputEvent | null {
  const kind = TYPE_TO_KIND[event.type];
  if (kind === undefined) return null;

  const newId = options.newId ?? newEventId;
  const left = options.surfaceRect?.left ?? 0;
  const top = options.surfaceRect?.top ?? 0;
  const pointerKind = pointerKindOf(event.pointerType);

  const pointer = {
    id: event.pointerId,
    kind: pointerKind,
    coordinates: {
      client: { x: event.clientX, y: event.clientY },
      page: { x: event.pageX, y: event.pageY },
      surface: { x: event.clientX - left, y: event.clientY - top },
    },
    // Mouse and touch report 0.5 while down and 0 while hovering per the
    // Pointer Events spec; browsers that report 0 on a press are corrected
    // here so a pressure-aware component never sees a pressed pointer at 0.
    pressure:
      kind === 'press' && event.pressure === 0 && pointerKind !== 'pen'
        ? 0.5
        : clamp(event.pressure, 0, 1),
    tangentialPressure: clamp(event.tangentialPressure ?? 0, -1, 1),
    tiltX: clamp(event.tiltX ?? 0, -90, 90),
    tiltY: clamp(event.tiltY ?? 0, -90, 90),
    twist: clamp(event.twist ?? 0, 0, 359),
    width: Math.max(0, event.width ?? 1),
    height: Math.max(0, event.height ?? 1),
    buttons: Math.max(0, event.buttons),
    button: kind === 'move' || event.button < 0 ? null : event.button,
    isPrimary: event.isPrimary,
  };

  const base = {
    id: newId(),
    contract: INPUT_CONTRACT_VERSION,
    timeStamp: event.timeStamp,
    modality: modalityOfPointer(pointerKind),
    modifiers: modifiersOf(event),
    surfaceId: options.surfaceId ?? null,
  } as const;

  switch (kind) {
    case 'press':
      return { ...base, kind: 'press', pointer } satisfies PressEvent;
    case 'release':
      return { ...base, kind: 'release', pointer } satisfies ReleaseEvent;
    case 'cancel':
      return {
        ...base,
        kind: 'cancel',
        pointer,
        reason: CANCEL_REASON[event.type] ?? 'pointercancel',
      } satisfies CancelEvent;
    default: {
      const coalesced: Point[] = (event.getCoalescedEvents?.() ?? []).map((raw) => ({
        x: raw.clientX - left,
        y: raw.clientY - top,
      }));
      return { ...base, kind: 'move', pointer, coalesced } satisfies MoveEvent;
    }
  }
}

/**
 * Build a `cancel` for a pointer the DOM will never tell us about again:
 * window blur, a hidden tab, or palm rejection while a pen is active.
 */
export function syntheticCancel(
  pointer: PointerInputEvent['pointer'],
  reason: CancelEvent['reason'],
  timeStamp: number,
  options: NormaliseOptions = {},
): CancelEvent {
  return {
    id: (options.newId ?? newEventId)(),
    contract: INPUT_CONTRACT_VERSION,
    timeStamp,
    modality: modalityOfPointer(pointer.kind),
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    surfaceId: options.surfaceId ?? null,
    kind: 'cancel',
    pointer,
    reason,
  };
}
