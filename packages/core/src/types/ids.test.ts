import { describe, expect, it } from 'vitest';
import { ValidationError } from './error.js';
import { isUuid, isUuidV7, NIL_UUID, toUuid, uuidSchema, uuidv7, uuidv7Timestamp } from './ids.js';

describe('uuidv7', () => {
  it('produces a canonical version 7 uuid', () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(isUuidV7(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19] as string);
  });

  it('encodes the creation time in the high bits', () => {
    const at = Date.parse('2026-09-19T12:00:00.000Z');
    expect(uuidv7Timestamp(uuidv7(at)).getTime()).toBe(at);
  });

  it('sorts lexicographically by creation order, even within one millisecond', () => {
    const ids = Array.from({ length: 500 }, () => uuidv7());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays monotonic when the clock steps backwards', () => {
    const first = uuidv7(Date.parse('2026-09-19T12:00:00.000Z'));
    const second = uuidv7(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(second > first).toBe(true);
  });
});

describe('uuid predicates', () => {
  it('accepts the lowercase canonical form only', () => {
    expect(isUuid('0192f0c1-2b3d-7c4e-8f90-abcdefabcdef')).toBe(true);
    expect(isUuid('0192F0C1-2B3D-7C4E-8F90-ABCDEFABCDEF')).toBe(false);
    expect(isUuid('nope')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });

  it('accepts the nil uuid as a uuid but not as a v7', () => {
    expect(isUuid(NIL_UUID)).toBe(true);
    expect(isUuidV7(NIL_UUID)).toBe(false);
  });

  it('throws VALIDATION rather than returning a bad id', () => {
    expect(toUuid('0192f0c1-2b3d-7c4e-8f90-abcdefabcdef')).toBe(
      '0192f0c1-2b3d-7c4e-8f90-abcdefabcdef',
    );
    expect(() => toUuid('nope')).toThrow(ValidationError);
    expect(() => uuidv7Timestamp(NIL_UUID)).toThrow(ValidationError);
  });

  it('parses through the schema', () => {
    expect(uuidSchema.parse(NIL_UUID)).toBe(NIL_UUID);
    expect(uuidSchema.safeParse('nope').success).toBe(false);
  });
});
