/**
 * The segment expression language: a small boolean tree over principal attributes.
 *
 * ```
 * Segment = { all: Segment[] } | { any: Segment[] } | { not: Segment }
 *         | { attr, op: eq|neq|in|gte|lte|exists, value? }
 *         | { role } | { principalType } | { tier } | { audience: id }
 * ```
 *
 * Depth is limited to {@link SEGMENT_MAX_DEPTH}; a leaf has depth 1. Shorthand leaves
 * (`role`, `tier`) normalise to `attr` leaves; `principalType` reads `principal.type`;
 * `audience` references another audience by id (resolved by the registry, cycles rejected).
 */
import { z } from 'zod';
import type { AudienceId } from './audience-id.js';
import { audienceIdSchema } from './audience-id.js';
import type { PrincipalType } from './principal.js';
import { principalTypeSchema } from './principal.js';
import type { TenantRole } from './role.js';
import { tenantRoleSchema } from './role.js';

export const SEGMENT_OPS = ['eq', 'neq', 'in', 'gte', 'lte', 'exists'] as const;
export type SegmentOp = (typeof SEGMENT_OPS)[number];
export const segmentOpSchema = z.enum(SEGMENT_OPS);

/** Maximum nesting of `all` / `any` / `not` (a leaf counts 1). Audience references do not add depth. */
export const SEGMENT_MAX_DEPTH = 6;

/** A value a segment compares against. Wider than `AttributeValue`: `in` may list numbers or booleans. */
export type SegmentScalar = string | number | boolean;
export type SegmentValue = SegmentScalar | SegmentScalar[];

export const segmentScalarSchema = z.union([z.string(), z.number(), z.boolean()]);
export const segmentValueSchema = z.union([segmentScalarSchema, z.array(segmentScalarSchema)]);

/** Attribute test. Missing attributes make every operator `false` except `exists` with `value: false`. */
export type AttrSegment = { attr: string; op: SegmentOp; value?: SegmentValue | undefined };
export type AllSegment = { all: Segment[] };
export type AnySegment = { any: Segment[] };
export type NotSegment = { not: Segment };
export type RoleSegment = { role: TenantRole };
export type PrincipalTypeSegment = { principalType: PrincipalType };
export type TierSegment = { tier: string };
export type AudienceRefSegment = { audience: AudienceId };

export type Segment =
  | AllSegment
  | AnySegment
  | NotSegment
  | AttrSegment
  | RoleSegment
  | PrincipalTypeSegment
  | TierSegment
  | AudienceRefSegment;

/** A segment with the `role` / `tier` shorthands expanded. */
export type NormalizedSegment =
  | { all: NormalizedSegment[] }
  | { any: NormalizedSegment[] }
  | { not: NormalizedSegment }
  | AttrSegment
  | PrincipalTypeSegment
  | AudienceRefSegment;

const attrSegmentSchema = z
  .object({
    attr: z.string().min(1),
    op: segmentOpSchema,
    value: segmentValueSchema.optional(),
  })
  .strict()
  .superRefine((leaf, ctx) => {
    const v = leaf.value;
    switch (leaf.op) {
      case 'eq':
      case 'neq':
        if (v === undefined || Array.isArray(v)) {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: `${leaf.op} needs a scalar value`,
          });
        }
        return;
      case 'in':
        if (!Array.isArray(v)) {
          ctx.addIssue({ code: 'custom', path: ['value'], message: 'in needs an array value' });
        }
        return;
      case 'gte':
      case 'lte':
        if (typeof v !== 'number' && typeof v !== 'string') {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: `${leaf.op} needs a number or string value`,
          });
        }
        return;
      case 'exists':
        if (v !== undefined && typeof v !== 'boolean') {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'exists takes an optional boolean',
          });
        }
        return;
    }
  });

/** The recursive node schema, without the depth check (applied once at the top by {@link segmentSchema}). */
export const segmentNodeSchema: z.ZodType<Segment> = z
  .lazy(() =>
    z.union([
      z.object({ all: z.array(segmentNodeSchema) }).strict(),
      z.object({ any: z.array(segmentNodeSchema) }).strict(),
      z.object({ not: segmentNodeSchema }).strict(),
      attrSegmentSchema,
      z.object({ role: tenantRoleSchema }).strict(),
      z.object({ principalType: principalTypeSchema }).strict(),
      z.object({ tier: z.string().min(1) }).strict(),
      z.object({ audience: audienceIdSchema }).strict(),
    ]),
  )
  .meta({
    id: 'Segment',
    title: 'Segment',
    description: 'A boolean tree over principal attributes; depth is limited to 6.',
  });

/** A segment tree no deeper than {@link SEGMENT_MAX_DEPTH}. */
export const segmentSchema: z.ZodType<Segment> = segmentNodeSchema.refine(
  (s) => segmentDepth(s) <= SEGMENT_MAX_DEPTH,
  { message: `segment deeper than ${SEGMENT_MAX_DEPTH} levels` },
);

/** Nesting depth: a leaf is 1, `{ not: leaf }` is 2. */
export function segmentDepth(segment: Segment): number {
  if ('all' in segment) return 1 + maxDepth(segment.all);
  if ('any' in segment) return 1 + maxDepth(segment.any);
  if ('not' in segment) return 1 + segmentDepth(segment.not);
  return 1;
}

function maxDepth(children: readonly Segment[]): number {
  let max = 0;
  for (const c of children) {
    const d = segmentDepth(c);
    if (d > max) max = d;
  }
  return max;
}

/** Expand the `role` and `tier` shorthands into `attr` leaves. Pure; returns a new tree. */
export function normalizeSegment(segment: Segment): NormalizedSegment {
  if ('all' in segment) return { all: segment.all.map(normalizeSegment) };
  if ('any' in segment) return { any: segment.any.map(normalizeSegment) };
  if ('not' in segment) return { not: normalizeSegment(segment.not) };
  if ('role' in segment) return { attr: 'role', op: 'eq', value: segment.role };
  if ('tier' in segment) return { attr: 'tier', op: 'eq', value: segment.tier };
  return segment;
}

/** Every audience id the segment references, depth-first, duplicates removed. */
export function referencedAudiences(segment: Segment): AudienceId[] {
  const out: AudienceId[] = [];
  const walk = (s: Segment): void => {
    if ('all' in s) for (const c of s.all) walk(c);
    else if ('any' in s) for (const c of s.any) walk(c);
    else if ('not' in s) walk(s.not);
    else if ('audience' in s && !out.includes(s.audience)) out.push(s.audience);
  };
  walk(segment);
  return out;
}

/** Segment combinators, for building trees in code without object literals. */
export const seg = {
  all: (...children: Segment[]): AllSegment => ({ all: children }),
  any: (...children: Segment[]): AnySegment => ({ any: children }),
  not: (child: Segment): NotSegment => ({ not: child }),
  attr: (attr: string, op: SegmentOp, value?: SegmentValue): AttrSegment =>
    value === undefined ? { attr, op } : { attr, op, value },
  role: (role: TenantRole): RoleSegment => ({ role }),
  principalType: (principalType: PrincipalType): PrincipalTypeSegment => ({ principalType }),
  tier: (tier: string): TierSegment => ({ tier }),
  audience: (audience: AudienceId): AudienceRefSegment => ({ audience }),
  /** Matches everyone. */
  everyone: (): AllSegment => ({ all: [] }),
  /** Matches no one. */
  nobody: (): AnySegment => ({ any: [] }),
} as const;
