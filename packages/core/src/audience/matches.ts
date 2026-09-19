/**
 * `matches(principal, segment)` — pure, allocation-light, never throws on attribute
 * lookups. It throws only for a broken registry: an unknown audience reference or a
 * reference cycle, both of which `validateAudiences` catches ahead of time.
 */
import type { AudienceId } from './audience-id.js';
import { BUILTIN_AUDIENCES } from './builtin.js';
import { AudienceCycleError, UnknownAudienceError } from './errors.js';
import type { AttributeValue, Principal } from './principal.js';
import type { AttrSegment, Segment, SegmentScalar, SegmentValue } from './segment.js';

/** Resolves an audience id to its segment. Registries implement it; `matches` only reads. */
export interface AudienceResolver {
  resolve(id: AudienceId): Segment | undefined;
}

export type MatchOptions = {
  /** Where `{ audience: id }` leaves are looked up. Defaults to the built-in audiences. */
  audiences?: AudienceResolver | undefined;
};

/** The built-ins alone. `createAudienceRegistry` builds richer resolvers on top. */
const builtinResolver: AudienceResolver = {
  resolve: (id) =>
    Object.hasOwn(BUILTIN_AUDIENCES, id)
      ? BUILTIN_AUDIENCES[id as keyof typeof BUILTIN_AUDIENCES].match
      : undefined,
};

/** `true` when `principal` belongs to `segment`. */
export function matches(principal: Principal, segment: Segment, options?: MatchOptions): boolean {
  const resolver = options?.audiences ?? builtinResolver;
  return evaluate(principal, segment, resolver, undefined);
}

function evaluate(
  principal: Principal,
  segment: Segment,
  resolver: AudienceResolver,
  visiting: AudienceId[] | undefined,
): boolean {
  if ('all' in segment) {
    for (const child of segment.all) {
      if (!evaluate(principal, child, resolver, visiting)) return false;
    }
    return true;
  }
  if ('any' in segment) {
    for (const child of segment.any) {
      if (evaluate(principal, child, resolver, visiting)) return true;
    }
    return false;
  }
  if ('not' in segment) return !evaluate(principal, segment.not, resolver, visiting);
  if ('principalType' in segment) return principal.type === segment.principalType;
  if ('role' in segment) return compareEq(attribute(principal, 'role'), segment.role);
  if ('tier' in segment) return compareEq(attribute(principal, 'tier'), segment.tier);
  if ('audience' in segment) {
    const id = segment.audience;
    const target = resolver.resolve(id);
    if (target === undefined) throw new UnknownAudienceError(id);
    const stack = visiting ?? [];
    if (stack.includes(id)) throw new AudienceCycleError([...stack, id]);
    stack.push(id);
    const result = evaluate(principal, target, resolver, stack);
    stack.pop();
    return result;
  }
  return evaluateAttr(principal, segment);
}

function attribute(principal: Principal, name: string): AttributeValue | undefined {
  const attrs = principal.attributes;
  return Object.hasOwn(attrs, name) ? attrs[name] : undefined;
}

function evaluateAttr(principal: Principal, leaf: AttrSegment): boolean {
  const actual = attribute(principal, leaf.attr);
  const expected = leaf.value;
  switch (leaf.op) {
    case 'exists':
      return (actual !== undefined) === (expected !== false);
    case 'eq':
      return actual !== undefined && compareEq(actual, expected);
    case 'neq':
      return actual !== undefined && !compareEq(actual, expected);
    case 'in':
      return actual !== undefined && compareIn(actual, expected);
    case 'gte':
      return actual !== undefined && compareOrder(actual, expected, (a, b) => a >= b);
    case 'lte':
      return actual !== undefined && compareOrder(actual, expected, (a, b) => a <= b);
  }
}

/** `eq`: an array attribute matches when any element equals the scalar. */
function compareEq(
  actual: AttributeValue | undefined,
  expected: SegmentValue | undefined,
): boolean {
  if (actual === undefined || expected === undefined || Array.isArray(expected)) return false;
  if (Array.isArray(actual)) return actual.includes(expected as string);
  return actual === expected;
}

/** `in`: scalar attribute is one of the listed values; array attribute intersects them. */
function compareIn(actual: AttributeValue, expected: SegmentValue | undefined): boolean {
  if (!Array.isArray(expected)) return false;
  if (Array.isArray(actual)) return actual.some((v) => expected.includes(v));
  return expected.includes(actual);
}

/** `gte` / `lte`: same-typed number or string comparison; arrays match when any element does. */
function compareOrder(
  actual: AttributeValue,
  expected: SegmentValue | undefined,
  cmp: (a: SegmentScalar, b: SegmentScalar) => boolean,
): boolean {
  if (expected === undefined || Array.isArray(expected) || typeof expected === 'boolean')
    return false;
  if (Array.isArray(actual))
    return actual.some((v) => typeof v === typeof expected && cmp(v, expected));
  return typeof actual === typeof expected && cmp(actual, expected);
}
