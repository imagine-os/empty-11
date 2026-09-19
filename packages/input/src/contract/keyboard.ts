import { z } from 'zod';

/**
 * A normalised key.
 *
 * `code` is the physical key (layout-independent, `KeyK` on QWERTY and AZERTY
 * alike) and is what letter chords match on; `key` is the produced character
 * and is what symbol chords match on. Both are kept so a non-Latin layout
 * behaves the same as a US one.
 */
export const KeySchema = z
  .object({
    /** `KeyboardEvent.code`, or a synthetic code such as `MouseBack`. */
    code: z.string().min(1),
    /** `KeyboardEvent.key`, the produced character or named key. */
    key: z.string().min(1),
    /** Auto-repeat from a held key. */
    repeat: z.boolean(),
    /**
     * True while an IME composition is in flight. Consumers MUST NOT match
     * chords while this is true (round 4 amendment): composition keystrokes
     * belong to the editor, not to the command registry.
     */
    isComposing: z.boolean(),
    /** DOM `KeyboardEvent.location`: 0 standard, 1 left, 2 right, 3 numpad. */
    location: z.number().int().min(0).max(3),
  })
  .describe('A layout-aware normalised key.');

export type Key = z.infer<typeof KeySchema>;

/**
 * A portable chord string such as `mod+shift+k`.
 *
 * `mod` resolves to Cmd on macOS and Ctrl everywhere else, which is why chords
 * are stored in this form and never as `meta+k`. Parsed and matched by
 * `parseChord` / `matchChord`; rendered for a platform by `formatChord`.
 */
export const ChordSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(\+[^+\s]+)*$/i,
    'A chord is modifier tokens and one key token joined by "+", e.g. mod+shift+k',
  )
  .describe('Portable chord string, e.g. "mod+shift+k".');

export type Chord = z.infer<typeof ChordSchema>;

/** Synthetic codes for mouse side buttons, mapped to nav.back / nav.forward. */
export const MOUSE_NAV_CODES = {
  back: 'MouseBack',
  forward: 'MouseForward',
} as const;
