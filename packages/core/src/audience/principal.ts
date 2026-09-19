/**
 * `Principal` — the canonical actor type of PaperOS (Interface & Data Contracts §1).
 *
 * Every request, policy check, page spec and campaign talks about *who* through this
 * one shape. The API context `actor` (PAP-35, PAP-267), `user.kind` (PAP-33) and
 * `principalType` (PAP-57, PAP-60) are storage views of the same enum; `ActorRef`
 * (PAP-302, `@paperos/core/types`) is the `{ id, type, character? }` projection
 * stored on rows, events and comments. Nothing redefines these — import them.
 *
 * Changing any shape in this file needs an ADR (ADR 0017 is the current one).
 */
import { z } from 'zod';

/** The four principal types. Order is stable; do not reorder (it is part of the contract). */
export const PRINCIPAL_TYPES = ['human', 'agent', 'service', 'anonymous'] as const;

/** Who is acting: a person, an agent character, a machine integration, or nobody signed in. */
export type PrincipalType = (typeof PRINCIPAL_TYPES)[number];

export const principalTypeSchema = z.enum(PRINCIPAL_TYPES);

/**
 * One attribute value. Attributes carry everything a segment can test: a customer's
 * `tier`, a `staffRole`, a `partnerId`, an agent's `character`, `emailVerified`, `mfa`,
 * `actingFor`, and any app-specific keys (`plan`, `region`, ...). Arrays are sets of
 * strings (`eq` matches any element, `in` intersects).
 */
export type AttributeValue = string | number | boolean | string[];

export const attributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export type PrincipalAttributes = Record<string, AttributeValue>;

export const principalAttributesSchema = z.record(z.string(), attributeValueSchema);

/**
 * The canonical actor. One `Principal` per active tenant: a user who belongs to three
 * tenants is three principals with the same `id` and different `tenantId` (PAP-58 sets
 * it). `tenantId` is `null` for anonymous visitors on public pages and for platform
 * services that act across tenants.
 */
export type Principal = {
  /** UUIDv7 of the user / agent / service; `anonymous` for anonymous visitors. */
  id: string;
  type: PrincipalType;
  tenantId: string | null;
  attributes: PrincipalAttributes;
};

export const principalSchema = z
  .object({
    id: z.string().min(1),
    type: principalTypeSchema,
    tenantId: z.string().nullable(),
    attributes: principalAttributesSchema,
  })
  .strict();

/**
 * Attribute names the built-in audiences and the identity project agree on. Apps may use
 * any other key; these are the ones with a shared meaning.
 */
export const WELL_KNOWN_ATTRIBUTES = {
  /** Tenant role (`owner|admin|staff|member|viewer` or a custom role name). Set by PAP-58 from the membership. */
  role: 'role',
  /** Customer tier (`free|pro|enterprise` in the built-ins; apps map their own plan names). */
  tier: 'tier',
  /** Staff function (`support|finance|...`). Presence makes a human `staff`. */
  staffRole: 'staffRole',
  /** Partner account id. Presence makes a principal a `partner`. */
  partnerId: 'partnerId',
  /** Agent character (`forge`, `quill`, ...). PAP-103 owns the value set. */
  character: 'character',
  /** Whether the primary email is verified. */
  emailVerified: 'emailVerified',
  /** Whether a second factor was used in this session. */
  mfa: 'mfa',
  /** Principal id an agent is acting on behalf of. Policies must check it explicitly. */
  actingFor: 'actingFor',
  /** `true` for platform developers; drives dev mode and the `developer` audience. */
  developer: 'developer',
} as const;

export type WellKnownAttribute = keyof typeof WELL_KNOWN_ATTRIBUTES;

/** The `id` every anonymous principal carries. */
export const ANONYMOUS_PRINCIPAL_ID = 'anonymous';

/** Build the anonymous principal for a request. `anonymous` ignores `tenantId`. */
export function anonymousPrincipal(tenantId: string | null = null): Principal {
  return { id: ANONYMOUS_PRINCIPAL_ID, type: 'anonymous', tenantId, attributes: {} };
}
