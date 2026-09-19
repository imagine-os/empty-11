/**
 * Signed keyset cursors.
 *
 * A list response hands the client `nextCursor`. The cursor carries the sort
 * values and the id of the last row so the next page is a keyset predicate
 * (`(created_at, id) < (:t, :id)`) rather than an `OFFSET`, which degrades and
 * skips rows under concurrent writes.
 *
 * The cursor is signed because it is a WHERE clause the client hands back: an
 * unsigned cursor lets a caller page past a permission boundary or feed the
 * query planner values the router never produced. It is **signed, not
 * encrypted** — sort values are visible, which is fine, and must therefore
 * never be secret. `verifyCursor` rejects a tampered cursor with `VALIDATION`.
 *
 * The secret is `CURSOR_SECRET` (PAP-17). It is read **at the call site and
 * never at import**, so that importing `@paperos/core/types` in a browser
 * bundle, a test or a codegen script cannot fail on a missing variable; pass a
 * {@link CursorSecrets} explicitly and the environment is not touched at all.
 *
 * Rotation: set `CURSOR_SECRET_PREVIOUS` to the old value when you rotate.
 * `verifyCursor` accepts either, `signCursor` only ever uses the new one, and
 * the old value is removed after 24 hours — longer than any page-through — or
 * earlier by passing `previousUntil`.
 */

import { z } from 'zod';
import { base64UrlDecode, base64UrlEncode, utf8Decode, utf8Encode } from './codec.js';
import { ApiError, ValidationError } from './error.js';
import { type Uuid, uuidSchema } from './ids.js';
import { hmacSha256, timingSafeEqual } from './sha256.js';

/** Environment variable holding the active signing secret (PAP-17). */
export const CURSOR_SECRET_ENV = 'CURSOR_SECRET';
/** Environment variable holding the previous secret during a rotation. */
export const CURSOR_SECRET_PREVIOUS_ENV = 'CURSOR_SECRET_PREVIOUS';

/** Bytes of HMAC-SHA-256 kept. 128 bits of tag is the usual truncation floor. */
export const CURSOR_SIGNATURE_BYTES = 16;

/** A keyset sort value. Dates and bigints are encoded by the caller as strings. */
export type CursorValue = string | number | boolean | null;

export interface CursorPayload {
  /** One value per `ORDER BY` column, in order, from the last row of the page. */
  sort: readonly CursorValue[];
  /** The last row's id, the tie-breaker every PaperOS sort ends with. */
  id: Uuid;
}

export interface CursorSecrets {
  current: string;
  /** Accepted by `verifyCursor` only; never used to sign. */
  previous?: string | undefined;
  /** When the previous secret stops being accepted. Default: while it is set. */
  previousUntil?: Date | undefined;
}

const cursorValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

/** Wire schema for the decoded payload. */
export const cursorPayloadSchema = z.object({ sort: z.array(cursorValueSchema), id: uuidSchema });

const wireSchema = z.object({ s: z.array(cursorValueSchema), i: uuidSchema });

function globalEnv(): Record<string, string | undefined> {
  const host = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return host.process?.env ?? {};
}

/**
 * Read {@link CursorSecrets} from the environment. Called only when no secrets
 * argument was passed, and only inside `signCursor` / `verifyCursor`.
 */
export function readCursorSecretsFromEnv(
  env: Record<string, string | undefined> = globalEnv(),
): CursorSecrets {
  const current = env[CURSOR_SECRET_ENV];
  if (current === undefined || current === '') {
    throw new ApiError(
      'INTERNAL',
      `${CURSOR_SECRET_ENV} is not set; set it (PAP-17) or pass CursorSecrets to signCursor/verifyCursor`,
    );
  }
  const previous = env[CURSOR_SECRET_PREVIOUS_ENV];
  return previous === undefined || previous === '' ? { current } : { current, previous };
}

function resolve(secrets: CursorSecrets | undefined): CursorSecrets {
  if (secrets === undefined) return readCursorSecretsFromEnv();
  if (secrets.current === '') throw new ApiError('INTERNAL', 'CursorSecrets.current is empty');
  return secrets;
}

function tag(secret: string, body: Uint8Array): Uint8Array {
  return hmacSha256(utf8Encode(secret), body).subarray(0, CURSOR_SIGNATURE_BYTES);
}

/**
 * Sign a keyset position. The result is
 * `base64url(payload) + '.' + base64url(tag)` — URL and cookie safe, no
 * padding, stable across runtimes.
 */
export function signCursor(payload: CursorPayload, secrets?: CursorSecrets): string {
  const { current } = resolve(secrets);
  const parsed = cursorPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('not a cursor payload', {
      details: parsed.error.issues.map((issue) => ({
        path: [...issue.path] as (string | number)[],
        issue: issue.message,
      })),
    });
  }
  const body = utf8Encode(JSON.stringify({ s: parsed.data.sort, i: parsed.data.id }));
  return `${base64UrlEncode(body)}.${base64UrlEncode(tag(current, body))}`;
}

/**
 * Check a cursor and return its payload. Throws `VALIDATION` for a malformed,
 * truncated, re-encoded or tampered cursor — the caller maps that to a 400, it
 * is never a 500.
 */
export function verifyCursor(
  cursor: string,
  secrets?: CursorSecrets,
  now: Date = new Date(),
): CursorPayload {
  const resolved = resolve(secrets);
  const separator = cursor.indexOf('.');
  if (separator === -1 || cursor.indexOf('.', separator + 1) !== -1) {
    throw new ValidationError('malformed cursor');
  }
  const body = base64UrlDecode(cursor.slice(0, separator));
  const signature = base64UrlDecode(cursor.slice(separator + 1));
  if (signature.length !== CURSOR_SIGNATURE_BYTES) throw new ValidationError('malformed cursor');

  const previousUsable =
    resolved.previous !== undefined &&
    (resolved.previousUntil === undefined || now.getTime() <= resolved.previousUntil.getTime());
  const accepted =
    timingSafeEqual(signature, tag(resolved.current, body)) ||
    (previousUsable && timingSafeEqual(signature, tag(resolved.previous as string, body)));
  if (!accepted) throw new ValidationError('cursor signature does not verify');

  let decoded: unknown;
  try {
    decoded = JSON.parse(utf8Decode(body));
  } catch {
    throw new ValidationError('malformed cursor');
  }
  const parsed = wireSchema.safeParse(decoded);
  if (!parsed.success) throw new ValidationError('malformed cursor');
  return { sort: parsed.data.s, id: parsed.data.i };
}
