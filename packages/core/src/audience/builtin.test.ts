import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { audienceSchema } from './audience.js';
import { BUILTIN_AUDIENCE_IDS, BUILTIN_AUDIENCES, isBuiltinAudienceId } from './builtin.js';
import { matches } from './matches.js';
import { type Principal, principalSchema } from './principal.js';
import { BUILTIN_REGISTRY, createAudienceRegistry } from './registry.js';

const fixturesDir = new URL('./fixtures/', import.meta.url);
const goldenPath = new URL('./fixtures/golden/matching.json', import.meta.url);
const readJson = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));

describe('BUILTIN_AUDIENCES', () => {
  it('has the fifteen ids the spec names, in order', () => {
    expect(Object.keys(BUILTIN_AUDIENCES)).toEqual([...BUILTIN_AUDIENCE_IDS]);
    expect(BUILTIN_AUDIENCE_IDS).toHaveLength(15);
    expect(isBuiltinAudienceId('customer-pro')).toBe(true);
    expect(isBuiltinAudienceId('vip')).toBe(false);
    expect(isBuiltinAudienceId('constructor')).toBe(false);
  });

  it.each(BUILTIN_AUDIENCE_IDS)('%s validates and its examples match and do not match', (id) => {
    const a = BUILTIN_AUDIENCES[id];
    expect(a.id).toBe(id);
    expect(
      audienceSchema.safeParse({
        id: a.id,
        name: a.name,
        description: a.description,
        match: a.match,
      }).success,
    ).toBe(true);
    expect(principalSchema.safeParse(a.examples.matching).success).toBe(true);
    expect(matches(a.examples.matching, a.match)).toBe(true);
    if (id === 'everyone') {
      expect(a.examples.nonMatching).toBeNull();
    } else {
      expect(a.examples.nonMatching).not.toBeNull();
      expect(matches(a.examples.nonMatching as Principal, a.match)).toBe(false);
    }
  });

  it('anonymous ignores tenantId', () => {
    const anon = {
      id: 'anonymous',
      type: 'anonymous' as const,
      tenantId: 'tenant-x',
      attributes: {},
    };
    expect(matches(anon, BUILTIN_AUDIENCES.anonymous.match)).toBe(true);
    expect(matches(anon, BUILTIN_AUDIENCES.authenticated.match)).toBe(false);
  });

  it('owners are admins, admins are not owners', () => {
    const owner = BUILTIN_AUDIENCES.owner.examples.matching;
    const admin = BUILTIN_AUDIENCES.admin.examples.matching;
    expect(BUILTIN_REGISTRY.matching(owner)).toContain('admin');
    expect(BUILTIN_REGISTRY.matching(admin)).not.toContain('owner');
  });
});

describe('golden: fixture principals against the built-ins and the fixture app spec', () => {
  it('matches the committed golden (set UPDATE_GOLDENS=1 to rewrite)', () => {
    const declared = readJson(new URL('app-spec.audiences.json', fixturesDir)).audiences;
    const withAppSpec = createAudienceRegistry(declared);
    const actual: Record<'builtin' | 'withAppSpec', Record<string, string[]>> = {
      builtin: {},
      withAppSpec: {},
    };
    for (const file of readdirSync(new URL('principals/', fixturesDir)).sort()) {
      const principal = principalSchema.parse(readJson(new URL(`principals/${file}`, fixturesDir)));
      actual.builtin[file] = BUILTIN_REGISTRY.matching(principal);
      actual.withAppSpec[file] = withAppSpec.matching(principal);
    }
    if (process.env.UPDATE_GOLDENS)
      writeFileSync(goldenPath, `${JSON.stringify(actual, null, 2)}\n`);
    expect(actual).toEqual(readJson(goldenPath));
  });

  it('worked example 1: a customer who is also a partner', () => {
    const p = principalSchema.parse(
      readJson(new URL('principals/customer-partner.json', fixturesDir)),
    );
    expect(BUILTIN_REGISTRY.matching(p)).toEqual([
      'everyone',
      'authenticated',
      'customer',
      'customer-pro',
      'partner',
    ]);
  });

  it('worked example 2: an agent acting for a staff member is an agent, not staff', () => {
    const p = principalSchema.parse(
      readJson(new URL('principals/agent-acting-for-staff.json', fixturesDir)),
    );
    expect(BUILTIN_REGISTRY.matching(p)).toEqual(['everyone', 'authenticated', 'agent']);
    expect(p.attributes.actingFor).toBe('0192a1b2-0000-7000-8000-00000000a001');
  });
});
