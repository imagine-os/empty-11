import { z } from 'zod';
import { DirectionSchema } from './primitives.js';

/**
 * Standard-mapping gamepad buttons, named rather than indexed so a TV remote,
 * an Xbox pad and a PlayStation pad produce the same event.
 */
export const GamepadButtonSchema = z.enum([
  'a',
  'b',
  'x',
  'y',
  'l1',
  'r1',
  'l2',
  'r2',
  'select',
  'start',
  'l3',
  'r3',
  'up',
  'down',
  'left',
  'right',
  'home',
]);

export type GamepadButton = z.infer<typeof GamepadButtonSchema>;

/** Standard-mapping index → name, per the Gamepad API standard mapping. */
export const STANDARD_BUTTON_MAP: readonly GamepadButton[] = Object.freeze([
  'a',
  'b',
  'x',
  'y',
  'l1',
  'r1',
  'l2',
  'r2',
  'select',
  'start',
  'l3',
  'r3',
  'up',
  'down',
  'left',
  'right',
  'home',
]);

/** Which of the two device roles the pad is treated as. */
export const GamepadRoleSchema = z.enum(['gamepad', 'remote']);

export type GamepadRole = z.infer<typeof GamepadRoleSchema>;

export const GamepadDeviceSchema = z.object({
  /** `navigator.getGamepads()` slot. */
  index: z.number().int().min(0),
  /** Device id string reported by the platform. */
  id: z.string(),
  mapping: z.enum(['standard', 'non-standard']),
  role: GamepadRoleSchema,
});

export type GamepadDevice = z.infer<typeof GamepadDeviceSchema>;

/** Both sticks after deadzone and normalisation to [-1, 1]. */
export const GamepadAxesSchema = z.object({
  leftX: z.number().min(-1).max(1),
  leftY: z.number().min(-1).max(1),
  rightX: z.number().min(-1).max(1),
  rightY: z.number().min(-1).max(1),
});

export type GamepadAxes = z.infer<typeof GamepadAxesSchema>;

/**
 * Focus-navigation semantics attached to a d-pad press (or to a left stick
 * pushed past the deadzone).
 *
 * This is the whole point of the d-pad branch: a component never reads button
 * indices, it reads `navigation.direction` and moves focus. `repeat` is true
 * for the auto-repeat ticks that follow a held direction, so a list can scroll
 * smoothly while a dialog can choose to ignore repeats.
 */
export const FocusNavigationSchema = z
  .object({
    direction: DirectionSchema,
    repeat: z.boolean(),
    /** `focus` moves the focus ring; `cursor` drives the synthetic pointer. */
    mode: z.enum(['focus', 'cursor']),
  })
  .describe('Directional focus-navigation intent carried by a d-pad event.');

export type FocusNavigation = z.infer<typeof FocusNavigationSchema>;

/** Semantic meaning of the face buttons, so pages never switch on `a` / `b`. */
export const GAMEPAD_SEMANTICS: Readonly<Partial<Record<GamepadButton, string>>> = Object.freeze({
  a: 'action.activate',
  b: 'action.back',
  x: 'action.contextMenu',
  y: 'action.secondary',
  start: 'action.menu',
  select: 'action.options',
  home: 'action.home',
});
