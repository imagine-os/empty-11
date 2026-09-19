/**
 * Model ids and reasoning efforts (PAP-103, round-4 amendment).
 *
 * `PRICE_TABLE_MODELS` mirrors the ids of the PAP-98 price table (`prices.ts`, not yet landed).
 * A character whose `model` or `fallbackModel` is not in it gets a `MODEL_UNKNOWN` warning, never
 * an error: the price table, not this list, is authoritative once PAP-98 ships.
 *
 * `effort`: `low | medium | high | max`. The older `xhigh` spelling in the character sheets is an
 * accepted alias that the parser normalises to `high`.
 */

export const PRICE_TABLE_MODELS = [
  'claude-fable-5-1',
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-haiku-4-5',
] as const;
export type PriceTableModel = (typeof PRICE_TABLE_MODELS)[number];

export const DEFAULT_MODEL: PriceTableModel = 'claude-fable-5-1';

export const EFFORTS = ['low', 'medium', 'high', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

/** Input spellings the schema accepts; `xhigh` normalises to `high`. */
export const EFFORT_INPUTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortInput = (typeof EFFORT_INPUTS)[number];

export function normaliseEffort(value: EffortInput): Effort {
  return value === 'xhigh' ? 'high' : value;
}

export const PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'dontAsk'] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

/** Model id grammar: vendor-style kebab id, e.g. `claude-sonnet-5`. */
export const MODEL_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
