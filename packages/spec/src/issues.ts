/**
 * `SpecIssue` and the registry of every code the validator can raise.
 *
 * The registry is the source of the "Issue codes" table in
 * `docs/platform/page-spec.md`; add a row here and regenerate, never edit the doc.
 */

export type SpecSeverity = 'error' | 'warning';

export interface SpecPosition {
  line: number;
  col: number;
  /** Dot path of the related node (`components[1].key`). */
  path?: string;
}

export interface SpecIssue {
  code: SpecIssueCode;
  severity: SpecSeverity;
  message: string;
  /** Dot path from the document root: `meta.route`, `components[2].events.onClick`. `''` is the root. */
  path: string;
  /** 1-based line of the offending node in the normalised (BOM-free, LF) document; absent when validating a plain object. */
  line?: number;
  /** 1-based column. */
  col?: number;
  /** What to do about it, including "did you mean" suggestions. */
  hint?: string;
  /** Other positions involved (the first occurrence of a duplicate, for example). */
  related?: SpecPosition[];
}

export interface SpecCodeInfo {
  severity: SpecSeverity;
  summary: string;
}

export const SPEC_CODES = {
  SPEC_PARSE: { severity: 'error', summary: 'The document is not valid YAML.' },
  SPEC_NOT_OBJECT: { severity: 'error', summary: 'The document root is not a mapping.' },
  SPEC_DUP_KEY: {
    severity: 'error',
    summary: 'A mapping declares the same key twice; both lines are listed.',
  },
  SPEC_TOO_LARGE: {
    severity: 'warning',
    summary: 'The spec is over 200 KB; split sub-flows into their own pages.',
  },
  SPEC_SCHEMA_HEADER: {
    severity: 'warning',
    summary: 'The first line does not point editors at the JSON Schema.',
  },
  SPEC_VERSION_MISSING: {
    severity: 'warning',
    summary: '`meta.specVersion` is missing; the spec is read as version 1.',
  },
  SPEC_UNSUPPORTED_VERSION: {
    severity: 'error',
    summary: '`meta.specVersion` is not a version this package understands.',
  },
  SPEC_UNKNOWN_KEY: {
    severity: 'error',
    summary: 'A key the schema does not know; top-level extensions must be prefixed `x-`.',
  },
  SPEC_RESERVED_KEY: {
    severity: 'warning',
    summary:
      'A v1.1 key (`flags`, `modules`, `comments`, `help`, `seo`, `budgets`) is present and not validated yet (PAP-740).',
  },
  SPEC_TYPE: {
    severity: 'error',
    summary: 'A value has the wrong type or a required key is missing.',
  },
  SPEC_ENUM: { severity: 'error', summary: 'A value is not one of the allowed options.' },
  SPEC_FORMAT: { severity: 'error', summary: 'A string does not match its grammar.' },
  SPEC_RANGE: { severity: 'error', summary: 'A value or list is outside its allowed size.' },
  SPEC_BAD_KEY: { severity: 'error', summary: 'A record key does not match its grammar.' },
  SPEC_BAD_ROUTE: { severity: 'error', summary: 'A route is not TanStack `$param` syntax.' },
  SPEC_BAD_COMPONENT_REF: {
    severity: 'error',
    summary: 'A component id is not `ui.<name>`, `app.<name>` or `print.<name>`.',
  },
  SPEC_LITERAL_COPY: {
    severity: 'error',
    summary: 'User-visible text is a literal string instead of a message catalog key.',
  },
  SPEC_BAD_PERMISSION: { severity: 'error', summary: 'A permission is not `public` or dotted.' },
  SPEC_ID_FILENAME: {
    severity: 'error',
    summary: '`meta.id` does not equal the file name stem.',
  },
  SPEC_DUP_COMPONENT_KEY: {
    severity: 'error',
    summary: 'Two components share a `key`; both lines are listed.',
  },
  SPEC_DUP_EDGE_ID: { severity: 'error', summary: 'Two edge cases share an `id`.' },
  SPEC_ACTION_UNBOUND: {
    severity: 'error',
    summary: 'A reference names an action that is not declared under `logic.actions`.',
  },
  SPEC_EVENT_SOURCE: {
    severity: 'error',
    summary: '`events[].on` names a component key or event that does not exist.',
  },
  SPEC_EVENT_KIND: {
    severity: 'error',
    summary: '`events[].to` is a URL without `kind: external`, or `kind: external` without a URL.',
  },
  SPEC_SLOT_UNDECLARED: {
    severity: 'warning',
    summary: 'A component targets a slot `layout.slots` does not list.',
  },
  SPEC_ROUTE_UNRESOLVED: {
    severity: 'error',
    summary:
      '`events[].to` is not a known route (checked when `knownRoutes` is supplied; error for `ready`, warning otherwise).',
  },
  SPEC_READY_INCOMPLETE: {
    severity: 'error',
    summary:
      '`status: ready` without `access`, without `data` or `x-static: true`, with fewer than three edge cases, or with an unresolvable transition.',
  },
  SPEC_READY_STATES: {
    severity: 'warning',
    summary:
      'A `ready` page lacks a standard state (`error`, `denied`; `loading`, `empty` with data; `offline` with live data).',
  },
  SPEC_BUILT_NOT_WIRED: {
    severity: 'warning',
    summary: 'A `built` page still has `status: not-wired` components or actions.',
  },
} as const satisfies Record<string, SpecCodeInfo>;

export type SpecIssueCode = keyof typeof SPEC_CODES;

/** Error thrown where a `Result` is not possible (`migrateSpec`). Carries the issue. */
export class SpecError extends Error {
  readonly issue: SpecIssue;

  constructor(issue: SpecIssue) {
    super(`${issue.code}: ${issue.message}`);
    this.name = 'SpecError';
    this.issue = issue;
  }
}

export function severityOf(code: SpecIssueCode): SpecSeverity {
  return SPEC_CODES[code].severity;
}

export function hasErrors(issues: readonly SpecIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function errorsOf(issues: readonly SpecIssue[]): SpecIssue[] {
  return issues.filter((issue) => issue.severity === 'error');
}

/** Render a path array (`['components', 2, 'key']`) as `components[2].key`. */
export function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
    } else {
      const key = String(segment);
      if (/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key)) {
        out += out ? `.${key}` : key;
      } else {
        out += `[${JSON.stringify(key)}]`;
      }
    }
  }
  return out;
}

/** Closest candidate by edit distance, for "did you mean" hints. */
export function didYouMean(input: string, candidates: readonly string[]): string | undefined {
  let best: { word: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = levenshtein(input.toLowerCase(), candidate.toLowerCase());
    if (!best || distance < best.distance) best = { word: candidate, distance };
  }
  if (!best) return undefined;
  const limit = Math.max(2, Math.floor(input.length / 3));
  return best.distance <= limit ? best.word : undefined;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
