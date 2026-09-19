/**
 * Identifiers. Every PaperOS row, event, comment and file is keyed by a UUIDv7.
 *
 * UUIDv7 (RFC 9562) puts a 48-bit Unix millisecond timestamp in the high bits,
 * so ids sort by creation time as strings and as `uuid` values in Postgres.
 * That is what makes keyset pagination, outbox draining and offline id
 * generation work: a client can mint an id before the row reaches the server
 * and the row still lands in the right place in the index.
 *
 * `uuidv7()` is the TypeScript twin of `uuid_generate_v7()` from migration 0000
 * (PAP-32); the two produce the same layout and are interchangeable.
 */

import { z } from 'zod';
import type { Brand } from './brand.js';
import { ApiError, ValidationError } from './error.js';

/** A lowercase, canonically formatted UUID string. */
export type Uuid = Brand<string, 'Uuid'>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The all-zero UUID. It is the `id` of {@link ANONYMOUS_ACTOR} and never the id
 * of a row: `actor_id` is stored `NULL` for an anonymous actor.
 */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000' as Uuid;

/** True for a lowercase canonical UUID of any version, including the nil UUID. */
export function isUuid(value: unknown): value is Uuid {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** True only for a version 7, variant 10 UUID. */
export function isUuidV7(value: unknown): value is Uuid {
  return isUuid(value) && value[14] === '7' && '89ab'.includes(value[19] as string);
}

/** Narrow a string to `Uuid`, or throw `VALIDATION`. Does not lowercase: the wire form is lowercase. */
export function toUuid(value: string): Uuid {
  if (!isUuid(value)) throw new ValidationError(`not a UUID: ${JSON.stringify(value)}`);
  return value;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const source = globalThis.crypto;
  if (source === undefined || typeof source.getRandomValues !== 'function') {
    throw new ApiError('INTERNAL', 'no cryptographic random source (globalThis.crypto) available');
  }
  source.getRandomValues(bytes);
  return bytes;
}

const HEX = '0123456789abcdef';

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += (HEX[byte >> 4] as string) + (HEX[byte & 0x0f] as string);
  return out;
}

let lastMilliseconds = -1;
let sequence = 0;

/** 12-bit in-process counter (RFC 9562 method 3) so ids minted in the same millisecond still sort. */
function tick(nowMilliseconds: number): { milliseconds: number; sequence: number } {
  if (nowMilliseconds > lastMilliseconds) {
    lastMilliseconds = nowMilliseconds;
    sequence = 0;
  } else {
    sequence += 1;
    if (sequence > 0xfff) {
      lastMilliseconds += 1;
      sequence = 0;
    }
  }
  return { milliseconds: lastMilliseconds, sequence };
}

/**
 * Mint a UUIDv7. Monotonic within a process even when several ids are created
 * in the same millisecond or the wall clock steps backwards.
 *
 * @param now Unix milliseconds; defaults to `Date.now()`. Exposed for tests and
 *   for back-dating an imported record.
 */
export function uuidv7(now: number = Date.now()): Uuid {
  const { milliseconds, sequence: seq } = tick(Math.floor(now));
  const bytes = randomBytes(16);
  const timestamp = BigInt(milliseconds);
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((timestamp >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = 0x70 | (seq >> 8);
  bytes[7] = seq & 0xff;
  bytes[8] = 0x80 | ((bytes[8] as number) & 0x3f);
  const text = hex(bytes);
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}` as Uuid;
}

/** The creation time encoded in a UUIDv7. Throws `VALIDATION` for any other id. */
export function uuidv7Timestamp(id: Uuid | string): Date {
  if (!isUuidV7(id)) throw new ValidationError(`not a UUIDv7: ${JSON.stringify(id)}`);
  return new Date(Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16));
}

/** Wire schema for a UUID. Converts to JSON Schema as `{ type: 'string' }` with a pattern. */
export const uuidSchema = z
  .string()
  .regex(UUID_RE, 'must be a lowercase canonical UUID') as unknown as z.ZodType<Uuid, string>;
