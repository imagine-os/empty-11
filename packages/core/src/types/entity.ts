/**
 * Pointing at a row from somewhere else.
 *
 * A comment, a notification, a search document, an audit record and an event
 * subject all need to name "the thing this is about" without a foreign key per
 * table. That is an `EntityRef`: a dataset `type` plus a `Uuid`. Stored as two
 * columns (`entity_type`, `entity_id`), written as one string when it has to
 * fit in a single field: `entity:invoice:0192f0c1-...` — the same grammar as
 * the PAP-131 comment anchor, so an anchor and a subject parse with one parser.
 */

import { z } from 'zod';
import type { Brand } from './brand.js';
import { ValidationError } from './error.js';
import { isUuid, type Uuid, uuidSchema } from './ids.js';

/** The single-string form: `entity:<type>:<id>`. */
export type EntityKey = Brand<string, 'EntityKey'>;

export interface EntityRef {
  /** Dataset key from the PAP-161 registry: `invoice`, `pm_issue`, `file`, ... */
  type: string;
  id: Uuid;
}

const ENTITY_TYPE_RE = /^[a-z][a-z0-9_]*$/;
const ENTITY_KEY_PREFIX = 'entity';

/** A predicate `packages/views` installs so unknown dataset keys are rejected. */
export type EntityTypeValidator = (type: string) => boolean;

let registryValidator: EntityTypeValidator | null = null;

/**
 * Register the dataset registry as the authority on entity types.
 *
 * `@paperos/core` cannot import `packages/views` (it is contract-zero), so the
 * check is injected: when `packages/views` is loaded it calls this with
 * `hasDataset`, and from then on `entity:nonsense:...` fails to parse. Without
 * it the grammar is checked but the type is free-form, which is what a package
 * that does not ship datasets needs.
 *
 * @returns a function that restores the previous validator.
 */
export function setEntityTypeValidator(validator: EntityTypeValidator | null): () => void {
  const previous = registryValidator;
  registryValidator = validator;
  return () => {
    registryValidator = previous;
  };
}

/** Throw `VALIDATION` unless `type` is a well-formed and (if a registry is installed) known key. */
export function assertEntityType(type: string): void {
  if (!ENTITY_TYPE_RE.test(type)) {
    throw new ValidationError(
      `not an entity type (lower_snake_case expected): ${JSON.stringify(type)}`,
    );
  }
  if (registryValidator !== null && !registryValidator(type)) {
    throw new ValidationError(`unknown entity type: ${JSON.stringify(type)}`);
  }
}

/** Build a validated `EntityRef`. */
export function entityRef(type: string, id: string): EntityRef {
  assertEntityType(type);
  if (!isUuid(id)) throw new ValidationError(`not a UUID entity id: ${JSON.stringify(id)}`);
  return { type, id };
}

/** `entity:<type>:<id>`. */
export function formatEntityKey(ref: EntityRef): EntityKey {
  assertEntityType(ref.type);
  if (!isUuid(ref.id)) throw new ValidationError(`not a UUID entity id: ${JSON.stringify(ref.id)}`);
  return `${ENTITY_KEY_PREFIX}:${ref.type}:${ref.id}` as EntityKey;
}

/** Inverse of {@link formatEntityKey}. Throws `VALIDATION` on anything else. */
export function parseEntityKey(key: string): EntityRef {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== ENTITY_KEY_PREFIX) {
    throw new ValidationError(
      `not an entity key (entity:<type>:<id> expected): ${JSON.stringify(key)}`,
    );
  }
  return entityRef(parts[1] as string, parts[2] as string);
}

export function isEntityKey(value: unknown): value is EntityKey {
  if (typeof value !== 'string') return false;
  try {
    parseEntityKey(value);
    return true;
  } catch {
    return false;
  }
}

export const entityTypeSchema = z
  .string()
  .regex(ENTITY_TYPE_RE, 'must be a lower_snake_case dataset key');

export const entityRefSchema = z.object({ type: entityTypeSchema, id: uuidSchema });

export const entityKeySchema = z
  .string()
  .refine(isEntityKey, 'must be entity:<type>:<id>') as unknown as z.ZodType<EntityKey, string>;
