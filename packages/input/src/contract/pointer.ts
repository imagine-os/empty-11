import { z } from 'zod';
import { CoordinatesSchema } from './primitives.js';

/**
 * Pointer kinds. `gamepad-cursor` is the synthetic pointer a gamepad or remote
 * drives when cursor mode is on; it behaves like a mouse but reports its true
 * origin so a component can offer larger targets and no hover-only affordances.
 */
export const PointerKindSchema = z.enum(['mouse', 'touch', 'pen', 'gamepad-cursor']);

export type PointerKind = z.infer<typeof PointerKindSchema>;

/**
 * Mouse button bits, as the DOM `buttons` bitmask.
 *
 * Bit 2 (`SECONDARY_BARREL`, value 2) is the right mouse button *and* the pen
 * barrel button — the two are the same signal and components must treat them
 * the same. Bits 8 and 16 are the side buttons, which the normaliser also emits
 * as `MouseBack` / `MouseForward` key events.
 */
export const BUTTON_BITS = {
  primary: 1,
  secondaryBarrel: 2,
  auxiliary: 4,
  back: 8,
  forward: 16,
  penEraser: 32,
} as const;

/**
 * One pointer at one instant.
 *
 * Pen fields (`pressure`, `tiltX`, `tiltY`, `twist`) are present for every
 * kind: mouse and touch report `pressure` 0.5 while down and 0 while hovering,
 * which is what the Pointer Events spec mandates, so a pressure-aware component
 * needs no device check.
 */
export const PointerSchema = z
  .object({
    /** Stable for the life of the pointer; reused by the platform afterwards. */
    id: z.number().int(),
    kind: PointerKindSchema,
    coordinates: CoordinatesSchema,
    /** 0 while hovering, (0, 1] while down. Clamped by the normaliser. */
    pressure: z.number().min(0).max(1),
    /** Tangential (barrel) pressure, [-1, 1]. 0 for devices without it. */
    tangentialPressure: z.number().min(-1).max(1),
    /** Pen tilt from vertical, degrees, [-90, 90]. */
    tiltX: z.number().min(-90).max(90),
    tiltY: z.number().min(-90).max(90),
    /** Pen barrel rotation, degrees, [0, 359]. */
    twist: z.number().min(0).max(359),
    /** Contact geometry in CSS pixels; 1 x 1 for a mouse. */
    width: z.number().min(0),
    height: z.number().min(0),
    /** DOM `buttons` bitmask; see `BUTTON_BITS`. 0 means hovering. */
    buttons: z.number().int().min(0),
    /** The button that changed on this event, or null on move/hover. */
    button: z.number().int().nullable(),
    /** First pointer of its kind in the current interaction. */
    isPrimary: z.boolean(),
  })
  .describe('One pointer at one instant, device-independent.');

export type Pointer = z.infer<typeof PointerSchema>;

/** True when the pointer is hovering rather than pressed. */
export function isHovering(pointer: Pointer): boolean {
  return pointer.buttons === 0;
}

/** True when the secondary / barrel button is held. */
export function hasBarrelButton(pointer: Pointer): boolean {
  return (pointer.buttons & BUTTON_BITS.secondaryBarrel) !== 0;
}
