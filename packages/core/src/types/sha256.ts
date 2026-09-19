/**
 * SHA-256 and HMAC-SHA-256, in dependency-free TypeScript.
 *
 * `@paperos/core` is contract-zero: it runs in the browser, in a worker, on the
 * edge and in Node, so it cannot import `node:crypto`, and the Web Crypto
 * `subtle` API is async — which would make `signCursor` async for every caller.
 * This file is therefore a straight RFC 6234 / RFC 2104 implementation, pinned
 * by the RFC 4231 test vectors in `sha256.test.ts`.
 *
 * It is internal: nothing here is re-exported from the package barrel.
 */

/**
 * Read a word from a fixed-length array. Every call site is inside a loop whose
 * bounds are the array length, so the value is always present; the cast keeps
 * `noUncheckedIndexedAccess` out of the round functions.
 */
const w32 = (a: Uint32Array, i: number): number => a[i] as number;
const w8 = (a: Uint8Array, i: number): number => a[i] as number;

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const BLOCK_BYTES = 64;
/** Digest length in bytes. */
export const SHA256_BYTES = 32;

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** SHA-256 of `message`, 32 bytes. */
export function sha256(message: Uint8Array): Uint8Array {
  const blocks = Math.ceil((message.length + 9) / BLOCK_BYTES);
  const padded = new Uint8Array(blocks * BLOCK_BYTES);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setBigUint64(padded.length - 8, BigInt(message.length) * 8n);

  const h = Uint32Array.from(INITIAL);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const x = w32(w, i - 15);
      const y = w32(w, i - 2);
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w32(w, i - 16) + s0 + w32(w, i - 7) + s1) >>> 0;
    }

    let a = w32(h, 0);
    let b = w32(h, 1);
    let c = w32(h, 2);
    let d = w32(h, 3);
    let e = w32(h, 4);
    let f = w32(h, 5);
    let g = w32(h, 6);
    let hh = w32(h, 7);

    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + w32(K, i) + w32(w, i)) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] = (w32(h, 0) + a) >>> 0;
    h[1] = (w32(h, 1) + b) >>> 0;
    h[2] = (w32(h, 2) + c) >>> 0;
    h[3] = (w32(h, 3) + d) >>> 0;
    h[4] = (w32(h, 4) + e) >>> 0;
    h[5] = (w32(h, 5) + f) >>> 0;
    h[6] = (w32(h, 6) + g) >>> 0;
    h[7] = (w32(h, 7) + hh) >>> 0;
  }

  const digest = new Uint8Array(SHA256_BYTES);
  const out = new DataView(digest.buffer);
  for (let i = 0; i < 8; i += 1) out.setUint32(i * 4, w32(h, i));
  return digest;
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left);
  out.set(right, left.length);
  return out;
}

/** HMAC-SHA-256 (RFC 2104) of `message` under `key`, 32 bytes. */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const block = new Uint8Array(BLOCK_BYTES);
  block.set(key.length > BLOCK_BYTES ? sha256(key) : key);

  const inner = new Uint8Array(BLOCK_BYTES);
  const outer = new Uint8Array(BLOCK_BYTES);
  for (let i = 0; i < BLOCK_BYTES; i += 1) {
    const byte = w8(block, i);
    inner[i] = byte ^ 0x36;
    outer[i] = byte ^ 0x5c;
  }

  return sha256(concat(outer, sha256(concat(inner, message))));
}

/**
 * Compare two byte strings without leaking where they differ through timing.
 * Length is not secret and is compared first.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= w8(a, i) ^ w8(b, i);
  return diff === 0;
}
