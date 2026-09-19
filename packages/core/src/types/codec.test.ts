import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode, utf8Decode, utf8Encode } from './codec.js';
import { ValidationError } from './error.js';

describe('base64url', () => {
  it.each([
    ['', ''],
    ['f', 'Zg'],
    ['fo', 'Zm8'],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg'],
    ['fooba', 'Zm9vYmE'],
    ['foobar', 'Zm9vYmFy'],
  ])('encodes %j without padding', (plain, encoded) => {
    expect(base64UrlEncode(utf8Encode(plain))).toBe(encoded);
    expect(utf8Decode(base64UrlDecode(encoded))).toBe(plain);
  });

  it('uses the URL-safe alphabet', () => {
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
  });

  it('round-trips arbitrary bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 200 }), (bytes) => {
        expect([...base64UrlDecode(base64UrlEncode(bytes))]).toEqual([...bytes]);
      }),
    );
  });

  it('rejects an impossible length and a character outside the alphabet', () => {
    expect(() => base64UrlDecode('Zm9vYg')).not.toThrow();
    expect(() => base64UrlDecode('Z')).toThrow(ValidationError);
    expect(() => base64UrlDecode('Zm9v*g')).toThrow(ValidationError);
  });
});

describe('utf8', () => {
  it('round-trips text outside the BMP', () => {
    expect(utf8Decode(utf8Encode('árbol 🧾'))).toBe('árbol 🧾');
  });

  it('rejects bytes that are not UTF-8', () => {
    expect(() => utf8Decode(new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow(ValidationError);
  });
});
