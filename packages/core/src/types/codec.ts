/**
 * UTF-8 and base64url, dependency-free.
 *
 * `Buffer` is Node-only and `atob`/`btoa` are byte-oriented, so both are
 * avoided: cursors have to encode and decode identically in the browser, in a
 * worker, on the edge and in Node. Internal to this folder.
 */

import { ValidationError } from './error.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const REVERSE: Readonly<Record<string, number>> = Object.fromEntries(
  [...ALPHABET].map((character, index) => [character, index]),
);

/** Index into the 64-character alphabet; every caller masks to 6 bits first. */
const symbol = (index: number): string => ALPHABET[index] as string;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export function utf8Encode(text: string): Uint8Array {
  return encoder.encode(text);
}

export function utf8Decode(bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes);
  } catch {
    throw new ValidationError('not valid UTF-8');
  }
}

/** base64url without padding (RFC 4648 section 5). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += symbol(b0 >> 2);
    if (b1 === undefined) {
      out += symbol((b0 & 0x03) << 4);
      break;
    }
    out += symbol(((b0 & 0x03) << 4) | (b1 >> 4));
    if (b2 === undefined) {
      out += symbol((b1 & 0x0f) << 2);
      break;
    }
    out += symbol(((b1 & 0x0f) << 2) | (b2 >> 6));
    out += symbol(b2 & 0x3f);
  }
  return out;
}

/** Inverse of {@link base64UrlEncode}. Throws `VALIDATION` on any other input. */
export function base64UrlDecode(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new ValidationError('not valid base64url');
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let written = 0;
  let accumulator = 0;
  let bits = 0;
  for (const character of text) {
    const value = REVERSE[character];
    if (value === undefined) throw new ValidationError('not valid base64url');
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[written] = (accumulator >> bits) & 0xff;
      written += 1;
    }
  }
  return bytes.subarray(0, written);
}
