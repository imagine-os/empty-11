/**
 * `validatePageSpec`: schema validation plus the cross-reference and gate rules
 * the Zod schema cannot express on its own. Every issue names its path; when a
 * `Locator` is supplied (by `parseSpec`) it also carries line and column.
 */
import { z } from 'zod';
import {
  didYouMean,
  formatPath,
  hasErrors,
  SPEC_CODES,
  type SpecIssue,
  type SpecIssueCode,
  type SpecPosition,
  type SpecSeverity,
} from './issues.js';
import { err, ok, type Result } from './result.js';
import type { Component } from './schema/components.js';
import {
  CURRENT_SPEC_VERSION,
  type KNOWN_STATES,
  PAGE_SPEC_KEYS,
  PAGE_SPEC_SHAPE,
  type PageSpec,
  PageSpecSchema,
  RESERVED_KEYS,
} from './schema/page.js';
import {
  COMPONENT_REF_RE,
  EXTERNAL_URL_RE,
  MESSAGE_KEY_RE,
  PERMISSION_RE,
  ROUTE_REF_RE,
} from './schema/refs.js';
import type { Locator } from './yaml/positions.js';

export interface ValidateOptions {
  /** File the spec came from; `meta.id` must equal its stem (`customer-invoices.spec.yaml` → `customer-invoices`). */
  filename?: string;
  /** Every route the app declares. When given, `events[].to` must be one of them (or the page's own route). */
  knownRoutes?: readonly string[];
  /** Internal: positions of the source document (set by `parseSpec`). */
  locator?: Locator;
}

export type ValidationResult = Result<PageSpec, SpecIssue[]>;

type Path = ReadonlyArray<PropertyKey>;

interface IssueInit {
  hint?: string;
  related?: SpecPosition[];
  severity?: SpecSeverity;
  /** Point at the mapping key rather than the value. */
  atKey?: boolean;
  /** Locate the issue at another path (a gate about a missing section points at `meta.status`). */
  at?: Path;
}

class Collector {
  readonly issues: SpecIssue[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly locator: Locator | undefined) {}

  add(code: SpecIssueCode, path: Path, message: string, init: IssueInit = {}): void {
    const pathText = formatPath(path);
    const dedupe = `${code}:${pathText}`;
    if (this.seen.has(dedupe)) return;
    this.seen.add(dedupe);
    const where = init.at ?? path;
    const located = init.atKey ? this.locator?.locateKey(where) : this.locator?.locate(where);
    const issue: SpecIssue = {
      code,
      severity: init.severity ?? SPEC_CODES[code].severity,
      message,
      path: pathText,
    };
    if (located) {
      issue.line = located.line;
      issue.col = located.col;
    }
    if (init.hint) issue.hint = init.hint;
    if (init.related && init.related.length > 0) issue.related = init.related;
    this.issues.push(issue);
  }

  position(path: Path): SpecPosition | undefined {
    const located = this.locator?.locate(path);
    return located ? { ...located, path: formatPath(path) } : undefined;
  }
}

/** Validate a parsed document (a plain object) as a page spec. */
export function validatePageSpec(value: unknown, options: ValidateOptions = {}): ValidationResult {
  const issues = new Collector(options.locator);

  if (!isRecord(value)) {
    issues.add(
      'SPEC_NOT_OBJECT',
      [],
      'a page spec is a YAML mapping with `meta`, `purpose`, `layout` and friends',
      {
        hint: 'start the file with `meta:` and see docs/platform/page-spec.md for the section list',
      },
    );
    return err(issues.issues, issues.issues);
  }

  if (!checkVersion(value, issues)) return err(errorsIn(issues), sortIssues(issues.issues));
  checkTopLevelKeys(value, issues);

  const parsed = PageSpecSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) mapZodIssue(issue, value, issues);
    return err(errorsIn(issues), sortIssues(issues.issues));
  }

  const spec = parsed.data;
  checkFilename(spec, options, issues);
  const tree = checkComponents(spec, issues);
  checkReferences(spec, tree, issues);
  checkTransitions(spec, tree, options, issues);
  checkGates(spec, value, tree, issues);

  const all = sortIssues(issues.issues);
  return hasErrors(all)
    ? err(
        all.filter((i) => i.severity === 'error'),
        all,
      )
    : ok(spec, all);
}

function errorsIn(collector: Collector): SpecIssue[] {
  return sortIssues(collector.issues).filter((issue) => issue.severity === 'error');
}

function sortIssues(issues: SpecIssue[]): SpecIssue[] {
  const rank = (issue: SpecIssue): [number, number] => [
    issue.line ?? Number.MAX_SAFE_INTEGER,
    issue.col ?? 0,
  ];
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => {
      const [al, ac] = rank(a.issue);
      const [bl, bc] = rank(b.issue);
      return al - bl || ac - bc || a.index - b.index;
    })
    .map(({ issue }) => issue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Version and top-level keys
// ---------------------------------------------------------------------------

function checkVersion(value: Record<string, unknown>, issues: Collector): boolean {
  const meta = value.meta;
  if (!isRecord(meta)) return true; // the schema reports the missing `meta`
  const version = meta.specVersion;
  if (version === undefined) {
    issues.add(
      'SPEC_VERSION_MISSING',
      ['meta'],
      `\`meta.specVersion\` is missing; reading the spec as version ${CURRENT_SPEC_VERSION}`,
      { hint: `add \`specVersion: ${CURRENT_SPEC_VERSION}\` under \`meta\``, atKey: true },
    );
    return true;
  }
  if (version !== CURRENT_SPEC_VERSION) {
    issues.add(
      'SPEC_UNSUPPORTED_VERSION',
      ['meta', 'specVersion'],
      `\`meta.specVersion\` is ${JSON.stringify(version)}; this package understands version ${CURRENT_SPEC_VERSION} only`,
      {
        hint: 'run the migration once the target version exists (docs/platform/page-spec-versioning.md)',
      },
    );
    return false;
  }
  return true;
}

function checkTopLevelKeys(value: Record<string, unknown>, issues: Collector): void {
  const known = PAGE_SPEC_KEYS as readonly string[];
  const suggestions = known.filter((key) => !(RESERVED_KEYS as readonly string[]).includes(key));
  for (const key of Object.keys(value)) {
    if (key.startsWith('x-')) continue;
    if ((RESERVED_KEYS as readonly string[]).includes(key)) {
      if (value[key] !== undefined) {
        issues.add(
          'SPEC_RESERVED_KEY',
          [key],
          `\`${key}\` is reserved for spec v1.1 and is not validated yet`,
          {
            hint: 'PAP-740 adds the section schema; until then the value passes through unchecked',
            atKey: true,
          },
        );
      }
      continue;
    }
    if (known.includes(key)) continue;
    const guess = didYouMean(key, suggestions);
    issues.add('SPEC_UNKNOWN_KEY', [key], `unknown top-level key \`${key}\``, {
      hint: guess
        ? `did you mean \`${guess}\`? Extensions must be prefixed \`x-\``
        : 'extensions must be prefixed `x-`',
      atKey: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Zod issue mapping
// ---------------------------------------------------------------------------

interface PatternCode {
  re: RegExp;
  code: SpecIssueCode;
  hint: (input: unknown, path: Path, specId: string | undefined) => string;
}

const PATTERN_CODES: PatternCode[] = [
  {
    re: ROUTE_REF_RE,
    code: 'SPEC_BAD_ROUTE',
    hint: (input) =>
      typeof input === 'string' && input.includes(':')
        ? `use TanStack \`$param\` segments: \`${input.replace(/:([A-Za-z0-9_]+)/g, '$$$1')}\``
        : 'routes are absolute, lowercase, with `$param` segments: `/invoices/$invoiceId`',
  },
  {
    re: COMPONENT_REF_RE,
    code: 'SPEC_BAD_COMPONENT_REF',
    hint: () =>
      'component ids are `ui.<name>`, `app.<name>` or `print.<name>` from the PAP-74 registry',
  },
  {
    re: MESSAGE_KEY_RE,
    code: 'SPEC_LITERAL_COPY',
    hint: (input, path, specId) => {
      const key = `${specId ?? '<specId>'}.${formatPath(path).replace(/\[(\d+)\]/g, '.$1')}`;
      const text = typeof input === 'string' ? input : '';
      return `declare a message key and keep the English text as its default: \`{ id: ${key}, default: ${JSON.stringify(text)} }\``;
    },
  },
  {
    re: PERMISSION_RE,
    code: 'SPEC_BAD_PERMISSION',
    hint: () => 'permissions are `public` or dotted: `page.view`, `invoice.pay`',
  },
];

function patternCode(pattern: string | undefined): PatternCode | undefined {
  if (!pattern) return undefined;
  const source = pattern.startsWith('/') ? pattern.slice(1, pattern.lastIndexOf('/')) : pattern;
  return PATTERN_CODES.find((entry) => entry.re.source === source);
}

function specIdOf(value: Record<string, unknown>): string | undefined {
  const meta = value.meta;
  return isRecord(meta) && typeof meta.id === 'string' ? meta.id : undefined;
}

function mapZodIssue(
  issue: z.core.$ZodIssue,
  root: Record<string, unknown>,
  issues: Collector,
): void {
  const path = issue.path as Path;
  const input = valueAt(root, path);
  const specId = specIdOf(root);

  switch (issue.code) {
    case 'invalid_format': {
      const entry = patternCode('pattern' in issue ? (issue.pattern as string) : undefined);
      if (entry) {
        issues.add(entry.code, path, issue.message, { hint: entry.hint(input, path, specId) });
      } else {
        issues.add('SPEC_FORMAT', path, issue.message);
      }
      return;
    }
    case 'invalid_union': {
      const nested = flattenUnion(issue);
      const formatIssue = nested.find((n) => n.code === 'invalid_format');
      const entry = formatIssue
        ? patternCode((formatIssue as { pattern?: string }).pattern)
        : undefined;
      if (entry) {
        issues.add(entry.code, path, formatIssue?.message ?? issue.message, {
          hint: entry.hint(input, path, specId),
        });
        return;
      }
      issues.add('SPEC_TYPE', path, describeUnion(issue, input));
      return;
    }
    case 'invalid_type': {
      const missing = input === undefined;
      const last = path[path.length - 1];
      const message = missing
        ? `missing required key \`${String(last)}\` (expected ${issue.expected})`
        : `expected ${issue.expected}, received ${typeOf(input)}`;
      issues.add('SPEC_TYPE', missing ? path.slice(0, -1) : path, message, {
        ...(missing ? { atKey: true } : {}),
      });
      return;
    }
    case 'invalid_value': {
      const values = issue.values.map((v) => String(v));
      const guess = typeof input === 'string' ? didYouMean(input, values) : undefined;
      issues.add(
        'SPEC_ENUM',
        path,
        `\`${String(input)}\` is not one of ${values.map((v) => `\`${v}\``).join(', ')}`,
        {
          hint: guess ? `did you mean \`${guess}\`?` : `allowed: ${values.join(' | ')}`,
        },
      );
      return;
    }
    case 'unrecognized_keys': {
      const candidates = candidateKeysAt(path);
      for (const key of issue.keys) {
        const guess = didYouMean(key, candidates);
        issues.add(
          'SPEC_UNKNOWN_KEY',
          [...path, key],
          `unknown key \`${key}\` under \`${formatPath(path) || 'root'}\``,
          {
            hint: guess ? `did you mean \`${guess}\`?` : `allowed keys: ${candidates.join(', ')}`,
            atKey: true,
          },
        );
      }
      return;
    }
    case 'invalid_key': {
      const nested = flattenUnion({
        code: 'invalid_union',
        errors: [issue.issues],
      } as z.core.$ZodIssueInvalidUnion);
      const formatIssue = nested.find((n) => n.code === 'invalid_format');
      const last = path[path.length - 1];
      issues.add(
        'SPEC_BAD_KEY',
        path,
        `key \`${String(last)}\` is not allowed here: ${formatIssue?.message ?? issue.message}`,
        {
          atKey: true,
        },
      );
      return;
    }
    case 'too_small':
    case 'too_big':
      issues.add('SPEC_RANGE', path, issue.message);
      return;
    case 'custom': {
      const code = (issue.params as { code?: SpecIssueCode } | undefined)?.code;
      if (code && code in SPEC_CODES) {
        issues.add(code, path, issue.message, { atKey: true });
      } else {
        issues.add('SPEC_TYPE', path, issue.message);
      }
      return;
    }
    default:
      issues.add('SPEC_TYPE', path, issue.message);
  }
}

function flattenUnion(issue: z.core.$ZodIssueInvalidUnion): z.core.$ZodIssue[] {
  const out: z.core.$ZodIssue[] = [];
  for (const branch of issue.errors) {
    for (const nested of branch) {
      if (nested.code === 'invalid_union') out.push(...flattenUnion(nested));
      else out.push(nested);
    }
  }
  return out;
}

function describeUnion(issue: z.core.$ZodIssueInvalidUnion, input: unknown): string {
  const expected = new Set<string>();
  for (const nested of flattenUnion(issue)) {
    if (nested.code === 'invalid_type') expected.add(nested.expected);
  }
  const list = [...expected];
  return list.length > 0
    ? `expected ${list.join(' or ')}, received ${typeOf(input)}`
    : `value does not match any allowed shape (received ${typeOf(input)})`;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function valueAt(root: unknown, path: Path): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current;
}

interface LooseDef {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  valueType?: z.ZodType;
  innerType?: z.ZodType;
  getter?: () => z.ZodType;
  in?: z.ZodType;
  options?: z.ZodType[];
}

function defOf(schema: z.ZodType): LooseDef {
  return schema._zod.def as unknown as LooseDef;
}

/** Keys the schema allows at `path`, for "did you mean" hints on unknown keys. */
export function candidateKeysAt(path: Path): string[] {
  let current: z.ZodType | undefined = z.object(PAGE_SPEC_SHAPE);
  for (const segment of path) {
    current = current ? stepInto(current, segment) : undefined;
  }
  const target = current ? unwrap(current) : undefined;
  const shape = target ? defOf(target).shape : undefined;
  return shape ? Object.keys(shape) : [];
}

function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (let i = 0; i < 16; i++) {
    const def = defOf(current);
    if (def.innerType) current = def.innerType;
    else if (def.type === 'lazy' && def.getter) current = def.getter();
    else if (def.type === 'pipe' && def.in) current = def.in;
    else if (def.type === 'union' && def.options) {
      const object = def.options.map(unwrap).find((option) => defOf(option).type === 'object');
      if (!object) return current;
      current = object;
    } else return current;
  }
  return current;
}

function stepInto(schema: z.ZodType, segment: PropertyKey): z.ZodType | undefined {
  const target = unwrap(schema);
  const def = defOf(target);
  if (def.type === 'object' && def.shape) return def.shape[String(segment)];
  if (def.type === 'array') return def.element;
  if (def.type === 'record') return def.valueType;
  return undefined;
}

// ---------------------------------------------------------------------------
// Cross-reference rules
// ---------------------------------------------------------------------------

function checkFilename(spec: PageSpec, options: ValidateOptions, issues: Collector): void {
  if (!options.filename) return;
  const stem = options.filename
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.spec\.ya?ml$|\.ya?ml$/i, '');
  if (stem && stem !== spec.meta.id) {
    issues.add(
      'SPEC_ID_FILENAME',
      ['meta', 'id'],
      `\`meta.id\` is \`${spec.meta.id}\` but the file is \`${stem}.spec.yaml\``,
      {
        hint: `rename the file to \`${spec.meta.id}.spec.yaml\` or set \`meta.id: ${stem}\``,
      },
    );
  }
}

interface ComponentIndex {
  keys: Map<string, Path>;
  notWired: Path[];
}

function checkComponents(spec: PageSpec, issues: Collector): ComponentIndex {
  const index: ComponentIndex = { keys: new Map(), notWired: [] };
  const declaredSlots = Object.keys(spec.layout.slots);

  const visit = (component: Component, path: Path): void => {
    const keyPath = [...path, 'key'];
    const first = index.keys.get(component.key);
    if (first) {
      const firstPos = issues.position(first);
      const secondPos = issues.position(keyPath);
      const where =
        firstPos && secondPos
          ? ` (lines ${firstPos.line} and ${secondPos.line})`
          : ` (${formatPath(first)} and ${formatPath(keyPath)})`;
      issues.add(
        'SPEC_DUP_COMPONENT_KEY',
        keyPath,
        `component key \`${component.key}\` is used twice${where}`,
        {
          hint: 'keys are page-unique; codegen, tours and comments anchor on them',
          ...(firstPos ? { related: [firstPos] } : {}),
        },
      );
    } else {
      index.keys.set(component.key, keyPath);
    }
    if (component.status === 'not-wired') index.notWired.push(path);
    if (declaredSlots.length > 0 && !declaredSlots.includes(component.slot)) {
      issues.add(
        'SPEC_SLOT_UNDECLARED',
        [...path, 'slot'],
        `component \`${component.key}\` targets slot \`${component.slot}\`, which \`layout.slots\` does not list`,
        {
          hint: `add \`${component.slot}: {}\` under \`layout.slots\` or move the component`,
        },
      );
    }
    component.children.forEach((child, i) => {
      visit(child, [...path, 'children', i]);
    });
  };

  spec.components.forEach((component, i) => {
    visit(component, ['components', i]);
  });
  return index;
}

function checkReferences(spec: PageSpec, tree: ComponentIndex, issues: Collector): void {
  const actions = Object.keys(spec.logic.actions);
  const unbound = (path: Path, action: string, atKey = false): void => {
    const guess = didYouMean(action, actions);
    issues.add(
      'SPEC_ACTION_UNBOUND',
      path,
      `action \`${action}\` is not declared under \`logic.actions\``,
      {
        hint: guess
          ? `did you mean \`${guess}\`?`
          : `declare \`logic.actions.${action}\` with intent, permission and steps`,
        atKey,
      },
    );
  };

  const visit = (component: Component, path: Path): void => {
    for (const [event, action] of Object.entries(component.events)) {
      if (!actions.includes(action)) unbound([...path, 'events', event], action);
    }
    component.children.forEach((child, i) => {
      visit(child, [...path, 'children', i]);
    });
  };
  spec.components.forEach((component, i) => {
    visit(component, ['components', i]);
  });

  for (const [name, state] of Object.entries(spec.states)) {
    if (state.action && !actions.includes(state.action))
      unbound(['states', name, 'action'], state.action);
  }

  if (spec.access) {
    for (const name of Object.keys(spec.access.actions)) {
      if (!actions.includes(name)) unbound(['access', 'actions', name], name, true);
    }
  }

  const edgeIds = new Map<string, Path>();
  spec.edgeCases.forEach((edge, i) => {
    const idPath: Path = ['edgeCases', i, 'id'];
    const first = edgeIds.get(edge.id);
    if (first) {
      const firstPos = issues.position(first);
      issues.add('SPEC_DUP_EDGE_ID', idPath, `edge case id \`${edge.id}\` is used twice`, {
        ...(firstPos ? { related: [firstPos] } : {}),
      });
    } else {
      edgeIds.set(edge.id, idPath);
    }
    if (edge.action && !actions.includes(edge.action))
      unbound(['edgeCases', i, 'action'], edge.action);
  });

  void tree;
}

function checkTransitions(
  spec: PageSpec,
  tree: ComponentIndex,
  options: ValidateOptions,
  issues: Collector,
): void {
  const actions = Object.keys(spec.logic.actions);
  const known = options.knownRoutes
    ? new Set([...options.knownRoutes, spec.meta.route].map(normaliseRoute))
    : undefined;
  const ready = spec.meta.status === 'ready';

  spec.events.forEach((transition, i) => {
    const base: Path = ['events', i];
    const [head, tail] = transition.on.split('.');
    if (head === 'page' && (tail === 'load' || tail === 'leave')) {
      // lifecycle source
    } else if (tail === undefined) {
      if (head && !actions.includes(head)) {
        const guess = didYouMean(head, actions);
        issues.add(
          'SPEC_ACTION_UNBOUND',
          [...base, 'on'],
          `transition source \`${head}\` is not declared under \`logic.actions\``,
          {
            hint: guess
              ? `did you mean \`${guess}\`?`
              : 'use an action id, `componentKey.onEvent`, `page.load` or `page.leave`',
          },
        );
      }
    } else if (head && !tree.keys.has(head)) {
      const guess = didYouMean(head, [...tree.keys.keys()]);
      issues.add(
        'SPEC_EVENT_SOURCE',
        [...base, 'on'],
        `no component with key \`${head}\` for transition source \`${transition.on}\``,
        {
          hint: guess
            ? `did you mean \`${guess}.${tail}\`?`
            : 'the key must match a `components[].key`',
        },
      );
    }

    const isUrl = EXTERNAL_URL_RE.test(transition.to);
    if (isUrl && transition.kind !== 'external') {
      issues.add(
        'SPEC_EVENT_KIND',
        [...base, 'kind'],
        `\`to\` is a URL, so \`kind\` must be \`external\` (is \`${transition.kind}\`)`,
        {
          hint: 'set `kind: external` or point `to` at a route',
        },
      );
    } else if (!isUrl && transition.kind === 'external') {
      issues.add(
        'SPEC_EVENT_KIND',
        [...base, 'to'],
        '`kind: external` needs an http(s) URL in `to`',
        {
          hint: 'use `kind: navigate` for in-app routes',
        },
      );
    } else if (!isUrl && known && !known.has(normaliseRoute(transition.to))) {
      issues.add(
        'SPEC_ROUTE_UNRESOLVED',
        [...base, 'to'],
        `route \`${transition.to}\` is not declared by any page`,
        {
          hint: 'add the page spec for that route or fix the path',
          severity: ready ? 'error' : 'warning',
        },
      );
    }
  });
}

function normaliseRoute(route: string): string {
  return route.length > 1 ? route.replace(/\/+$/, '') : route;
}

function checkGates(
  spec: PageSpec,
  raw: Record<string, unknown>,
  tree: ComponentIndex,
  issues: Collector,
): void {
  const statusPath: Path = ['meta', 'status'];
  if (spec.meta.status === 'ready') {
    if (!spec.access) {
      issues.add(
        'SPEC_READY_INCOMPLETE',
        ['access'],
        '`status: ready` requires an `access` section',
        {
          hint: 'declare `access.view` (audiences) and `access.actions`, or set `status: draft`',
          at: statusPath,
        },
      );
    }
    if (!spec.data && raw['x-static'] !== true) {
      issues.add(
        'SPEC_READY_INCOMPLETE',
        ['data'],
        '`status: ready` requires a `data` section or `x-static: true`',
        {
          hint: 'declare the queries and mutations, or mark a page without data `x-static: true`',
          at: statusPath,
        },
      );
    }
    if (spec.edgeCases.length < 3) {
      issues.add(
        'SPEC_READY_INCOMPLETE',
        ['edgeCases'],
        `\`status: ready\` requires at least three edge cases (has ${spec.edgeCases.length})`,
        {
          hint: 'think empty, denied, offline, concurrent edit, oversized input',
          atKey: true,
          ...(spec.edgeCases.length === 0 ? { at: statusPath } : {}),
        },
      );
    }
    const missing = missingStates(spec);
    if (missing.length > 0) {
      issues.add(
        'SPEC_READY_STATES',
        ['states'],
        `\`status: ready\` page has no ${missing.map((s) => `\`${s}\``).join(', ')} state`,
        {
          hint: `declare ${missing.join(', ')} under \`states\` with a message key and a state component`,
          atKey: true,
          ...(Object.keys(spec.states).length === 0 ? { at: statusPath } : {}),
        },
      );
    }
  }

  if (spec.meta.status === 'built') {
    for (const path of tree.notWired) {
      issues.add(
        'SPEC_BUILT_NOT_WIRED',
        [...path, 'status'],
        '`status: built` page still has a `not-wired` component',
        {
          hint: 'wire it or set the page back to `ready`',
        },
      );
    }
    for (const [name, action] of Object.entries(spec.logic.actions)) {
      if (action.status === 'not-wired') {
        issues.add(
          'SPEC_BUILT_NOT_WIRED',
          ['logic', 'actions', name, 'status'],
          `\`status: built\` page still has the \`not-wired\` action \`${name}\``,
          {
            hint: 'wire it or set the page back to `ready`',
          },
        );
      }
    }
  }
}

function missingStates(spec: PageSpec): string[] {
  const required = new Set<(typeof KNOWN_STATES)[number]>(['error']);
  if (!spec.access?.public) required.add('denied');
  if (spec.data) {
    required.add('loading');
    required.add('empty');
    if (Object.values(spec.data.queries).some((q) => q.sync !== 'server')) required.add('offline');
  }
  return [...required].filter((state) => !(state in spec.states));
}
