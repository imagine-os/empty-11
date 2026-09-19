import { z } from 'zod';
import { InputModalitySchema } from './primitives.js';

/**
 * What the device can do right now — media queries plus what has actually been
 * observed. "Seen" flags only ever go from false to true within a session: a
 * laptop with a touchscreen is both fine- and coarse-pointer capable, and a
 * tablet that has just been given a keyboard must not lose its touch
 * affordances.
 */
export const InputCapabilitiesSchema = z
  .object({
    /** `(pointer: coarse)` — finger or remote-driven cursor. */
    coarsePointer: z.boolean(),
    /** `(any-pointer: fine)` — mouse, trackpad or pen. */
    finePointer: z.boolean(),
    /** `(any-hover: hover)` — a hover state exists and can be relied on. */
    hover: z.boolean(),
    /** `navigator.maxTouchPoints`. */
    touchPoints: z.number().int().min(0),
    penSeen: z.boolean(),
    keyboardSeen: z.boolean(),
    gamepadConnected: z.boolean(),
    remoteConnected: z.boolean(),
    voiceSupported: z.boolean(),
    /** `(prefers-reduced-motion: reduce)`, mirrored here so one hook covers it. */
    reducedMotion: z.boolean(),
  })
  .describe('Observed and queried input capabilities of the current device.');

export type InputCapabilities = z.infer<typeof InputCapabilitiesSchema>;

/**
 * The modality signal.
 *
 * `current` is whatever produced the last event. `preferred` is the stickier
 * answer a UI should render against: it ignores incidental events (a stray
 * mouse move while typing, a scroll during dictation) and only switches when a
 * modality produces a *deliberate* interaction. Focus rings, hit-target sizes
 * and hover hints read `preferred`; analytics reads `current`.
 */
export const ModalityStateSchema = z.object({
  current: InputModalitySchema,
  previous: InputModalitySchema,
  preferred: InputModalitySchema,
  /** Monotonic timestamp of the last `preferred` change. */
  changedAt: z.number().min(0),
  capabilities: InputCapabilitiesSchema,
});

export type ModalityState = z.infer<typeof ModalityStateSchema>;

/**
 * `data-input-*` attributes mirrored onto `<html>` so CSS can respond without
 * JavaScript in the render path: `[data-input-modality='touch']`,
 * `[data-input-coarse]`, `[data-input-hover]`, `[data-input-focus-visible]`.
 */
export const DATA_ATTRIBUTES = {
  modality: 'data-input-modality',
  preferred: 'data-input-preferred',
  coarse: 'data-input-coarse',
  fine: 'data-input-fine',
  hover: 'data-input-hover',
  pen: 'data-input-pen',
  gamepad: 'data-input-gamepad',
  remote: 'data-input-remote',
} as const;
