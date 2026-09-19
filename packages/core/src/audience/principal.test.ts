import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_PRINCIPAL_ID,
  anonymousPrincipal,
  attributeValueSchema,
  PRINCIPAL_TYPES,
  principalSchema,
  WELL_KNOWN_ATTRIBUTES,
} from './principal.js';

describe('Principal', () => {
  it('lists the four types in contract order', () => {
    expect(PRINCIPAL_TYPES).toEqual(['human', 'agent', 'service', 'anonymous']);
  });

  it('parses a valid principal and rejects unknown keys', () => {
    const p = {
      id: '0192a1b2-0000-7000-8000-00000000c001',
      type: 'human',
      tenantId: null,
      attributes: { tier: 'pro', seats: 3, mfa: true, tags: ['a', 'b'] },
    };
    expect(principalSchema.parse(p)).toEqual(p);
    expect(principalSchema.safeParse({ ...p, extra: 1 }).success).toBe(false);
    expect(principalSchema.safeParse({ ...p, type: 'robot' }).success).toBe(false);
    expect(principalSchema.safeParse({ ...p, id: '' }).success).toBe(false);
    expect(principalSchema.safeParse({ ...p, tenantId: undefined }).success).toBe(false);
  });

  it('attribute values are string, number, boolean or string[]', () => {
    for (const ok of ['x', 1, true, ['a']])
      expect(attributeValueSchema.safeParse(ok).success).toBe(true);
    for (const bad of [null, {}, [1], [true], undefined]) {
      expect(attributeValueSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('anonymousPrincipal has the shared id and ignores tenant by default', () => {
    expect(anonymousPrincipal()).toEqual({
      id: ANONYMOUS_PRINCIPAL_ID,
      type: 'anonymous',
      tenantId: null,
      attributes: {},
    });
    expect(anonymousPrincipal('t1').tenantId).toBe('t1');
  });

  it('well-known attribute names map to themselves', () => {
    for (const [k, v] of Object.entries(WELL_KNOWN_ATTRIBUTES)) expect(k).toBe(v);
  });
});
