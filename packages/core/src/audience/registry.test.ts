import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AudienceDeclaration, AudienceDeclarations } from './audience.js';
import { BUILTIN_AUDIENCE_IDS } from './builtin.js';
import {
  AudienceValidationError,
  BUILTIN_REGISTRY,
  createAudienceRegistry,
  validateAudiences,
} from './registry.js';

const fixture = (name: string): AudienceDeclarations =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')).audiences;

const decl = (match: unknown, name = 'X'): AudienceDeclaration =>
  ({ name, description: 'test', match }) as AudienceDeclaration;

describe('validateAudiences', () => {
  it('accepts nothing declared and returns the built-ins', () => {
    for (const empty of [undefined, null, {}]) {
      const r = validateAudiences(empty);
      expect(r.ok).toBe(true);
      if (r.ok) expect(Object.keys(r.audiences)).toEqual([...BUILTIN_AUDIENCE_IDS]);
    }
  });

  it('accepts the fixture app.spec audiences section', () => {
    const r = validateAudiences(fixture('app-spec.audiences.json'));
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(Object.keys(r.audiences).slice(-4)).toEqual([
        'vip',
        'agent.forge',
        'eu-seats',
        'verified-without-mfa',
      ]);
  });

  it('rejects a non-object section', () => {
    const r = validateAudiences(['x']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.code).toBe('INVALID_SEGMENT');
  });

  it('names every issue kind with a code, the audience id and a path', () => {
    const r = validateAudiences({
      'Bad Id': decl({ all: [] }),
      admin: decl({ all: [] }),
      broken: decl({ attr: 'x', op: 'in', value: 'not-an-array' }),
      deep: decl({ not: { not: { not: { not: { not: { not: { role: 'owner' } } } } } } }),
      ghost: decl({ audience: 'does-not-exist' }),
      a: decl({ audience: 'b' }),
      b: decl({ any: [{ audience: 'a' }, { role: 'owner' }] }),
      fine: decl({ audience: 'a' }),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const byCode: Partial<Record<string, typeof r.issues>> = {};
    for (const issue of r.issues) byCode[issue.code] = [...(byCode[issue.code] ?? []), issue];
    expect(byCode.INVALID_ID?.map((i) => i.audienceId)).toEqual(['Bad Id']);
    expect(byCode.SHADOWS_BUILTIN?.map((i) => i.audienceId)).toEqual(['admin']);
    expect(byCode.INVALID_SEGMENT?.[0]).toMatchObject({
      audienceId: 'broken',
      path: ['match', 'value'],
    });
    expect(byCode.TOO_DEEP?.[0]).toMatchObject({ audienceId: 'deep', path: ['match'] });
    expect(byCode.UNKNOWN_REFERENCE?.[0]).toMatchObject({
      audienceId: 'ghost',
      message: 'references unknown audience "does-not-exist"',
    });
    expect(byCode.CYCLE).toHaveLength(1);
    expect(byCode.CYCLE?.[0]?.message).toBe('audience reference cycle: a -> b -> a');
  });

  it('finds the cycles in the cyclic fixture and a self-reference', () => {
    const r = validateAudiences(fixture('app-spec.audiences.cyclic.json'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.map((i) => i.code).sort()).toEqual([
        'CYCLE',
        'SHADOWS_BUILTIN',
        'UNKNOWN_REFERENCE',
      ]);
      expect(r.issues.find((i) => i.code === 'CYCLE')?.message).toBe(
        'audience reference cycle: gold -> platinum -> gold',
      );
    }
    const self = validateAudiences({ loop: decl({ not: { audience: 'loop' } }) });
    expect(self.ok).toBe(false);
    if (!self.ok)
      expect(self.issues[0]).toMatchObject({
        code: 'CYCLE',
        message: 'audience reference cycle: loop -> loop',
      });
  });

  it('reports each distinct cycle once', () => {
    const r = validateAudiences({
      a: decl({ audience: 'b' }),
      b: decl({ audience: 'c' }),
      c: decl({ audience: 'a' }),
      d: decl({ all: [{ audience: 'a' }, { audience: 'b' }] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.filter((i) => i.code === 'CYCLE')).toHaveLength(1);
  });
});

describe('createAudienceRegistry', () => {
  it('throws AudienceValidationError with the issues attached', () => {
    let err: unknown;
    try {
      createAudienceRegistry({ admin: decl({ all: [] }) });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AudienceValidationError);
    expect((err as AudienceValidationError).issues[0]?.code).toBe('SHADOWS_BUILTIN');
    expect((err as Error).message).toContain('admin');
  });

  it('exposes ids, get, has, resolve, matches, matching and describe', () => {
    const reg = createAudienceRegistry(fixture('app-spec.audiences.json'));
    expect(reg.ids.slice(0, BUILTIN_AUDIENCE_IDS.length)).toEqual([...BUILTIN_AUDIENCE_IDS]);
    expect(reg.has('vip')).toBe(true);
    expect(reg.has('nope')).toBe(false);
    expect(reg.get('vip')?.name).toBe('VIP customers');
    expect(reg.get('nope')).toBeUndefined();
    expect(reg.resolve('owner')).toEqual({ role: 'owner' });
    expect(reg.resolve('nope')).toBeUndefined();
    expect(reg.resolve('constructor')).toBeUndefined();

    const vip = {
      id: 'p',
      type: 'human' as const,
      tenantId: 't',
      attributes: { tier: 'enterprise', partnerId: 'x' },
    };
    expect(reg.matches(vip, 'vip')).toBe(true);
    expect(reg.matches(vip, { audience: 'vip' })).toBe(true);
    expect(reg.matches(vip, { role: 'owner' })).toBe(false);
    expect(reg.matching(vip)).toEqual([
      'everyone',
      'authenticated',
      'customer',
      'customer-enterprise',
      'partner',
      'vip',
    ]);
    expect(reg.describe('vip')).toBe('VIP customers');
    expect(reg.describe({ audience: 'vip' })).toBe('VIP customers');
    expect(reg.describe({ all: [{ audience: 'eu-seats' }, { role: 'owner' }] })).toBe(
      'EU accounts with five or more seats who are also owners',
    );
  });

  it('the built-in registry is the default resolver of matches', () => {
    expect(BUILTIN_REGISTRY.ids).toEqual([...BUILTIN_AUDIENCE_IDS]);
    expect(Object.isFrozen(BUILTIN_REGISTRY.ids)).toBe(true);
  });
});
