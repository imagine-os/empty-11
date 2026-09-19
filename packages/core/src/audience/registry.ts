/**
 * Audience registries: the built-ins plus what an app declares under `audiences:`.
 * `validateAudiences` is what `spec validate` (PAP-116 / PAP-117) runs: it names bad
 * ids, shadowed built-ins, invalid segments, over-deep trees, unknown references and
 * cycles, with a path for each.
 */
import type { Audience, AudienceDeclarations, AudienceId } from './audience.js';
import { audienceDeclarationSchema, audienceIdSchema } from './audience.js';
import { BUILTIN_AUDIENCES } from './builtin.js';
import { describe as describeSegment } from './describe.js';
import type { AudienceResolver } from './matches.js';
import { matches as matchSegment } from './matches.js';
import type { Principal } from './principal.js';
import type { Segment } from './segment.js';
import { referencedAudiences, SEGMENT_MAX_DEPTH, segmentDepth } from './segment.js';

export const AUDIENCE_ISSUE_CODES = [
  'INVALID_ID',
  'SHADOWS_BUILTIN',
  'INVALID_SEGMENT',
  'TOO_DEEP',
  'UNKNOWN_REFERENCE',
  'CYCLE',
] as const;

export type AudienceIssueCode = (typeof AUDIENCE_ISSUE_CODES)[number];

export type AudienceIssue = {
  code: AudienceIssueCode;
  /** The declared audience the issue belongs to. */
  audienceId: string;
  /** JSON path inside the declaration (`['match', 'all', 1]`), when it applies. */
  path?: (string | number)[];
  message: string;
};

export type AudienceValidationResult =
  | { ok: true; audiences: Readonly<Record<AudienceId, Audience>> }
  | { ok: false; issues: AudienceIssue[] };

export class AudienceValidationError extends Error {
  override name = 'AudienceValidationError';
  constructor(public readonly issues: readonly AudienceIssue[]) {
    super(`invalid audiences:\n${issues.map((i) => `- ${i.audienceId}: ${i.message}`).join('\n')}`);
  }
}

/** Validate an `audiences:` section against the built-ins. Pure; never throws. */
export function validateAudiences(declared: unknown): AudienceValidationResult {
  const issues: AudienceIssue[] = [];
  const merged: Record<AudienceId, Audience> = { ...BUILTIN_AUDIENCES };

  if (declared === undefined || declared === null) return { ok: true, audiences: merged };
  if (typeof declared !== 'object' || Array.isArray(declared)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_SEGMENT',
          audienceId: '',
          message: 'audiences must be an object of id -> declaration',
        },
      ],
    };
  }

  for (const [id, raw] of Object.entries(declared as Record<string, unknown>)) {
    if (!audienceIdSchema.safeParse(id).success) {
      issues.push({
        code: 'INVALID_ID',
        audienceId: id,
        message: `"${id}" is not a valid audience id (kebab-case segments joined by dots)`,
      });
      continue;
    }
    if (Object.hasOwn(BUILTIN_AUDIENCES, id)) {
      issues.push({
        code: 'SHADOWS_BUILTIN',
        audienceId: id,
        message: `"${id}" is a built-in audience and cannot be redeclared`,
      });
      continue;
    }
    const parsed = audienceDeclarationSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const tooDeep = issue.message.startsWith('segment deeper than');
        issues.push({
          code: tooDeep ? 'TOO_DEEP' : 'INVALID_SEGMENT',
          audienceId: id,
          path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
          message: issue.message,
        });
      }
      continue;
    }
    merged[id] = { id, ...parsed.data };
  }

  // Second pass over everything that parsed: depth (belt and braces), references, cycles.
  for (const audience of Object.values(merged)) {
    if (Object.hasOwn(BUILTIN_AUDIENCES, audience.id)) continue;
    const depth = segmentDepth(audience.match);
    if (depth > SEGMENT_MAX_DEPTH) {
      issues.push({
        code: 'TOO_DEEP',
        audienceId: audience.id,
        path: ['match'],
        message: `segment depth ${depth} exceeds ${SEGMENT_MAX_DEPTH}`,
      });
    }
    for (const ref of referencedAudiences(audience.match)) {
      if (!Object.hasOwn(merged, ref)) {
        issues.push({
          code: 'UNKNOWN_REFERENCE',
          audienceId: audience.id,
          path: ['match'],
          message: `references unknown audience "${ref}"`,
        });
      }
    }
  }

  for (const cycle of findCycles(merged)) {
    issues.push({
      code: 'CYCLE',
      audienceId: cycle[0] as string,
      path: ['match'],
      message: `audience reference cycle: ${cycle.join(' -> ')}`,
    });
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, audiences: merged };
}

/** Every distinct reference cycle in the graph, each as `[a, b, ..., a]`. */
function findCycles(audiences: Readonly<Record<AudienceId, Audience>>): AudienceId[][] {
  const cycles: AudienceId[][] = [];
  const seenCycles = new Set<string>();
  const state = new Map<AudienceId, 'visiting' | 'done'>();
  const stack: AudienceId[] = [];

  const visit = (id: AudienceId): void => {
    const s = state.get(id);
    if (s === 'done') return;
    if (s === 'visiting') {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      const key = [...cycle.slice(0, -1)].sort().join('|');
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        cycles.push(cycle);
      }
      return;
    }
    state.set(id, 'visiting');
    stack.push(id);
    const audience = audiences[id];
    if (audience)
      for (const ref of referencedAudiences(audience.match))
        if (Object.hasOwn(audiences, ref)) visit(ref);
    stack.pop();
    state.set(id, 'done');
  };

  for (const id of Object.keys(audiences)) visit(id);
  return cycles;
}

/** A validated set of audiences with the operations every consumer needs. */
export interface AudienceRegistry extends AudienceResolver {
  /** Every id, built-ins first in their declared order, then declared ones in declaration order. */
  readonly ids: readonly AudienceId[];
  get(id: AudienceId): Audience | undefined;
  has(id: AudienceId): boolean;
  /** Segment behind an id, or `undefined`. */
  resolve(id: AudienceId): Segment | undefined;
  /** `true` when `principal` is in the audience (by id) or matches the segment. */
  matches(principal: Principal, target: AudienceId | Segment): boolean;
  /** Ids of every audience the principal belongs to. */
  matching(principal: Principal): AudienceId[];
  /** Human text for an audience id or a segment, resolving audience names through this registry. */
  describe(target: AudienceId | Segment): string;
}

/**
 * Build a registry from the built-ins plus an app's `audiences:` section.
 * Throws {@link AudienceValidationError} when the declarations do not validate.
 */
export function createAudienceRegistry(declared?: AudienceDeclarations): AudienceRegistry {
  const result = validateAudiences(declared);
  if (!result.ok) throw new AudienceValidationError(result.issues);
  const audiences = result.audiences;
  const ids = Object.freeze(Object.keys(audiences));

  const registry: AudienceRegistry = {
    ids,
    get: (id) => (Object.hasOwn(audiences, id) ? audiences[id] : undefined),
    has: (id) => Object.hasOwn(audiences, id),
    resolve: (id) => (Object.hasOwn(audiences, id) ? audiences[id]?.match : undefined),
    matches: (principal, target) =>
      matchSegment(principal, typeof target === 'string' ? { audience: target } : target, {
        audiences: registry,
      }),
    matching: (principal) =>
      ids.filter((id) => matchSegment(principal, { audience: id }, { audiences: registry })),
    describe: (target) =>
      describeSegment(typeof target === 'string' ? { audience: target } : target, {
        audiences: registry,
      }),
  };
  return registry;
}

/** The built-in audiences alone, as a registry. `matches` and `describe` fall back to the same set. */
export const BUILTIN_REGISTRY: AudienceRegistry = createAudienceRegistry();
