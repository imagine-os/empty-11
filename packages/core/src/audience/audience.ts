/**
 * Audiences: named, composable "who" definitions.
 *
 * Id grammar: kebab-case segments joined by dots, `[a-z][a-z0-9]*(-[a-z0-9]+)*(\.<segment>)*`.
 * The built-ins use single kebab-case ids (`customer-pro`, `staff-support`). The dotted
 * form is the namespace for derived and app-declared families: `customer.<kind>`,
 * `staff.<kind>`, `agent.<character>` — a derived id never collides with a built-in.
 */
import { z } from 'zod';
import type { AudienceId } from './audience-id.js';
import { audienceIdSchema } from './audience-id.js';
import type { Segment } from './segment.js';
import { segmentSchema } from './segment.js';

export {
  AUDIENCE_ID_PATTERN,
  type AudienceId,
  audienceIdSchema,
  isAudienceId,
} from './audience-id.js';

/** What an app declares under `audiences:` in `app.spec.yaml` — an {@link Audience} without its id. */
export type AudienceDeclaration = {
  /** Short plural noun phrase used by `describe` ("Support staff"). */
  name: string;
  /** One or two sentences for the docs and the spec validator's messages. */
  description: string;
  match: Segment;
};

export type Audience = AudienceDeclaration & { id: AudienceId };

export const audienceDeclarationSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    match: segmentSchema,
  })
  .strict();

export const audienceSchema = audienceDeclarationSchema.extend({ id: audienceIdSchema }).strict();

/** The `audiences:` section of `app.spec.yaml`: id → declaration. Shape agreed with PAP-117. */
export type AudienceDeclarations = Record<AudienceId, AudienceDeclaration>;

/** The derived audience families and the attribute each `kind` tests. */
export const DERIVED_AUDIENCE_FAMILIES = {
  /** `customer.<tier>`: a customer whose `tier` is `<tier>`. */
  customer: { base: 'customer', attr: 'tier' },
  /** `staff.<staffRole>`: staff whose `staffRole` is `<staffRole>`. */
  staff: { base: 'staff', attr: 'staffRole' },
  /** `agent.<character>`: the agent principal of one character. */
  agent: { base: 'agent', attr: 'character' },
} as const;

export type DerivedAudienceFamily = keyof typeof DERIVED_AUDIENCE_FAMILIES;

const KIND_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Build a `customer.<kind>`, `staff.<kind>` or `agent.<character>` audience. Derived
 * audiences reference the family's built-in and add one attribute test, so they stay
 * consistent with `customer`, `staff` and `agent` by construction.
 */
export function deriveAudience(family: DerivedAudienceFamily, kind: string): Audience {
  if (!KIND_PATTERN.test(kind)) {
    throw new RangeError(`audience kind must be kebab-case, got ${JSON.stringify(kind)}`);
  }
  const { base, attr } = DERIVED_AUDIENCE_FAMILIES[family];
  const noun = family === 'agent' ? 'agent' : base;
  return {
    id: `${family}.${kind}`,
    name: family === 'agent' ? `Agent ${kind}` : `${capitalize(kind)} ${noun}`,
    description: `${capitalize(noun)} principals whose ${attr} is "${kind}".`,
    match: { all: [{ audience: base }, { attr, op: 'eq', value: kind }] },
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
