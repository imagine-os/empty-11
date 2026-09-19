/**
 * Field schemas shared by the catalogue. They encode the wire forms fixed in Interface & Data
 * Contracts section 1: UUIDv7 strings, ISO-8601 UTC timestamps, and money as a **decimal string
 * of minor units** because JSON has no bigint.
 */
import { z } from 'zod';

export const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const nullableUuid = uuid.nullable();
export const at = z.iso.datetime({ offset: false });
export const on = z.iso.date();
export const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
export const key = z.string().min(1).max(128);
/** `PAP-555` and friends. */
export const issueKey = z.string().regex(/^[A-Z]{2,6}-\d+$/);
/** Minor units as a decimal string: `"1999"` is $19.99 (Contracts section 1, PAP-302 `Money`). */
export const amountMinor = z.string().regex(/^-?\d{1,19}$/);
export const currency = z.string().regex(/^[A-Z]{3}$/);
/** Field names only — the values never travel on an event. */
export const changedFields = z.array(z.string().min(1).max(64)).max(200);
export const errorCode = z.string().min(1).max(64);
export const reasonCode = z.string().min(1).max(64);
