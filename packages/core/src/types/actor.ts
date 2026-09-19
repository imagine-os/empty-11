/**
 * Who did it.
 *
 * `Principal` (PAP-55, `@paperos/core/audience`) is the full identity: id, type,
 * tenant and attributes. `ActorRef` is the **projection** of it that gets
 * written onto rows, events, comments and audit records — small enough to
 * denormalise everywhere, complete enough to render "Forge (agent) on behalf of
 * Justin" without a join.
 *
 * One enum, four names, one meaning: `user.kind` (PAP-33), `principalType`
 * (PAP-57, PAP-60), the API context `actor` (PAP-35) and this `type` are the
 * same four values.
 */

import { z } from 'zod';
import { ValidationError } from './error.js';
import { NIL_UUID, type Uuid, uuidSchema } from './ids.js';

/**
 * Local copy of PAP-55 `PrincipalType`.
 *
 * `@paperos/core/audience` owns the canonical declaration. It has not merged
 * yet and `@paperos/core/types` must not block on it, so the union is repeated
 * here and `actor.test.ts` pins the two together with
 * `expectTypeOf<ActorRef['type']>().toEqualTypeOf<PrincipalType>()`. When
 * PAP-55 lands, delete this declaration, re-export the audience one and the
 * test keeps its meaning without changing a line.
 */
export const PRINCIPAL_TYPES = ['human', 'agent', 'service', 'anonymous'] as const;

/** See {@link PRINCIPAL_TYPES}: a local copy of PAP-55's `PrincipalType`. */
export type PrincipalType = (typeof PRINCIPAL_TYPES)[number];

export interface ActorRef {
  id: Uuid;
  type: PrincipalType;
  /** Agent character (`forge`, `sentinel`, ...) when `type` is `agent`. */
  character?: string | undefined;
  /** The principal this actor is impersonating or acting for, if any. */
  onBehalfOf?: Uuid | undefined;
}

/** The part of PAP-55 `Principal` that {@link toActorRef} reads. */
export interface PrincipalLike {
  id: string;
  type: PrincipalType;
  attributes?: Readonly<Record<string, unknown>> | null | undefined;
}

/**
 * The actor on an unauthenticated request. Its id is the nil UUID so the type
 * stays total; storage writes `actor_id NULL` for it, which is the only case
 * where that column is nullable (CHECK constraint in `@paperos/db`).
 */
export const ANONYMOUS_ACTOR: Readonly<ActorRef> = Object.freeze({
  id: NIL_UUID,
  type: 'anonymous',
});

export function isPrincipalType(value: unknown): value is PrincipalType {
  return typeof value === 'string' && (PRINCIPAL_TYPES as readonly string[]).includes(value);
}

export function isAnonymous(actor: ActorRef): boolean {
  return actor.type === 'anonymous';
}

/**
 * Project a `Principal` down to an `ActorRef`. `character` is lifted out of
 * `attributes.character` when it is a string, which is where PAP-33 and PAP-60
 * put it.
 */
export function toActorRef(
  principal: PrincipalLike,
  options: { onBehalfOf?: Uuid } = {},
): ActorRef {
  if (!isPrincipalType(principal.type)) {
    throw new ValidationError(`not a principal type: ${JSON.stringify(principal.type)}`);
  }
  const actor: ActorRef = { id: uuidSchema.parse(principal.id), type: principal.type };
  const character = principal.attributes?.character;
  if (typeof character === 'string' && character.length > 0) actor.character = character;
  if (options.onBehalfOf !== undefined) actor.onBehalfOf = options.onBehalfOf;
  return actor;
}

/** Wire schema. Holds no transform, so `z.toJSONSchema()` renders it. */
export const principalTypeSchema = z.enum(PRINCIPAL_TYPES);

export const actorRefSchema = z.object({
  id: uuidSchema,
  type: principalTypeSchema,
  character: z.string().min(1).optional(),
  onBehalfOf: uuidSchema.optional(),
});
