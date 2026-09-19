/**
 * `ownership.json` — the package boundary map (PAP-305, ADR 0026).
 *
 * The repo-root `ownership.json` says who owns every `apps/*`, `packages/*` and
 * `packages/core/src/<folder>` directory, which imports each one may make
 * (`allowedDeps`) and who owns every `@paperos/contract-*`. It is the single
 * source of truth: `.dependency-cruiser.cjs` and `docs/platform/dependency-map.*`
 * are generated from it (`pnpm gen:deps-rules`, `pnpm gen:dep-map`).
 *
 * This module is the *schema*: types plus a dependency-free validator. It stays
 * pure (no `node:*`, no file I/O) so `@paperos/core` keeps its contract-zero
 * promise; the file reading, generation and lint glue live in
 * `@paperos/boundaries`.
 *
 * The PAP-305 spec asks for a Zod schema here. Zod is not in the
 * `pnpm-workspace.yaml` catalog yet and that file has one owner (PAP-13), so the
 * validator below is hand-written with the same `safeParse` shape
 * (`{ ok: true, value } | { ok: false, errors }`). PAP-264 / PAP-433 replace the
 * body with `ModuleOwnership = z.object(...)` when zod enters the catalog; the
 * exported types and the `parseOwnership` signature do not change.
 */

/** Directory kinds. `core` is contract zero, `module` is an optional module. */
export const OWNERSHIP_KINDS = ['core', 'runtime', 'module', 'contract', 'tooling'] as const;

/** Kind of a directory in the boundary map. */
export type OwnershipKind = (typeof OWNERSHIP_KINDS)[number];

/** One `apps/*`, `packages/*` or `packages/core/src/<folder>` entry. */
export interface PackageOwnership {
  /** Project key from the `owners` list — the project whose issues may create files here. */
  readonly owner: string;
  /** Linear identifiers (`PAP-<n>`) of the issues that build it. */
  readonly issues: readonly string[];
  readonly kind: OwnershipKind;
  /** `true` when `paperos create --without <module>` may drop the directory (PAP-22). */
  readonly optional: boolean;
  /**
   * Workspace paths this directory may import, plus `packages/contracts/*`
   * (rule R7). Absent on `packages/core/src/<folder>` entries, which inherit
   * `packages/core`'s empty list.
   */
  readonly allowedDeps?: readonly string[];
  readonly note?: string;
}

/** One `@paperos/contract-*` package (module system section 7). */
export interface ContractOwnership {
  readonly path: string;
  /** Project key of the module that provides the contract; the only one that may bump its version. */
  readonly owner: string;
  /** Character sheet name of the owner agent. */
  readonly ownerAgent: string;
  readonly requires: readonly string[];
  readonly swapRisk: 'low' | 'medium' | 'high' | 'critical';
}

/** Paths a generator owns, with the issue that generates them. */
export interface GeneratedPathExemption {
  readonly glob: string;
  readonly by: string;
}

/** Glob sets the boundary lint treats specially. */
export interface OwnershipExemptions {
  readonly testFiles: readonly string[];
  readonly notCruised: readonly string[];
  readonly generated: readonly GeneratedPathExemption[];
  /** Directories allowed to import React (rule R6). */
  readonly react: readonly string[];
}

/** The parsed `ownership.json`. */
export interface Ownership {
  readonly version: number;
  readonly generated: boolean;
  readonly issue: string;
  readonly adr: string;
  readonly doc: string;
  readonly sections: Readonly<Record<string, string>>;
  /** The project keys that may appear as an `owner`. */
  readonly owners: readonly string[];
  readonly kinds: Readonly<Record<string, string>>;
  readonly packages: Readonly<Record<string, PackageOwnership>>;
  readonly contracts: Readonly<Record<string, ContractOwnership>>;
  readonly exempt: OwnershipExemptions;
}

/** One validation failure: where it is and what is wrong. */
export interface OwnershipError {
  readonly path: string;
  readonly message: string;
}

/** `safeParse`-shaped result. */
export type OwnershipParseResult =
  | { readonly ok: true; readonly value: Ownership }
  | { readonly ok: false; readonly errors: readonly OwnershipError[] };

const ISSUE_RE = /^PAP-\d+$/;
const SWAP_RISKS = ['low', 'medium', 'high', 'critical'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Is `dep` allowed by an `allowedDeps` entry? Entries are workspace paths, with
 * one trailing `*` wildcard allowed (`packages/contracts/*`).
 */
export function matchesDep(pattern: string, dep: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return dep.startsWith(prefix) && !dep.slice(prefix.length).includes('/');
  }
  return pattern === dep;
}

/**
 * Cycles in `allowedDeps`, each as the list of packages that close the loop.
 * A boundary map that allows a cycle is a bug: it is what R9's acyclic contract
 * graph and Biome's `noImportCycles` both rely on.
 */
export function findAllowedDepCycles(
  packages: Readonly<Record<string, { readonly allowedDeps?: readonly string[] }>>,
): string[][] {
  const names = Object.keys(packages);
  const edges = new Map<string, string[]>();
  for (const name of names) {
    const patterns = packages[name]?.allowedDeps ?? [];
    edges.set(
      name,
      names.filter((other) => other !== name && patterns.some((p) => matchesDep(p, other))),
    );
  }
  const cycles: string[][] = [];
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const walk = (node: string): void => {
    const seen = state.get(node);
    if (seen === 'done') return;
    if (seen === 'open') {
      const start = stack.indexOf(node);
      if (start >= 0) cycles.push([...stack.slice(start), node]);
      return;
    }
    state.set(node, 'open');
    stack.push(node);
    for (const next of edges.get(node) ?? []) walk(next);
    stack.pop();
    state.set(node, 'done');
  };
  for (const name of names) walk(name);
  return cycles;
}

function checkPackage(
  key: string,
  raw: unknown,
  owners: readonly string[],
  errors: OwnershipError[],
): void {
  const at = `packages.${key}`;
  if (!isRecord(raw)) {
    errors.push({ path: at, message: 'must be an object' });
    return;
  }
  if (typeof raw.owner !== 'string' || !owners.includes(raw.owner)) {
    errors.push({
      path: `${at}.owner`,
      message: `unknown owner ${JSON.stringify(raw.owner)}: must be one of the project keys in "owners"`,
    });
  }
  if (!isStringArray(raw.issues) || raw.issues.length === 0) {
    errors.push({ path: `${at}.issues`, message: 'must be a non-empty array of PAP identifiers' });
  } else {
    for (const issue of raw.issues) {
      if (!ISSUE_RE.test(issue)) {
        errors.push({ path: `${at}.issues`, message: `${issue} is not a PAP-<n> identifier` });
      }
    }
  }
  if (typeof raw.kind !== 'string' || !(OWNERSHIP_KINDS as readonly string[]).includes(raw.kind)) {
    errors.push({
      path: `${at}.kind`,
      message: `must be one of ${OWNERSHIP_KINDS.join(', ')}`,
    });
  }
  if (typeof raw.optional !== 'boolean') {
    errors.push({ path: `${at}.optional`, message: 'must be a boolean' });
  }
  if (raw.allowedDeps !== undefined && !isStringArray(raw.allowedDeps)) {
    errors.push({ path: `${at}.allowedDeps`, message: 'must be an array of workspace paths' });
  }
  if (raw.note !== undefined && typeof raw.note !== 'string') {
    errors.push({ path: `${at}.note`, message: 'must be a string' });
  }
}

function checkAllowedDepTargets(packages: Record<string, unknown>, errors: OwnershipError[]): void {
  const known = Object.keys(packages);
  for (const [key, raw] of Object.entries(packages)) {
    if (!isRecord(raw) || !isStringArray(raw.allowedDeps)) continue;
    for (const dep of raw.allowedDeps) {
      if (!known.some((name) => matchesDep(dep, name))) {
        errors.push({
          path: `packages.${key}.allowedDeps`,
          message: `${dep} matches no entry in "packages"`,
        });
      }
    }
    if (raw.allowedDeps.includes(key)) {
      errors.push({
        path: `packages.${key}.allowedDeps`,
        message: 'must not list itself: a package may always import its own files',
      });
    }
  }
}

function checkContracts(raw: unknown, owners: readonly string[], errors: OwnershipError[]): void {
  if (!isRecord(raw)) {
    errors.push({ path: 'contracts', message: 'must be an object' });
    return;
  }
  for (const [name, entry] of Object.entries(raw)) {
    const at = `contracts.${name}`;
    if (!name.startsWith('@paperos/contract-')) {
      errors.push({ path: at, message: 'key must be an @paperos/contract-* package name' });
    }
    if (!isRecord(entry)) {
      errors.push({ path: at, message: 'must be an object' });
      continue;
    }
    if (typeof entry.path !== 'string' || !entry.path.startsWith('packages/contracts/')) {
      errors.push({ path: `${at}.path`, message: 'must be a packages/contracts/* path' });
    }
    if (typeof entry.owner !== 'string' || !owners.includes(entry.owner)) {
      errors.push({ path: `${at}.owner`, message: 'unknown owner project key' });
    }
    if (typeof entry.ownerAgent !== 'string' || entry.ownerAgent.length === 0) {
      errors.push({ path: `${at}.ownerAgent`, message: 'must name the owning character' });
    }
    if (!isStringArray(entry.requires)) {
      errors.push({ path: `${at}.requires`, message: 'must be an array of contract names' });
    }
    if (
      typeof entry.swapRisk !== 'string' ||
      !(SWAP_RISKS as readonly string[]).includes(entry.swapRisk)
    ) {
      errors.push({ path: `${at}.swapRisk`, message: `must be one of ${SWAP_RISKS.join(', ')}` });
    }
  }
}

/**
 * Validate a parsed `ownership.json`. Never throws: it returns every problem it
 * found so one run of `pnpm lint:deps` shows the whole list.
 */
export function parseOwnership(input: unknown): OwnershipParseResult {
  const errors: OwnershipError[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '', message: 'ownership.json must be an object' }] };
  }
  if (input.version !== 1) {
    errors.push({ path: 'version', message: 'only version 1 is understood' });
  }
  if (!isStringArray(input.owners) || input.owners.length === 0) {
    errors.push({ path: 'owners', message: 'must list the project keys' });
  }
  const owners = isStringArray(input.owners) ? input.owners : [];
  if (!isRecord(input.packages)) {
    errors.push({ path: 'packages', message: 'must be an object keyed by directory path' });
  } else {
    for (const [key, raw] of Object.entries(input.packages)) {
      if (!/^(apps|packages)\//.test(key)) {
        errors.push({
          path: `packages.${key}`,
          message: 'key must be an apps/* or packages/* path',
        });
      }
      checkPackage(key, raw, owners, errors);
    }
    checkAllowedDepTargets(input.packages, errors);
    for (const cycle of findAllowedDepCycles(
      input.packages as Record<string, { allowedDeps?: string[] }>,
    )) {
      errors.push({ path: 'packages', message: `allowedDeps cycle: ${cycle.join(' -> ')}` });
    }
  }
  checkContracts(input.contracts, owners, errors);
  if (!isRecord(input.exempt)) {
    errors.push({ path: 'exempt', message: 'must be an object' });
  } else {
    for (const field of ['testFiles', 'notCruised', 'react'] as const) {
      if (!isStringArray(input.exempt[field])) {
        errors.push({ path: `exempt.${field}`, message: 'must be an array of globs' });
      }
    }
    if (!Array.isArray(input.exempt.generated)) {
      errors.push({ path: 'exempt.generated', message: 'must be an array of { glob, by }' });
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: input as unknown as Ownership };
}

/** The entry that owns `path`, or `undefined` when nothing claims it. */
export function ownerOf(ownership: Ownership, path: string): PackageOwnership | undefined {
  return ownership.packages[path];
}

/** Every directory of a given kind, in `ownership.json` order. */
export function packagesOfKind(ownership: Ownership, kind: OwnershipKind): string[] {
  return Object.entries(ownership.packages)
    .filter(([, entry]) => entry.kind === kind)
    .map(([key]) => key);
}

/** May `from` import `to`? Self-imports and unknown sources are allowed. */
export function isAllowedDep(ownership: Ownership, from: string, to: string): boolean {
  if (from === to) return true;
  const entry = ownership.packages[from];
  if (entry?.allowedDeps === undefined) return true;
  return entry.allowedDeps.some((pattern) => matchesDep(pattern, to));
}
