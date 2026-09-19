import { describe, expect, it } from 'vitest';
import { utf8Encode } from './codec.js';
import { hmacSha256, sha256, timingSafeEqual } from './sha256.js';

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const repeat = (byte: number, length: number): Uint8Array => new Uint8Array(length).fill(byte);

describe('sha256', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('matches the FIPS 180-4 vector for %j', (message, digest) => {
    expect(hex(sha256(utf8Encode(message)))).toBe(digest);
  });

  it('handles a message that pushes the length field into a new block', () => {
    // 56 bytes: the 0x80 pad byte plus the 8-byte length no longer fit in block 1.
    expect(hex(sha256(repeat(0x61, 56)))).toBe(
      'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a',
    );
  });
});

describe('hmacSha256', () => {
  it('matches RFC 4231 test case 1', () => {
    expect(hex(hmacSha256(repeat(0x0b, 20), utf8Encode('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
  });

  it('matches RFC 4231 test case 2', () => {
    expect(hex(hmacSha256(utf8Encode('Jefe'), utf8Encode('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('matches RFC 4231 test case 6, where the key is longer than the block', () => {
    const message = 'Test Using Larger Than Block-Size Key - Hash Key First';
    expect(hex(hmacSha256(repeat(0xaa, 131), utf8Encode(message)))).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    );
  });
});

describe('timingSafeEqual', () => {
  it('is true only for identical byte strings', () => {
    expect(timingSafeEqual(repeat(1, 16), repeat(1, 16))).toBe(true);
    expect(timingSafeEqual(repeat(1, 16), repeat(2, 16))).toBe(false);
    expect(timingSafeEqual(repeat(1, 16), repeat(1, 15))).toBe(false);
  });
});
