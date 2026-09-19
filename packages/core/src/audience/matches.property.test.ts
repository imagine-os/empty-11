import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILTIN_AUDIENCE_IDS } from './builtin.js';
import { matches } from './matches.js';
import { PRINCIPAL_TYPES, type Principal } from './principal.js';
import { TENANT_ROLES } from './role.js';
import type { Segment } from './segment.js';

const scalar = fc.oneof(
  fc.constantFrom('free', 'pro', 'enterprise', 'support', 'finance', 'eu', 'uk', 'forge'),
  fc.integer({ min: -3, max: 12 }),
  fc.boolean(),
);
const attrValue = fc.oneof(
  scalar,
  fc.array(fc.constantFrom('eu', 'uk', 'beta', 'forge'), { maxLength: 3 }),
);
const attrName = fc.constantFrom(
  'role',
  'tier',
  'staffRole',
  'partnerId',
  'seats',
  'mfa',
  'tags',
  'character',
);

const principal: fc.Arbitrary<Principal> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom(...PRINCIPAL_TYPES),
  tenantId: fc.option(fc.uuid(), { nil: null }),
  attributes: fc.dictionary(attrName, attrValue, { maxKeys: 6 }),
});

const leaf: fc.Arbitrary<Segment> = fc.oneof(
  fc.record({ attr: attrName, op: fc.constantFrom('eq' as const, 'neq' as const), value: scalar }),
  fc.record({
    attr: attrName,
    op: fc.constant('in' as const),
    value: fc.array(scalar, { maxLength: 3 }),
  }),
  fc.record({
    attr: attrName,
    op: fc.constantFrom('gte' as const, 'lte' as const),
    value: fc.oneof(fc.integer({ min: -3, max: 12 }), fc.constantFrom('a', 'eu', 'zz')),
  }),
  fc.record({
    attr: attrName,
    op: fc.constant('exists' as const),
    value: fc.option(fc.boolean(), { nil: undefined }),
  }),
  fc.record({ role: fc.constantFrom(...TENANT_ROLES) }),
  fc.record({ principalType: fc.constantFrom(...PRINCIPAL_TYPES) }),
  fc.record({ tier: fc.constantFrom('free', 'pro', 'enterprise') }),
  fc.record({ audience: fc.constantFrom(...BUILTIN_AUDIENCE_IDS) }),
);

const { segment } = fc.letrec<{ segment: Segment }>((tie) => ({
  segment: fc.oneof(
    { maxDepth: 4, withCrossShrink: true },
    leaf,
    fc.record({ all: fc.array(tie('segment'), { maxLength: 3 }) }),
    fc.record({ any: fc.array(tie('segment'), { maxLength: 3 }) }),
    fc.record({ not: tie('segment') }),
  ),
}));

/** 10 000-run properties take a few seconds; under Turbo every package's tests share the CPU. */
const SLOW = { timeout: 60_000 };

describe('matches: algebraic laws (fast-check)', () => {
  it('not(not(x)) equals x over 10 000 random principals and segments', SLOW, () => {
    fc.assert(
      fc.property(principal, segment, (p, s) => {
        expect(matches(p, { not: { not: s } })).toBe(matches(p, s));
      }),
      { numRuns: 10_000 },
    );
  });

  it('all([]) matches everyone and any([]) matches no one', SLOW, () => {
    fc.assert(
      fc.property(principal, (p) => {
        expect(matches(p, { all: [] })).toBe(true);
        expect(matches(p, { any: [] })).toBe(false);
      }),
      { numRuns: 2_000 },
    );
  });

  it('de Morgan: not(all(xs)) equals any(not x) and not(any(xs)) equals all(not x)', SLOW, () => {
    fc.assert(
      fc.property(principal, fc.array(segment, { maxLength: 4 }), (p, xs) => {
        const negated = xs.map((x): Segment => ({ not: x }));
        expect(matches(p, { not: { all: xs } })).toBe(matches(p, { any: negated }));
        expect(matches(p, { not: { any: xs } })).toBe(matches(p, { all: negated }));
      }),
      { numRuns: 10_000 },
    );
  });

  it('all and any are commutative and idempotent', SLOW, () => {
    fc.assert(
      fc.property(principal, segment, segment, (p, a, b) => {
        expect(matches(p, { all: [a, b] })).toBe(matches(p, { all: [b, a] }));
        expect(matches(p, { any: [a, b] })).toBe(matches(p, { any: [b, a] }));
        expect(matches(p, { all: [a, a] })).toBe(matches(p, a));
        expect(matches(p, { any: [a, a] })).toBe(matches(p, a));
      }),
      { numRuns: 2_000 },
    );
  });

  it('never throws on attribute lookups, whatever the attributes hold', SLOW, () => {
    fc.assert(
      fc.property(principal, segment, (p, s) => {
        expect(typeof matches(p, s)).toBe('boolean');
      }),
      { numRuns: 2_000 },
    );
  });
});
