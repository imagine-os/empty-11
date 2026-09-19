import { describe, expect, it } from 'vitest';
import {
  normalizeSegment,
  referencedAudiences,
  SEGMENT_MAX_DEPTH,
  type Segment,
  seg,
  segmentDepth,
  segmentNodeSchema,
  segmentSchema,
} from './segment.js';

const nest = (n: number, leaf: Segment = { role: 'owner' }): Segment =>
  n <= 0 ? leaf : { not: nest(n - 1, leaf) };

describe('segment schema', () => {
  it('accepts every node kind', () => {
    const s: Segment = {
      any: [
        { all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'support' }] },
        { role: 'admin' },
        { principalType: 'agent' },
        { tier: 'pro' },
        { not: { attr: 'mfa', op: 'exists', value: false } },
        { attr: 'seats', op: 'gte', value: 5 },
        { attr: 'seats', op: 'lte', value: '9' },
        { attr: 'region', op: 'in', value: ['eu', 1, true] },
        { attr: 'tier', op: 'neq', value: 'free' },
      ],
    };
    expect(segmentSchema.parse(s)).toEqual(s);
  });

  it.each<[string, unknown]>([
    ['eq without value', { attr: 'a', op: 'eq' }],
    ['eq with array value', { attr: 'a', op: 'eq', value: ['x'] }],
    ['neq with array value', { attr: 'a', op: 'neq', value: [1] }],
    ['in with scalar value', { attr: 'a', op: 'in', value: 'x' }],
    ['gte with boolean value', { attr: 'a', op: 'gte', value: true }],
    ['lte without value', { attr: 'a', op: 'lte' }],
    ['exists with string value', { attr: 'a', op: 'exists', value: 'yes' }],
    ['unknown op', { attr: 'a', op: 'like', value: 'x' }],
    ['empty attr', { attr: '', op: 'exists' }],
    ['two keys', { all: [], any: [] }],
    ['unknown key', { everyone: true }],
    ['bad role', { role: 'god' }],
    ['bad principal type', { principalType: 'robot' }],
    ['bad audience id', { audience: 'Not Valid' }],
    ['empty tier', { tier: '' }],
    ['null', null],
  ])('rejects %s', (_name, bad) => {
    expect(segmentSchema.safeParse(bad).success).toBe(false);
  });

  it(`limits depth to ${SEGMENT_MAX_DEPTH} at the top level only`, () => {
    expect(segmentSchema.safeParse(nest(SEGMENT_MAX_DEPTH - 1)).success).toBe(true);
    const tooDeep = segmentSchema.safeParse(nest(SEGMENT_MAX_DEPTH));
    expect(tooDeep.success).toBe(false);
    if (!tooDeep.success) expect(tooDeep.error.issues[0]?.message).toContain('deeper than 6');
    expect(segmentNodeSchema.safeParse(nest(SEGMENT_MAX_DEPTH)).success).toBe(true);
  });
});

describe('segmentDepth', () => {
  it('counts a leaf as 1 and nesting per level', () => {
    expect(segmentDepth({ role: 'owner' })).toBe(1);
    expect(segmentDepth({ all: [] })).toBe(1);
    expect(segmentDepth({ not: { role: 'owner' } })).toBe(2);
    expect(segmentDepth({ all: [{ role: 'owner' }, { any: [{ not: { tier: 'pro' } }] }] })).toBe(4);
    expect(segmentDepth(nest(6))).toBe(7);
  });
});

describe('normalizeSegment', () => {
  it('expands role and tier shorthands and leaves the rest alone', () => {
    expect(
      normalizeSegment({
        any: [
          { role: 'admin' },
          { all: [{ tier: 'pro' }, { not: { audience: 'x' } }, { principalType: 'human' }] },
        ],
      }),
    ).toEqual({
      any: [
        { attr: 'role', op: 'eq', value: 'admin' },
        {
          all: [
            { attr: 'tier', op: 'eq', value: 'pro' },
            { not: { audience: 'x' } },
            { principalType: 'human' },
          ],
        },
      ],
    });
    const leaf: Segment = { attr: 'a', op: 'exists' };
    expect(normalizeSegment(leaf)).toBe(leaf);
  });
});

describe('referencedAudiences', () => {
  it('collects distinct ids depth-first', () => {
    expect(
      referencedAudiences({
        all: [
          { audience: 'a' },
          { any: [{ audience: 'b' }, { not: { audience: 'a' } }] },
          { role: 'owner' },
        ],
      }),
    ).toEqual(['a', 'b']);
    expect(referencedAudiences({ tier: 'pro' })).toEqual([]);
  });
});

describe('seg builders', () => {
  it('build the same trees as the literals', () => {
    expect(seg.all(seg.role('owner'), seg.not(seg.tier('pro')))).toEqual({
      all: [{ role: 'owner' }, { not: { tier: 'pro' } }],
    });
    expect(seg.any(seg.principalType('agent'), seg.audience('staff'))).toEqual({
      any: [{ principalType: 'agent' }, { audience: 'staff' }],
    });
    expect(seg.attr('mfa', 'exists')).toEqual({ attr: 'mfa', op: 'exists' });
    expect(seg.attr('seats', 'gte', 5)).toEqual({ attr: 'seats', op: 'gte', value: 5 });
    expect(seg.everyone()).toEqual({ all: [] });
    expect(seg.nobody()).toEqual({ any: [] });
  });
});
