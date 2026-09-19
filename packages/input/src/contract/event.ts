import { z } from 'zod';
import {
  FocusNavigationSchema,
  GamepadAxesSchema,
  GamepadButtonSchema,
  GamepadDeviceSchema,
} from './gamepad.js';
import { KeySchema } from './keyboard.js';
import { PointerSchema } from './pointer.js';
import { InputModalitySchema, ModifiersSchema, PointSchema } from './primitives.js';
import { INPUT_CONTRACT_VERSION } from './version.js';
import { VoiceIntentSchema } from './voice.js';

/**
 * The envelope every input event carries, whatever produced it.
 *
 * `id` is a UUID so an event can be logged, replayed and correlated across
 * windows (multiplayer-ready data rule); `timeStamp` is a monotonic
 * `performance.now()` reading, not a wall clock, because gesture thresholds are
 * measured against it.
 */
const EventBase = {
  id: z.string().min(1),
  contract: z.literal(INPUT_CONTRACT_VERSION),
  /** Monotonic milliseconds since document start. */
  timeStamp: z.number().min(0),
  modality: InputModalitySchema,
  modifiers: ModifiersSchema,
  /** Id of the pointer surface (or scope) the event was delivered to. */
  surfaceId: z.string().nullable(),
};

/** Pointer went down. The surface takes pointer capture on this event. */
export const PressEventSchema = z.object({
  ...EventBase,
  kind: z.literal('press'),
  pointer: PointerSchema,
});

/** Pointer moved, pressed or hovering. `pointer.buttons === 0` means hover. */
export const MoveEventSchema = z.object({
  ...EventBase,
  kind: z.literal('move'),
  pointer: PointerSchema,
  /** Coalesced intermediate positions, oldest first; may be empty. */
  coalesced: z.array(PointSchema),
});

/** Pointer went up. Exactly one `release` or `cancel` per pointer id. */
export const ReleaseEventSchema = z.object({
  ...EventBase,
  kind: z.literal('release'),
  pointer: PointerSchema,
});

/**
 * The interaction was taken away: `pointercancel`, window blur, hidden tab, or
 * palm rejection while a pen is active. Consumers undo, they do not commit.
 */
export const CancelEventSchema = z.object({
  ...EventBase,
  kind: z.literal('cancel'),
  pointer: PointerSchema,
  reason: z.enum(['pointercancel', 'blur', 'visibility', 'capture-lost', 'palm-rejection']),
});

/**
 * Wheel, trackpad or pinch, always in pixels.
 *
 * Line and page delta modes are converted by the normaliser (16 px per line,
 * viewport height per page) so no consumer ever sees `deltaMode`. `isTrackpad`
 * is inferred from fractional deltas and burst cadence; `ctrlKey` with a wheel
 * is the browser's pinch-zoom signal on every platform.
 */
export const WheelEventSchema = z.object({
  ...EventBase,
  kind: z.literal('wheel'),
  deltaX: z.number(),
  deltaY: z.number(),
  deltaZ: z.number(),
  deltaMode: z.literal('pixel'),
  isTrackpad: z.boolean(),
  ctrlKey: z.boolean(),
  /** Where the wheel happened, in the three coordinate spaces. */
  position: z.object({ client: PointSchema, page: PointSchema, surface: PointSchema }),
});

/** A key went down or up, with its portable chord string already computed. */
export const KeyEventSchema = z.object({
  ...EventBase,
  kind: z.literal('key'),
  phase: z.enum(['down', 'up']),
  key: KeySchema,
  /** Portable chord for this keystroke, e.g. `mod+shift+k`. */
  chord: z.string(),
});

/**
 * A gamepad or TV-remote control changed.
 *
 * D-pad presses (and a left stick past the deadzone) carry `navigation`, which
 * is the focus-movement intent a component acts on; everything else is a named
 * button with a semantic meaning from `GAMEPAD_SEMANTICS`.
 */
export const GamepadInputEventSchema = z.object({
  ...EventBase,
  kind: z.literal('gamepad'),
  device: GamepadDeviceSchema,
  phase: z.enum(['press', 'repeat', 'release']),
  button: GamepadButtonSchema,
  /** Analogue value of the control, [0, 1]. Triggers report partial presses. */
  value: z.number().min(0).max(1),
  axes: GamepadAxesSchema,
  navigation: FocusNavigationSchema.nullable(),
});

/** A voice utterance resolved to an action id. */
export const VoiceEventSchema = z.object({
  ...EventBase,
  kind: z.literal('voice'),
  intent: VoiceIntentSchema,
});

/**
 * The one event type every PaperOS component handles.
 *
 * A component switches on `kind`, never on the device: mouse, touch, pen and a
 * gamepad cursor all arrive as `press` / `move` / `release` / `cancel` with the
 * same fields, and `modality` is there only for affordances (hit-target size,
 * focus rings, hover hints), never for behaviour.
 */
export const InputEventSchema = z.discriminatedUnion('kind', [
  PressEventSchema,
  MoveEventSchema,
  ReleaseEventSchema,
  CancelEventSchema,
  WheelEventSchema,
  KeyEventSchema,
  GamepadInputEventSchema,
  VoiceEventSchema,
]);

export type PressEvent = z.infer<typeof PressEventSchema>;
export type MoveEvent = z.infer<typeof MoveEventSchema>;
export type ReleaseEvent = z.infer<typeof ReleaseEventSchema>;
export type CancelEvent = z.infer<typeof CancelEventSchema>;
export type WheelInputEvent = z.infer<typeof WheelEventSchema>;
export type KeyInputEvent = z.infer<typeof KeyEventSchema>;
export type GamepadInputEvent = z.infer<typeof GamepadInputEventSchema>;
export type VoiceInputEvent = z.infer<typeof VoiceEventSchema>;
export type InputEvent = z.infer<typeof InputEventSchema>;

export type InputEventKind = InputEvent['kind'];

/** The four pointer-shaped events, narrowed. */
export type PointerInputEvent = PressEvent | MoveEvent | ReleaseEvent | CancelEvent;

const POINTER_KINDS = new Set<InputEventKind>(['press', 'move', 'release', 'cancel']);

/** Type guard: does this event carry a `pointer`? */
export function isPointerEvent(event: InputEvent): event is PointerInputEvent {
  return POINTER_KINDS.has(event.kind);
}

/** Type guard: is this a d-pad event asking for focus to move? */
export function isFocusNavigation(
  event: InputEvent,
): event is GamepadInputEvent & { navigation: NonNullable<GamepadInputEvent['navigation']> } {
  return event.kind === 'gamepad' && event.navigation !== null;
}
