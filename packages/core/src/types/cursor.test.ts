import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { base64UrlDecode, base64UrlEncode, utf8Encode } from './codec.js';
import {
  CURSOR_SECRET_ENV,
  CURSOR_SECRET_PREVIOUS_ENV,
  CURSOR_SIGNATURE_BYTES,
  type CursorSecrets,
  readCursorSecretsFromEnv,
  signCursor,
  verifyCursor,
} from './cursor.js';
import { ApiError, ValidationError } from './error.js';
import { type Uuid, uuidv7 } from './ids.js';
import { hmacSha256 } from './sha256.js';

const secrets: CursorSecrets = { current: 'secret-one' };
const id = uuidv7();

/** Sign an arbitrary body the way `signCursor` does, to forge edge cases. */
function forge(body: string, secret: string): string {
  const bytes = utf8Encode(body);
  const tag = hmacSha256(utf8Encode(secret), bytes).subarray(0, CURSOR_SIGNATURE_BYTES);
  return `${base64UrlEncode(bytes)}.${base64UrlEncode(tag)}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('signCursor / verifyCursor', () => {
  it('round-trips a keyset position', () => {
    const payload = { sort: ['2026-09-19T00:00:00.000Z', 42, true, null], id };
    const cursor = signCursor(payload, secrets);
    expect(cursor).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(verifyCursor(cursor, secrets)).toEqual(payload);
  });

  it('is identity for any payload the router can build (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), {
          maxLength: 6,
        }),
        (sort) => {
          const payload = { sort, id };
          expect(verifyCursor(signCursor(payload, secrets), secrets)).toEqual(payload);
        },
      ),
    );
  });

  it('rejects a cursor with one byte flipped, anywhere (property)', () => {
    // Flipping a *byte* of the decoded payload or tag, not a base64 character:
    // the last base64url character of a string carries unused low bits, so two
    // spellings can decode to the same bytes and that is not tampering.
    const cursor = signCursor({ sort: ['a', 1, false, null], id }, secrets);
    const [bodyText, tagText] = cursor.split('.') as [string, string];
    const body = base64UrlDecode(bodyText);
    const tag = base64UrlDecode(tagText);
    fc.assert(
      fc.property(
        fc.nat({ max: body.length + tag.length - 1 }),
        fc.integer({ min: 1, max: 255 }),
        (index, delta) => {
          const flippedBody = Uint8Array.from(body);
          const flippedTag = Uint8Array.from(tag);
          const target = index < body.length ? flippedBody : flippedTag;
          const at = index < body.length ? index : index - body.length;
          target[at] = ((target[at] as number) + delta) & 0xff;
          const tampered = `${base64UrlEncode(flippedBody)}.${base64UrlEncode(flippedTag)}`;
          expect(() => verifyCursor(tampered, secrets)).toThrow(ValidationError);
        },
      ),
    );
  });

  it('rejects a payload the router could not have produced', () => {
    const notAnId = 'not-a-uuid' as unknown as Uuid;
    const thrown = (): unknown => signCursor({ sort: [], id: notAnId }, secrets);
    expect(thrown).toThrow(ValidationError);
    try {
      signCursor({ sort: [Number.NaN as number], id }, secrets);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ValidationError).details?.[0]?.path).toEqual(['sort', 0]);
    }
  });

  it.each([
    ['no separator', 'abcdef'],
    ['two separators', 'ab.cd.ef'],
    ['not base64url', 'a!b.cd'],
  ])('rejects a malformed cursor: %s', (_name, cursor) => {
    expect(() => verifyCursor(cursor, secrets)).toThrow(ValidationError);
  });

  it('rejects a signature of the wrong length', () => {
    const cursor = signCursor({ sort: [], id }, secrets);
    const [body] = cursor.split('.');
    expect(() =>
      verifyCursor(`${body as string}.${base64UrlEncode(new Uint8Array(8))}`, secrets),
    ).toThrow(/malformed cursor/);
  });

  it('rejects a correctly signed body that is not a cursor', () => {
    expect(() => verifyCursor(forge('not json at all', secrets.current), secrets)).toThrow(
      /malformed cursor/,
    );
    expect(() => verifyCursor(forge('{"s":1,"i":"x"}', secrets.current), secrets)).toThrow(
      /malformed cursor/,
    );
    expect(() => verifyCursor(forge(`{"s":[],"i":"nope"}`, secrets.current), secrets)).toThrow(
      /malformed cursor/,
    );
  });

  it('rejects a cursor signed with an unknown secret', () => {
    const cursor = signCursor({ sort: [], id }, { current: 'other' });
    expect(() => verifyCursor(cursor, secrets)).toThrow(/does not verify/);
  });
});

describe('secret rotation', () => {
  const rotated: CursorSecrets = { current: 'secret-two', previous: 'secret-one' };

  it('accepts a cursor signed with the previous secret', () => {
    const cursor = signCursor({ sort: [1], id }, secrets);
    expect(verifyCursor(cursor, rotated).sort).toEqual([1]);
  });

  it('signs only with the current secret', () => {
    expect(signCursor({ sort: [1], id }, rotated)).not.toBe(signCursor({ sort: [1], id }, secrets));
  });

  it('still rejects a cursor signed with neither secret', () => {
    const cursor = signCursor({ sort: [1], id }, { current: 'secret-three' });
    expect(() => verifyCursor(cursor, rotated)).toThrow(/does not verify/);
  });

  it('stops accepting the previous secret after previousUntil', () => {
    const cursor = signCursor({ sort: [1], id }, secrets);
    const until = new Date('2026-09-20T00:00:00.000Z');
    expect(
      verifyCursor(
        cursor,
        { ...rotated, previousUntil: until },
        new Date('2026-09-19T23:59:59.000Z'),
      ).sort,
    ).toEqual([1]);
    expect(() =>
      verifyCursor(
        cursor,
        { ...rotated, previousUntil: until },
        new Date('2026-09-20T00:00:01.000Z'),
      ),
    ).toThrow(/does not verify/);
  });
});

describe('secrets resolution', () => {
  it('reads the environment only when no secrets are passed', () => {
    vi.stubEnv(CURSOR_SECRET_ENV, 'from-env');
    const cursor = signCursor({ sort: ['x'], id });
    expect(verifyCursor(cursor).sort).toEqual(['x']);
  });

  it('carries the previous secret over from the environment', () => {
    const cursor = signCursor({ sort: [], id }, { current: 'old' });
    vi.stubEnv(CURSOR_SECRET_ENV, 'new');
    vi.stubEnv(CURSOR_SECRET_PREVIOUS_ENV, 'old');
    expect(readCursorSecretsFromEnv()).toEqual({ current: 'new', previous: 'old' });
    expect(verifyCursor(cursor)).toEqual({ sort: [], id });
  });

  it('treats an empty previous secret as unset', () => {
    expect(
      readCursorSecretsFromEnv({ [CURSOR_SECRET_ENV]: 'x', [CURSOR_SECRET_PREVIOUS_ENV]: '' }),
    ).toEqual({
      current: 'x',
    });
  });

  it('fails as INTERNAL, not VALIDATION, when the secret is missing', () => {
    expect(() => readCursorSecretsFromEnv({})).toThrow(ApiError);
    expect(() => readCursorSecretsFromEnv({ [CURSOR_SECRET_ENV]: '' })).toThrow(
      new RegExp(CURSOR_SECRET_ENV),
    );
    try {
      readCursorSecretsFromEnv({});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ApiError).code).toBe('INTERNAL');
    }
    expect(() => signCursor({ sort: [], id }, { current: '' })).toThrow(/current is empty/);
  });

  it('does not touch the environment at import time, and copes without one', () => {
    vi.stubGlobal('process', undefined);
    expect(() => readCursorSecretsFromEnv()).toThrow(ApiError);
    vi.stubGlobal('process', {});
    expect(() => readCursorSecretsFromEnv()).toThrow(ApiError);
  });
});
