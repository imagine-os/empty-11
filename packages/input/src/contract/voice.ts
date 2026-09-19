import { z } from 'zod';

/**
 * A recognised voice intent.
 *
 * The voice controller does not send keystrokes: it resolves an utterance to an
 * action id from the actions registry and emits this event. `transcript` and
 * `confidence` travel with it so a page can ask for confirmation on a low
 * score, and so the whole interaction is auditable.
 */
export const VoiceIntentSchema = z
  .object({
    /** Action id from the actions registry, e.g. `record.duplicate`. */
    actionId: z.string().min(1),
    /** What the recogniser heard, verbatim. */
    transcript: z.string(),
    /** Recogniser confidence, [0, 1]. */
    confidence: z.number().min(0).max(1),
    /** BCP-47 tag of the utterance; `en` and `es` are the shipped locales. */
    locale: z.string().min(2),
    /** Slot values extracted from the utterance, e.g. `{ query: 'invoices' }`. */
    slots: z.record(z.string(), z.string()),
    /** False for interim results; only final results may run an action. */
    final: z.boolean(),
    /** The intent phrase that matched, as declared on the action. */
    matchedPhrase: z.string().nullable(),
  })
  .describe('A voice utterance resolved to an action id.');

export type VoiceIntent = z.infer<typeof VoiceIntentSchema>;

/**
 * Confidence at or above which a voice intent may run without confirmation.
 * Below it the page confirms; below `VOICE_REJECT_BELOW` it is discarded.
 */
export const VOICE_CONFIRM_ABOVE = 0.8;
export const VOICE_REJECT_BELOW = 0.4;
