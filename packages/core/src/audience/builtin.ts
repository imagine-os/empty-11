/**
 * The fifteen built-in audiences. Every PaperOS app has them; `app.spec.yaml` cannot
 * redeclare one (validation issue `SHADOWS_BUILTIN`). Each carries a matching and a
 * non-matching example principal, used by the docs, the golden fixtures and PAP-64 / PAP-240.
 */
import type { Audience } from './audience.js';
import type { Principal } from './principal.js';

export const BUILTIN_AUDIENCE_IDS = [
  'everyone',
  'anonymous',
  'authenticated',
  'customer',
  'customer-free',
  'customer-pro',
  'customer-enterprise',
  'staff',
  'staff-support',
  'staff-finance',
  'admin',
  'owner',
  'partner',
  'agent',
  'developer',
] as const;

export type BuiltinAudienceId = (typeof BUILTIN_AUDIENCE_IDS)[number];

export type BuiltinAudience = Audience & {
  id: BuiltinAudienceId;
  /** `nonMatching` is `null` only for `everyone`, which nobody fails to match. */
  examples: { matching: Principal; nonMatching: Principal | null };
};

const TENANT = '0192a1b2-0000-7000-8000-000000000001';

const anon: Principal = { id: 'anonymous', type: 'anonymous', tenantId: null, attributes: {} };
const freeCustomer: Principal = {
  id: '0192a1b2-0000-7000-8000-00000000c001',
  type: 'human',
  tenantId: TENANT,
  attributes: { role: 'member', tier: 'free', emailVerified: true },
};
const proCustomer: Principal = {
  ...freeCustomer,
  id: '0192a1b2-0000-7000-8000-00000000c002',
  attributes: { role: 'member', tier: 'pro', emailVerified: true },
};
const enterpriseCustomer: Principal = {
  ...freeCustomer,
  id: '0192a1b2-0000-7000-8000-00000000c003',
  attributes: { role: 'admin', tier: 'enterprise', emailVerified: true, mfa: true },
};
const supportStaff: Principal = {
  id: '0192a1b2-0000-7000-8000-00000000a001',
  type: 'human',
  tenantId: TENANT,
  attributes: { role: 'staff', staffRole: 'support', emailVerified: true, mfa: true },
};
const financeStaff: Principal = {
  ...supportStaff,
  id: '0192a1b2-0000-7000-8000-00000000a002',
  attributes: { role: 'staff', staffRole: 'finance', emailVerified: true, mfa: true },
};
const adminHuman: Principal = {
  ...supportStaff,
  id: '0192a1b2-0000-7000-8000-00000000a003',
  attributes: { role: 'admin', emailVerified: true, mfa: true },
};
const ownerHuman: Principal = {
  ...supportStaff,
  id: '0192a1b2-0000-7000-8000-00000000a004',
  attributes: { role: 'owner', emailVerified: true, mfa: true },
};
const partnerCustomer: Principal = {
  ...proCustomer,
  id: '0192a1b2-0000-7000-8000-00000000c004',
  attributes: { role: 'member', tier: 'pro', partnerId: 'p-acme', emailVerified: true },
};
const forge: Principal = {
  id: '0192a1b2-0000-7000-8000-00000000e001',
  type: 'agent',
  tenantId: TENANT,
  attributes: { character: 'forge', role: 'staff', actingFor: supportStaff.id },
};
const developer: Principal = {
  ...adminHuman,
  id: '0192a1b2-0000-7000-8000-00000000a005',
  attributes: { role: 'admin', developer: true, emailVerified: true, mfa: true },
};

const define = (a: BuiltinAudience): BuiltinAudience => a;

export const BUILTIN_AUDIENCES: Readonly<Record<BuiltinAudienceId, BuiltinAudience>> = {
  everyone: define({
    id: 'everyone',
    name: 'Everyone',
    description: 'Every principal, signed in or not. The empty conjunction.',
    match: { all: [] },
    examples: { matching: anon, nonMatching: null },
  }),
  anonymous: define({
    id: 'anonymous',
    name: 'Anonymous visitors',
    description:
      'Nobody is signed in. Ignores tenantId: public tenant pages see the same anonymous principal.',
    match: { principalType: 'anonymous' },
    examples: { matching: anon, nonMatching: freeCustomer },
  }),
  authenticated: define({
    id: 'authenticated',
    name: 'Authenticated principals',
    description: 'Any signed-in human, agent or service.',
    match: { not: { principalType: 'anonymous' } },
    examples: { matching: freeCustomer, nonMatching: anon },
  }),
  customer: define({
    id: 'customer',
    name: 'Customers',
    description: 'Humans with a customer tier. Apps map their own plan names onto tier.',
    match: { all: [{ principalType: 'human' }, { attr: 'tier', op: 'exists' }] },
    examples: { matching: freeCustomer, nonMatching: supportStaff },
  }),
  'customer-free': define({
    id: 'customer-free',
    name: 'Free-tier customers',
    description: 'Customers on the free tier.',
    match: { all: [{ audience: 'customer' }, { tier: 'free' }] },
    examples: { matching: freeCustomer, nonMatching: proCustomer },
  }),
  'customer-pro': define({
    id: 'customer-pro',
    name: 'Pro customers',
    description: 'Customers on the pro tier.',
    match: { all: [{ audience: 'customer' }, { tier: 'pro' }] },
    examples: { matching: proCustomer, nonMatching: freeCustomer },
  }),
  'customer-enterprise': define({
    id: 'customer-enterprise',
    name: 'Enterprise customers',
    description: 'Customers on the enterprise tier.',
    match: { all: [{ audience: 'customer' }, { tier: 'enterprise' }] },
    examples: { matching: enterpriseCustomer, nonMatching: proCustomer },
  }),
  staff: define({
    id: 'staff',
    name: 'Staff',
    description: 'Humans with a staffRole: the tenant’s own people, whatever their tenant role.',
    match: { all: [{ principalType: 'human' }, { attr: 'staffRole', op: 'exists' }] },
    examples: { matching: supportStaff, nonMatching: proCustomer },
  }),
  'staff-support': define({
    id: 'staff-support',
    name: 'Support staff',
    description: 'Staff whose staffRole is support.',
    match: { all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'support' }] },
    examples: { matching: supportStaff, nonMatching: financeStaff },
  }),
  'staff-finance': define({
    id: 'staff-finance',
    name: 'Finance staff',
    description: 'Staff whose staffRole is finance.',
    match: { all: [{ audience: 'staff' }, { attr: 'staffRole', op: 'eq', value: 'finance' }] },
    examples: { matching: financeStaff, nonMatching: supportStaff },
  }),
  admin: define({
    id: 'admin',
    name: 'Admins',
    description: 'Tenant role admin or owner. Owners are admins; admins are not owners.',
    match: { any: [{ role: 'admin' }, { role: 'owner' }] },
    examples: { matching: adminHuman, nonMatching: supportStaff },
  }),
  owner: define({
    id: 'owner',
    name: 'Owners',
    description: 'Tenant role owner.',
    match: { role: 'owner' },
    examples: { matching: ownerHuman, nonMatching: adminHuman },
  }),
  partner: define({
    id: 'partner',
    name: 'Partners',
    description: 'Principals with a partnerId. A partner is usually also a customer.',
    match: { attr: 'partnerId', op: 'exists' },
    examples: { matching: partnerCustomer, nonMatching: proCustomer },
  }),
  agent: define({
    id: 'agent',
    name: 'Agents',
    description:
      'Agent principals, whether or not they act for someone. Policies check actingFor explicitly.',
    match: { principalType: 'agent' },
    examples: { matching: forge, nonMatching: supportStaff },
  }),
  developer: define({
    id: 'developer',
    name: 'Developers',
    description:
      'Platform developers (developer: true). Drives dev mode, the role switcher and the testing hub.',
    match: { attr: 'developer', op: 'eq', value: true },
    examples: { matching: developer, nonMatching: adminHuman },
  }),
};

export function isBuiltinAudienceId(value: unknown): value is BuiltinAudienceId {
  return typeof value === 'string' && Object.hasOwn(BUILTIN_AUDIENCES, value);
}
