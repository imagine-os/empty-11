import { z } from 'zod';

/**
 * Geometry and modifier primitives shared by every input event.
 *
 * All coordinates are CSS pixels. Angles are degrees. Normalised analogue
 * values (`pressure`, stick axes, `confidence`) are clamped to their range by
 * the normaliser, never by the consumer.
 */

/** A point in one coordinate space, CSS pixels. */
export const PointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .describe('A point in CSS pixels.');

export type Point = z.infer<typeof PointSchema>;

/**
 * The three coordinate spaces every pointer carries.
 *
 * * `client` — viewport origin, what `getBoundingClientRect()` compares against.
 * * `page` — document origin, survives scrolling.
 * * `surface` — origin of the element the pointer surface is bound to, which is
 *   the only space a component should do arithmetic in.
 */
export const CoordinatesSchema = z
  .object({
    client: PointSchema,
    page: PointSchema,
    surface: PointSchema,
  })
  .describe('Pointer position in the client, page and surface coordinate spaces.');

export type Coordinates = z.infer<typeof CoordinatesSchema>;

/**
 * Modifier keys held when the event was produced.
 *
 * `mod` is deliberately absent: it is a *chord* concept (Cmd on macOS, Ctrl
 * elsewhere) resolved by `parseChord` / `matchChord`, not a physical key.
 */
export const ModifiersSchema = z
  .object({
    alt: z.boolean(),
    ctrl: z.boolean(),
    meta: z.boolean(),
    shift: z.boolean(),
  })
  .describe('Modifier keys held at the time of the event.');

export type Modifiers = z.infer<typeof ModifiersSchema>;

/** No modifier held. Frozen so it can be shared without defensive copies. */
export const NO_MODIFIERS: Readonly<Modifiers> = Object.freeze({
  alt: false,
  ctrl: false,
  meta: false,
  shift: false,
});

/**
 * How the event reached us.
 *
 * `remote` is a TV remote or a d-pad-only device: a gamepad whose mapping the
 * detector has classified as directional-only. It is a separate modality from
 * `gamepad` because the affordances differ (no cursor, focus moves only).
 */
export const InputModalitySchema = z
  .enum(['keyboard', 'mouse', 'touch', 'pen', 'gamepad', 'remote', 'voice', 'unknown'])
  .describe('The device class that produced the event.');

export type InputModality = z.infer<typeof InputModalitySchema>;

/** A direction on the d-pad / arrow-key plane. */
export const DirectionSchema = z.enum(['up', 'down', 'left', 'right']);

export type Direction = z.infer<typeof DirectionSchema>;
