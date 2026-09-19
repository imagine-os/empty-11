/**
 * `ActorRef`, `EntityRef`, `Uuid` and `uuidv7()` — a **type-equal local copy** of the shared
 * value types specified in PAP-302 (`@paperos/core/types`, ADR 0011).
 *
 * PAP-555 ships before PAP-302, and twenty consumers need the envelope on day one. The shapes
 * here are the ones Interface & Data Contracts section 1 fixes, so the swap is mechanical:
 * when `packages/core/src/types/` lands, this file becomes
 * `export { type ActorRef, actorRefSchema, ... } from '../types/index.js';`
 * and `refs.equivalence.test.ts` proves the two are assignable in both directions.
 */
import { z } from 'zod';

/** Lowercase canonical UUID string. Ids are UUIDv7 (Contracts section 1). */
export type Uuid = string;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const uuidSchema = z.string().regex(UUID_RE, 'must be a lowercase canonical UUID');

/** ISO-8601 UTC with milliseconds, the wire form of every timestamp. */
export const isoDateTimeSchema = z.iso.datetime({ offset: false });

/**
 * `ActorRef` is the projection of `Principal` (PAP-55) stored on rows, events and comments.
 * `type` is exactly `PrincipalType`.
 */
export const actorKindSchema = z.enum(['human', 'agent', 'service', 'anonymous']);
export type ActorKind = z.infer<typeof actorKindSchema>;

export const actorRefSchema = z.object({
  id: uuidSchema,
  type: actorKindSchema,
  /** Agent character name (`forge`, `atlas`, ...) when `type === 'agent'`. */
  character: z.string().min(1).max(64).optional(),
  /** Set when a service or agent acts for a human. */
  onBehalfOf: uuidSchema.optional(),
});
export type ActorRef = z.infer<typeof actorRefSchema>;

/** Cross-entity reference; `type` is the dataset key from the PAP-161 registry. */
export const entityRefSchema = z.object({
  type: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'entity type is lower_snake_case'),
  id: uuidSchema,
});
export type EntityRef = z.infer<typeof entityRefSchema>;

/** `entity:<type>:<id>`, the same grammar as the PAP-131 comment anchor. */
export function formatEntityKey(ref: EntityRef): string {
  return `entity:${ref.type}:${ref.id}`;
}

export const SYSTEM_ACTOR_ID = '00000000-0000-7000-8000-000000000000';

/** The actor a background job or migration publishes as. */
export const SYSTEM_ACTOR: ActorRef = Object.freeze({ id: SYSTEM_ACTOR_ID, type: 'service' });

const HEX: readonly string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0'),
);

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } })
    .crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i += 1) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/**
 * UUIDv7: 48-bit big-endian Unix milliseconds, version 7, variant 10, 74 random bits.
 * Sorts by creation time, which is why every PaperOS id is one (Contracts section 1).
 * Matches `uuid_generate_v7()` from the PAP-32 migration 0000.
 */
export function uuidv7(now: number = Date.now()): Uuid {
  const bytes = randomBytes(16);
  const ms = Math.max(0, Math.floor(now));
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const h = (i: number): string => HEX[bytes[i] ?? 0] ?? '00';
  return (
    `${h(0)}${h(1)}${h(2)}${h(3)}-${h(4)}${h(5)}-${h(6)}${h(7)}-${h(8)}${h(9)}-` +
    `${h(10)}${h(11)}${h(12)}${h(13)}${h(14)}${h(15)}`
  );
}
