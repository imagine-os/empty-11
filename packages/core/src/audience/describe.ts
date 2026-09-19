/**
 * `describe(segment)` renders a segment as one English phrase, e.g.
 * "staff whose staffRole is support, or admins". Deterministic; the golden file
 * `fixtures/golden/describe.json` locks the output for every built-in.
 *
 * English only by design: the phrase is a developer-facing explanation (spec validator
 * messages, `audience explain`, docs). User-facing copy goes through the message catalog.
 */
import type { Audience } from './audience.js';
import type { AudienceId } from './audience-id.js';
import { BUILTIN_AUDIENCES } from './builtin.js';
import type { PrincipalType } from './principal.js';
import type { TenantRole } from './role.js';
import type { AttrSegment, Segment, SegmentValue } from './segment.js';

export type DescribeOptions = {
  /** Where audience names come from. Defaults to the built-in audiences; unknown ids render as the id. */
  audiences?: { get(id: AudienceId): Audience | undefined } | undefined;
};

const builtinNames: NonNullable<DescribeOptions['audiences']> = {
  get: (id) =>
    Object.hasOwn(BUILTIN_AUDIENCES, id)
      ? BUILTIN_AUDIENCES[id as keyof typeof BUILTIN_AUDIENCES]
      : undefined,
};

const PRINCIPAL_TYPE_NOUNS: Record<PrincipalType, string> = {
  human: 'people',
  agent: 'agents',
  service: 'services',
  anonymous: 'anonymous visitors',
};

const ROLE_NOUNS: Record<TenantRole, string> = {
  owner: 'owners',
  admin: 'admins',
  staff: 'staff',
  member: 'members',
  viewer: 'viewers',
};

export function describe(segment: Segment, options?: DescribeOptions): string {
  const names = options?.audiences ?? builtinNames;
  return render(segment, names);
}

function render(segment: Segment, names: DescribeOptions['audiences']): string {
  if ('all' in segment) return renderAll(segment.all, names);
  if ('any' in segment) {
    if (segment.any.length === 0) return 'no one';
    return segment.any.map((c) => render(c, names)).join(', or ');
  }
  if ('not' in segment) {
    const inner = segment.not;
    if ('all' in inner && inner.all.length === 0) return 'no one';
    if ('any' in inner && inner.any.length === 0) return 'everyone';
    return `anyone except ${render(inner, names)}`;
  }
  if ('principalType' in segment) return PRINCIPAL_TYPE_NOUNS[segment.principalType];
  if ('role' in segment) return ROLE_NOUNS[segment.role];
  if ('tier' in segment) return `customers on the ${segment.tier} tier`;
  if ('audience' in segment) {
    const name = names?.get(segment.audience)?.name;
    return name ? lowerFirst(name) : segment.audience;
  }
  return `principals ${predicate(segment)}`;
}

/**
 * `all`: subjects first ("customers who are also partners"), then predicates. A negated attribute
 * or tier becomes a negated predicate ("whose mfa is not true"); a negated subject reads "who are
 * not partners"; an `any` among several children is parenthesised so precedence stays visible.
 */
function renderAll(children: readonly Segment[], names: DescribeOptions['audiences']): string {
  if (children.length === 0) return 'everyone';
  const subjects: string[] = [];
  const predicates: string[] = [];
  for (const child of children) {
    if (isAttr(child)) predicates.push(predicate(child));
    else if ('tier' in child) predicates.push(`on the ${child.tier} tier`);
    else if ('not' in child && isAttr(child.not)) predicates.push(negatedPredicate(child.not));
    else if ('not' in child && 'tier' in child.not)
      predicates.push(`not on the ${child.not.tier} tier`);
    else if ('not' in child && !isEmptyCombinator(child.not)) {
      predicates.push(`who are not ${render(child.not, names)}`);
    } else if ('any' in child && child.any.length > 1 && children.length > 1) {
      subjects.push(`(${render(child, names)})`);
    } else subjects.push(render(child, names));
  }
  const subject = subjects.length > 0 ? subjects.join(' who are also ') : 'principals';
  return predicates.length > 0 ? `${subject} ${predicates.join(' and ')}` : subject;
}

function isEmptyCombinator(segment: Segment): boolean {
  return (
    ('all' in segment && segment.all.length === 0) || ('any' in segment && segment.any.length === 0)
  );
}

function isAttr(segment: Segment): segment is AttrSegment {
  return 'attr' in segment;
}

function predicate(leaf: AttrSegment): string {
  const { attr, op, value } = leaf;
  switch (op) {
    case 'eq':
      return `whose ${attr} is ${fmt(value)}`;
    case 'neq':
      return `whose ${attr} is not ${fmt(value)}`;
    case 'in':
      return `whose ${attr} is one of ${fmt(value)}`;
    case 'gte':
      return `whose ${attr} is at least ${fmt(value)}`;
    case 'lte':
      return `whose ${attr} is at most ${fmt(value)}`;
    case 'exists':
      return value === false ? `who have no ${attr}` : `who have a ${attr}`;
  }
}

/** The predicate of `{ not: leaf }`, read as a single clause. */
function negatedPredicate(leaf: AttrSegment): string {
  const { attr, op, value } = leaf;
  switch (op) {
    case 'eq':
      return `whose ${attr} is not ${fmt(value)}`;
    case 'neq':
      return `whose ${attr} is ${fmt(value)}`;
    case 'in':
      return `whose ${attr} is not one of ${fmt(value)}`;
    case 'gte':
      return `whose ${attr} is less than ${fmt(value)}`;
    case 'lte':
      return `whose ${attr} is more than ${fmt(value)}`;
    case 'exists':
      return value === false ? `who have a ${attr}` : `who have no ${attr}`;
  }
}

function fmt(value: SegmentValue | undefined): string {
  if (value === undefined) return 'nothing';
  if (Array.isArray(value)) {
    const parts = value.map((v) => fmt(v));
    if (parts.length <= 1) return parts.join('');
    return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
  }
  return String(value);
}

/** "Support staff" -> "support staff", but "VIP customers" and "EU accounts" keep their acronym. */
function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
