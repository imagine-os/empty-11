import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it, describe as suite } from 'vitest';
import { BUILTIN_AUDIENCE_IDS, BUILTIN_AUDIENCES } from './builtin.js';
import { describe } from './describe.js';

const goldenPath = new URL('./fixtures/golden/describe.json', import.meta.url);

suite('describe', () => {
  it('renders the spec example', () => {
    expect(
      describe({
        any: [
          { all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'support' }] },
          { audience: 'admin' },
        ],
      }),
    ).toBe('staff whose staffRole is support, or admins');
  });

  it('matches the golden phrases for every built-in (set UPDATE_GOLDENS=1 to rewrite)', () => {
    const actual = Object.fromEntries(
      BUILTIN_AUDIENCE_IDS.map((id) => [id, describe(BUILTIN_AUDIENCES[id].match)]),
    );
    if (process.env.UPDATE_GOLDENS)
      writeFileSync(goldenPath, `${JSON.stringify(actual, null, 2)}\n`);
    expect(actual).toEqual(JSON.parse(readFileSync(goldenPath, 'utf8')));
  });

  it('renders the empty combinators and their negations', () => {
    expect(describe({ all: [] })).toBe('everyone');
    expect(describe({ any: [] })).toBe('no one');
    expect(describe({ not: { all: [] } })).toBe('no one');
    expect(describe({ not: { any: [] } })).toBe('everyone');
    expect(describe({ not: { role: 'owner' } })).toBe('anyone except owners');
  });

  it('renders every leaf kind', () => {
    expect(describe({ principalType: 'human' })).toBe('people');
    expect(describe({ principalType: 'service' })).toBe('services');
    expect(describe({ role: 'viewer' })).toBe('viewers');
    expect(describe({ tier: 'pro' })).toBe('customers on the pro tier');
    expect(describe({ audience: 'customer-pro' })).toBe('pro customers');
    expect(describe({ audience: 'unknown-id' })).toBe('unknown-id');
    expect(describe({ attr: 'tier', op: 'neq', value: 'free' })).toBe(
      'principals whose tier is not free',
    );
    expect(describe({ attr: 'region', op: 'in', value: ['eu'] })).toBe(
      'principals whose region is one of eu',
    );
    expect(describe({ attr: 'region', op: 'in', value: ['eu', 'uk', 'us'] })).toBe(
      'principals whose region is one of eu, uk or us',
    );
    expect(describe({ attr: 'region', op: 'in', value: [] })).toBe(
      'principals whose region is one of ',
    );
    expect(describe({ attr: 'seats', op: 'gte', value: 5 })).toBe(
      'principals whose seats is at least 5',
    );
    expect(describe({ attr: 'seats', op: 'lte', value: 5 })).toBe(
      'principals whose seats is at most 5',
    );
    expect(describe({ attr: 'mfa', op: 'exists' })).toBe('principals who have a mfa');
    expect(describe({ attr: 'mfa', op: 'exists', value: true })).toBe('principals who have a mfa');
    expect(describe({ attr: 'mfa', op: 'exists', value: false })).toBe(
      'principals who have no mfa',
    );
    expect(describe({ attr: 'x', op: 'eq' })).toBe('principals whose x is nothing');
  });

  it('composes subjects and predicates inside all', () => {
    expect(describe({ all: [{ audience: 'customer' }, { audience: 'partner' }] })).toBe(
      'customers who are also partners',
    );
    expect(
      describe({
        all: [{ audience: 'customer' }, { tier: 'pro' }, { attr: 'partnerId', op: 'exists' }],
      }),
    ).toBe('customers on the pro tier and who have a partnerId');
    expect(
      describe({
        all: [
          { attr: 'a', op: 'exists' },
          { attr: 'b', op: 'exists' },
        ],
      }),
    ).toBe('principals who have a a and who have a b');
    expect(describe({ all: [{ role: 'admin' }] })).toBe('admins');
  });

  it('negations inside all read as one clause', () => {
    expect(describe({ all: [{ audience: 'customer' }, { not: { audience: 'partner' } }] })).toBe(
      'customers who are not partners',
    );
    expect(
      describe({
        all: [
          { principalType: 'human' },
          { attr: 'emailVerified', op: 'eq', value: true },
          { not: { attr: 'mfa', op: 'eq', value: true } },
        ],
      }),
    ).toBe('people whose emailVerified is true and whose mfa is not true');
    expect(describe({ all: [{ audience: 'customer' }, { not: { tier: 'pro' } }] })).toBe(
      'customers not on the pro tier',
    );
    expect(describe({ all: [{ not: { attr: 'tier', op: 'neq', value: 'free' } }] })).toBe(
      'principals whose tier is free',
    );
    expect(describe({ all: [{ not: { attr: 'region', op: 'in', value: ['eu', 'uk'] } }] })).toBe(
      'principals whose region is not one of eu or uk',
    );
    expect(describe({ all: [{ not: { attr: 'seats', op: 'gte', value: 5 } }] })).toBe(
      'principals whose seats is less than 5',
    );
    expect(describe({ all: [{ not: { attr: 'seats', op: 'lte', value: 5 } }] })).toBe(
      'principals whose seats is more than 5',
    );
    expect(describe({ all: [{ not: { attr: 'mfa', op: 'exists' } }] })).toBe(
      'principals who have no mfa',
    );
    expect(describe({ all: [{ not: { attr: 'mfa', op: 'exists', value: false } }] })).toBe(
      'principals who have a mfa',
    );
    expect(describe({ all: [{ audience: 'customer' }, { not: { all: [] } }] })).toBe(
      'customers who are also no one',
    );
  });

  it('parenthesises alternatives that are one of several children of all', () => {
    expect(
      describe({
        all: [
          { any: [{ audience: 'customer-pro' }, { audience: 'customer-enterprise' }] },
          { audience: 'partner' },
        ],
      }),
    ).toBe('(pro customers, or enterprise customers) who are also partners');
    expect(describe({ all: [{ any: [{ role: 'admin' }, { role: 'owner' }] }] })).toBe(
      'admins, or owners',
    );
    expect(describe({ all: [{ any: [{ role: 'admin' }] }, { tier: 'pro' }] })).toBe(
      'admins on the pro tier',
    );
  });

  it('uses a supplied name source, keeping acronyms intact', () => {
    const names = {
      get: (id: string) =>
        id === 'vip'
          ? { id, name: 'VIP customers', description: '', match: { all: [] } }
          : undefined,
    };
    expect(describe({ audience: 'vip' }, { audiences: names })).toBe('VIP customers');
    expect(describe({ audience: 'other' }, { audiences: names })).toBe('other');
  });
});
