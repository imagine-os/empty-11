/**
 * `migrateViewSpec`: bring a stored spec written by an older client up to `VIEW_SPEC_VERSION`.
 *
 * Migration runs on read, never on write: `viewSpecSchema` accepts the current version only, so
 * a writer must send a current spec, while a reader calls `parseViewSpec()` and gets a current
 * spec back whatever version the row holds. Steps are ordered and keyed by the version they
 * produce; each is a pure function over the raw JSON (`unknown` in, `unknown` out) because the
 * old shape has no schema any more.
 *
 * History:
 * - v1 (2026-09-17 draft, the PAP-161 Spec text before review): `groups` was a plain array of
 *   field ids; `permissions` and `locked` did not exist.
 * - v2 (review of the draft): `groups` became `{ fieldId, expandMulti }` objects; `permissions`
 *   became required with empty audience lists; `locked` was added.
 * - v3 (round 4, 2026-09-18): reserved keys `formats`, `colorBy` on the spec and `description`,
 *   `group`, `defaultValue`, `permissions` on `FieldDef`. No stored data changes; the bump marks
 *   specs that were validated against a schema that knows the keys.
 */
import { VIEW_SPEC_VERSION, type ViewSpec, viewSpecSchema } from './view.js';

export interface ViewSpecMigration {
  /** Version this step produces. Steps run in ascending order. */
  to: number;
  description: string;
  apply(spec: Record<string, unknown>): Record<string, unknown>;
}

export const VIEW_SPEC_MIGRATIONS: readonly ViewSpecMigration[] = [
  {
    to: 2,
    description: 'groups as objects; permissions and locked required',
    apply(spec) {
      const groups = Array.isArray(spec.groups)
        ? spec.groups.map((group) =>
            typeof group === 'string' ? { fieldId: group, expandMulti: false } : group,
          )
        : [];
      return {
        ...spec,
        version: 2,
        groups,
        permissions: spec.permissions ?? { canEditRecords: [], canEditView: [] },
        locked: spec.locked ?? false,
      };
    },
  },
  {
    to: 3,
    description: 'round-4 reserved keys (formats, colorBy); version bump only',
    apply(spec) {
      return { ...spec, version: 3 };
    },
  },
];

export class ViewSpecVersionError extends Error {
  constructor(
    readonly found: unknown,
    readonly current: number = VIEW_SPEC_VERSION,
  ) {
    super(
      `ViewSpec version ${String(found)} is not migratable to ${current}: ` +
        'expected an integer between 1 and the current version',
    );
    this.name = 'ViewSpecVersionError';
  }
}

function readVersion(spec: unknown): number {
  if (!spec || typeof spec !== 'object') throw new ViewSpecVersionError(undefined);
  const version = (spec as { version?: unknown }).version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ViewSpecVersionError(version);
  }
  if (version > VIEW_SPEC_VERSION) throw new ViewSpecVersionError(version);
  return version;
}

/**
 * Applies every migration step after the spec's `version`, in order, and returns the raw
 * current-version JSON. Does not validate: call `viewSpecSchema.parse()` (or `parseViewSpec`)
 * on the result. Throws `ViewSpecVersionError` for a missing, non-integer or newer version.
 */
export function migrateViewSpec(spec: unknown): Record<string, unknown> {
  let version = readVersion(spec);
  let current = { ...(spec as Record<string, unknown>) };
  for (const step of VIEW_SPEC_MIGRATIONS) {
    if (step.to <= version) continue;
    current = step.apply(current);
    version = step.to;
  }
  return current;
}

/** True when the spec is already at the current version (no migration would run). */
export function isCurrentViewSpec(spec: unknown): boolean {
  return (
    !!spec &&
    typeof spec === 'object' &&
    (spec as { version?: unknown }).version === VIEW_SPEC_VERSION
  );
}

/** Read path: migrate, then strict-parse. Throws `ZodError` or `ViewSpecVersionError`. */
export function parseViewSpec(spec: unknown): ViewSpec {
  return viewSpecSchema.parse(migrateViewSpec(spec));
}
