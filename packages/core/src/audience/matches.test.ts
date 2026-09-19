import { describe, expect, it } from 'vitest';
import { AudienceCycleError, UnknownAudienceError } from './errors.js';
import { type AudienceResolver, matches } from './matches.js';
import type { Principal } from './principal.js';
import type { Segment } from './segment.js';

const human: Principal = {
  id: 'h1',
  type: 'human',
  tenantId: 't1',
  attributes: {
    role: 'staff',
    tier: 'pro',
    staffRole: 'support',
    seats: 5,
    since: '2026-01-01',
    mfa: true,
    tags: ['eu', 'beta'],
    empty: [],
  },
};
const bare: Principal = { id: 'h2', type: 'human', tenantId: 't1', attributes: {} };

const m = (s: Segment, p: Principal = human) => matches(p, s);

describe('matches: combinators', () => {
  it('all is a conjunction; the empty all matches everyone', () => {
    expect(m({ all: [] })).toBe(true);
    expect(m({ all: [] }, bare)).toBe(true);
    expect(m({ all: [{ tier: 'pro' }, { role: 'staff' }] })).toBe(true);
    expect(m({ all: [{ tier: 'pro' }, { role: 'owner' }] })).toBe(false);
    expect(m({ all: [{ role: 'owner' }, { tier: 'pro' }] })).toBe(false);
  });

  it('any is a disjunction; the empty any matches no one', () => {
    expect(m({ any: [] })).toBe(false);
    expect(m({ any: [{ role: 'owner' }, { tier: 'pro' }] })).toBe(true);
    expect(m({ any: [{ tier: 'pro' }, { role: 'owner' }] })).toBe(true);
    expect(m({ any: [{ role: 'owner' }, { tier: 'free' }] })).toBe(false);
  });

  it('not negates', () => {
    expect(m({ not: { role: 'owner' } })).toBe(true);
    expect(m({ not: { tier: 'pro' } })).toBe(false);
  });
});

describe('matches: shorthand leaves', () => {
  it('principalType reads principal.type', () => {
    expect(m({ principalType: 'human' })).toBe(true);
    expect(m({ principalType: 'agent' })).toBe(false);
    expect(m({ principalType: 'anonymous' }, { ...bare, type: 'anonymous', tenantId: null })).toBe(
      true,
    );
  });

  it('role and tier read the attributes and are false when missing', () => {
    expect(m({ role: 'staff' })).toBe(true);
    expect(m({ role: 'admin' })).toBe(false);
    expect(m({ role: 'staff' }, bare)).toBe(false);
    expect(m({ tier: 'pro' })).toBe(true);
    expect(m({ tier: 'pro' }, bare)).toBe(false);
  });
});

describe('matches: attribute operators', () => {
  it('eq compares scalars and matches any element of an array attribute', () => {
    expect(m({ attr: 'tier', op: 'eq', value: 'pro' })).toBe(true);
    expect(m({ attr: 'tier', op: 'eq', value: 'free' })).toBe(false);
    expect(m({ attr: 'seats', op: 'eq', value: 5 })).toBe(true);
    expect(m({ attr: 'seats', op: 'eq', value: '5' })).toBe(false);
    expect(m({ attr: 'mfa', op: 'eq', value: true })).toBe(true);
    expect(m({ attr: 'tags', op: 'eq', value: 'beta' })).toBe(true);
    expect(m({ attr: 'tags', op: 'eq', value: 'gamma' })).toBe(false);
    expect(m({ attr: 'empty', op: 'eq', value: 'x' })).toBe(false);
  });

  it('eq with a missing, array or absent expected value is false, never a throw', () => {
    expect(m({ attr: 'tier', op: 'eq', value: ['pro'] })).toBe(false);
    expect(m({ attr: 'tier', op: 'eq' })).toBe(false);
    expect(m({ attr: 'nope', op: 'eq', value: 'x' })).toBe(false);
    expect(m({ attr: 'nope', op: 'eq', value: 'x' }, bare)).toBe(false);
  });

  it('neq is true only when the attribute is present and differs', () => {
    expect(m({ attr: 'tier', op: 'neq', value: 'free' })).toBe(true);
    expect(m({ attr: 'tier', op: 'neq', value: 'pro' })).toBe(false);
    expect(m({ attr: 'tags', op: 'neq', value: 'gamma' })).toBe(true);
    expect(m({ attr: 'tags', op: 'neq', value: 'beta' })).toBe(false);
    expect(m({ attr: 'nope', op: 'neq', value: 'x' })).toBe(false);
  });

  it('in lists scalars and intersects arrays', () => {
    expect(m({ attr: 'tier', op: 'in', value: ['free', 'pro'] })).toBe(true);
    expect(m({ attr: 'tier', op: 'in', value: ['free', 'enterprise'] })).toBe(false);
    expect(m({ attr: 'seats', op: 'in', value: [1, 5] })).toBe(true);
    expect(m({ attr: 'mfa', op: 'in', value: [true] })).toBe(true);
    expect(m({ attr: 'tags', op: 'in', value: ['uk', 'eu'] })).toBe(true);
    expect(m({ attr: 'tags', op: 'in', value: ['uk'] })).toBe(false);
    expect(m({ attr: 'tier', op: 'in', value: 'pro' })).toBe(false);
    expect(m({ attr: 'tier', op: 'in' })).toBe(false);
    expect(m({ attr: 'nope', op: 'in', value: ['x'] })).toBe(false);
  });

  it('gte and lte compare numbers with numbers and strings with strings', () => {
    expect(m({ attr: 'seats', op: 'gte', value: 5 })).toBe(true);
    expect(m({ attr: 'seats', op: 'gte', value: 6 })).toBe(false);
    expect(m({ attr: 'seats', op: 'lte', value: 5 })).toBe(true);
    expect(m({ attr: 'seats', op: 'lte', value: 4 })).toBe(false);
    expect(m({ attr: 'since', op: 'gte', value: '2025-12-31' })).toBe(true);
    expect(m({ attr: 'since', op: 'lte', value: '2025-12-31' })).toBe(false);
    expect(m({ attr: 'seats', op: 'gte', value: '5' })).toBe(false);
    expect(m({ attr: 'since', op: 'gte', value: 5 })).toBe(false);
    expect(m({ attr: 'mfa', op: 'gte', value: true })).toBe(false);
    expect(m({ attr: 'seats', op: 'gte', value: [5] })).toBe(false);
    expect(m({ attr: 'seats', op: 'gte' })).toBe(false);
    expect(m({ attr: 'nope', op: 'gte', value: 1 })).toBe(false);
    expect(m({ attr: 'nope', op: 'lte', value: 1 })).toBe(false);
  });

  it('gte and lte on array attributes match when any element does', () => {
    expect(m({ attr: 'tags', op: 'gte', value: 'eu' })).toBe(true);
    expect(m({ attr: 'tags', op: 'lte', value: 'a' })).toBe(false);
    expect(m({ attr: 'tags', op: 'gte', value: 1 })).toBe(false);
  });

  it('exists checks presence; value false inverts', () => {
    expect(m({ attr: 'mfa', op: 'exists' })).toBe(true);
    expect(m({ attr: 'mfa', op: 'exists', value: true })).toBe(true);
    expect(m({ attr: 'mfa', op: 'exists', value: false })).toBe(false);
    expect(m({ attr: 'nope', op: 'exists' })).toBe(false);
    expect(m({ attr: 'nope', op: 'exists', value: false })).toBe(true);
    expect(m({ attr: 'empty', op: 'exists' })).toBe(true);
  });

  it('never reads prototype properties as attributes', () => {
    expect(m({ attr: 'constructor', op: 'exists' })).toBe(false);
    expect(m({ attr: 'toString', op: 'exists' }, bare)).toBe(false);
    expect(m({ attr: '__proto__', op: 'exists' })).toBe(false);
  });
});

describe('matches: audience references', () => {
  const resolver = (table: Record<string, Segment>): AudienceResolver => ({
    resolve: (id) => table[id],
  });

  it('resolves through the built-ins by default', () => {
    expect(m({ audience: 'staff' })).toBe(true);
    expect(m({ audience: 'staff-support' })).toBe(true);
    expect(m({ audience: 'owner' })).toBe(false);
  });

  it('resolves through a supplied resolver, including nested references', () => {
    const table = {
      a: { audience: 'b' },
      b: { all: [{ audience: 'c' }, { tier: 'pro' }] },
      c: { role: 'staff' },
    } satisfies Record<string, Segment>;
    expect(matches(human, { audience: 'a' }, { audiences: resolver(table) })).toBe(true);
    expect(matches(bare, { audience: 'a' }, { audiences: resolver(table) })).toBe(false);
  });

  it('throws UnknownAudienceError for an id the resolver does not know', () => {
    expect(() => m({ audience: 'nope' })).toThrow(UnknownAudienceError);
    expect(() => matches(human, { audience: 'x' }, { audiences: resolver({}) })).toThrow(
      /unknown audience "x"/,
    );
  });

  it('throws AudienceCycleError naming the cycle', () => {
    const table = {
      a: { audience: 'b' },
      b: { not: { audience: 'a' } },
      self: { audience: 'self' },
    };
    let err: unknown;
    try {
      matches(human, { audience: 'a' }, { audiences: resolver(table) });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AudienceCycleError);
    expect((err as AudienceCycleError).path).toEqual(['a', 'b', 'a']);
    expect(() => matches(human, { audience: 'self' }, { audiences: resolver(table) })).toThrow(
      'audience reference cycle: self -> self',
    );
  });

  it('does not report a cycle when the same audience is referenced twice as siblings', () => {
    const table = { a: { all: [{ audience: 'b' }, { audience: 'b' }] }, b: { tier: 'pro' } };
    expect(matches(human, { audience: 'a' }, { audiences: resolver(table) })).toBe(true);
  });
});

describe('matches: performance', () => {
  it('evaluates a depth-6 segment in well under 50 µs on average', () => {
    const deep: Segment = {
      all: [
        { any: [{ all: [{ any: [{ all: [{ not: { role: 'owner' } }, { tier: 'pro' }] }] }] }] },
        { audience: 'staff-support' },
        { attr: 'tags', op: 'in', value: ['uk', 'eu'] },
        { attr: 'seats', op: 'gte', value: 5 },
      ],
    };
    expect(m(deep)).toBe(true);
    const runs = 10_000;
    const start = performance.now();
    for (let i = 0; i < runs; i++) m(deep);
    const perCallMicros = ((performance.now() - start) * 1000) / runs;
    expect(perCallMicros).toBeLessThan(50);
  });
});
