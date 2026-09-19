import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_ID_PATTERN,
  audienceDeclarationSchema,
  audienceIdSchema,
  audienceSchema,
  deriveAudience,
  isAudienceId,
} from './audience.js';
import { BUILTIN_REGISTRY, createAudienceRegistry } from './registry.js';

describe('audience id grammar', () => {
  it.each([
    'anonymous',
    'customer-pro',
    'staff-support',
    'customer.pro',
    'staff.billing-ops',
    'agent.forge',
    'a1.b2-c3',
  ])('accepts %s', (id) => {
    expect(isAudienceId(id)).toBe(true);
    expect(audienceIdSchema.safeParse(id).success).toBe(true);
  });

  it.each([
    '',
    'Customer',
    'customer_pro',
    '-customer',
    'customer-',
    'customer..pro',
    '.agent',
    'agent.',
    '1st',
    'agent.Forge',
    'a b',
  ])('rejects %j', (id) => {
    expect(isAudienceId(id)).toBe(false);
    expect(audienceIdSchema.safeParse(id).success).toBe(false);
  });

  it('is the pattern the JSON Schema publishes', () => {
    expect(AUDIENCE_ID_PATTERN.source).toBe(
      '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$',
    );
    expect(isAudienceId(42)).toBe(false);
  });
});

describe('audience schemas', () => {
  it('require name, description and a valid match, and no extra keys', () => {
    const ok = { name: 'X', description: 'y', match: { all: [] } };
    expect(audienceDeclarationSchema.parse(ok)).toEqual(ok);
    expect(audienceDeclarationSchema.safeParse({ ...ok, description: '' }).success).toBe(false);
    expect(audienceDeclarationSchema.safeParse({ ...ok, id: 'x' }).success).toBe(false);
    expect(audienceSchema.safeParse({ ...ok, id: 'x' }).success).toBe(true);
    expect(audienceSchema.safeParse({ ...ok, id: 'Not Ok' }).success).toBe(false);
  });
});

describe('deriveAudience', () => {
  it('builds customer.<tier>, staff.<staffRole> and agent.<character> over the family built-in', () => {
    expect(deriveAudience('agent', 'forge')).toEqual({
      id: 'agent.forge',
      name: 'Agent forge',
      description: 'Agent principals whose character is "forge".',
      match: { all: [{ audience: 'agent' }, { attr: 'character', op: 'eq', value: 'forge' }] },
    });
    expect(deriveAudience('customer', 'basic')).toMatchObject({
      id: 'customer.basic',
      name: 'Basic customer',
      match: { all: [{ audience: 'customer' }, { attr: 'tier', op: 'eq', value: 'basic' }] },
    });
    expect(deriveAudience('staff', 'billing-ops')).toMatchObject({
      id: 'staff.billing-ops',
      name: 'Billing-ops staff',
      match: {
        all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'billing-ops' }],
      },
    });
  });

  it('rejects a kind that is not kebab-case', () => {
    expect(() => deriveAudience('agent', 'Forge')).toThrow(RangeError);
    expect(() => deriveAudience('customer', 'pro tier')).toThrow(/kebab-case/);
  });

  it('derived audiences validate and never shadow a built-in', () => {
    const derived = deriveAudience('customer', 'pro');
    const { id, ...declaration } = derived;
    expect(BUILTIN_REGISTRY.has(id)).toBe(false);
    const reg = createAudienceRegistry({ [id]: declaration });
    const pro = { id: 'p', type: 'human' as const, tenantId: 't', attributes: { tier: 'pro' } };
    expect(reg.matches(pro, 'customer.pro')).toBe(true);
    expect(reg.matches(pro, 'customer-pro')).toBe(true);
    expect(reg.matches({ ...pro, type: 'agent' }, 'customer.pro')).toBe(false);
  });
});
