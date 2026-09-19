import { describe, expect, it } from 'vitest';
import { isBuiltinAudienceId } from './builtin.js';
import {
  defaultAudienceForSurface,
  isAudienceAllowedOnSurface,
  SURFACE_AUDIENCES,
  SURFACES,
  surfaceSchema,
} from './surfaces.js';

describe('surface -> audience mapping', () => {
  it('covers every surface with a default that is itself allowed', () => {
    expect(Object.keys(SURFACE_AUDIENCES)).toEqual([...SURFACES]);
    for (const surface of SURFACES) {
      const entry = SURFACE_AUDIENCES[surface];
      expect(isBuiltinAudienceId(entry.defaultAudience)).toBe(true);
      expect(entry.allowed).toContain(entry.defaultAudience);
      for (const id of entry.allowed) expect(isBuiltinAudienceId(id)).toBe(true);
      expect(defaultAudienceForSurface(surface)).toBe(entry.defaultAudience);
    }
  });

  it('answers the obvious questions', () => {
    expect(defaultAudienceForSurface('website')).toBe('everyone');
    expect(defaultAudienceForSurface('admin')).toBe('admin');
    expect(defaultAudienceForSurface('agent')).toBe('agent');
    expect(isAudienceAllowedOnSurface('admin', 'owner')).toBe(true);
    expect(isAudienceAllowedOnSurface('admin', 'anonymous')).toBe(false);
    expect(surfaceSchema.safeParse('kiosk').success).toBe(false);
  });
});
