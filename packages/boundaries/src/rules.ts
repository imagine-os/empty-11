/**
 * Generate the dependency-cruiser rule set from `ownership.json` (PAP-305).
 *
 * One source of truth: `.dependency-cruiser.cjs` is written by
 * `pnpm gen:deps-rules` and a test fails when the committed copy has drifted.
 * Rule ids are the ones the docs argue about — R1-R6 from Interface & Data
 * Contracts §5, R7-R11 from Module System §3, plus R12 for the curated
 * `@paperos/core` barrel:
 *
 * | Rule | Statement |
 * | -- | -- |
 * | R1 | `packages/core/**` imports no workspace package (contract zero). |
 * | R2 | `packages/db` imports only `core` among implementation packages. |
 * | R3 | An optional module imports the shared platform packages and contracts, never another module. |
 * | R4 | `apps/*` import packages, never another app; modules only through the kernel. |
 * | R5 | Nobody imports generated files or `drizzle/*.sql`. |
 * | R6 | React only in the UI layers named in `exempt.react`. |
 * | R7 | Any package may import any `@paperos/contract-*` (except core, which imports nothing). |
 * | R8 | No package imports another module's implementation package, type-only imports included. |
 * | R9 | `packages/contracts/**` imports only core and other contracts; the graph is acyclic. |
 * | R10 | `packages/kernel` imports core and contracts, never a module. |
 * | R11 | A module imports its own contract's `conformance/` only from test files. |
 * | R12 | The `@paperos/core` barrel re-exports sub-folder indexes, nothing deeper. |
 */

import type { Ownership, PackageOwnership } from '@paperos/core';
import { globToRegexSource } from './glob.js';

/** A dependency-cruiser `forbidden` rule, as it is written to the config. */
export interface CruiserRule {
  name: string;
  severity: 'error' | 'warn' | 'info';
  comment: string;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
}

/** The generated config object: `module.exports` of `.dependency-cruiser.cjs`. */
export interface CruiserConfig {
  forbidden: CruiserRule[];
  options: Record<string, unknown>;
}

/** Options for generating against a fixture tree instead of the repo root. */
export interface GenerateOptions {
  /** Repo-relative prefix every path regex is anchored under. Default `''`. */
  readonly pathPrefix?: string;
}

const CONTRACTS_GLOB = 'packages/contracts/*';

function slug(path: string): string {
  return path.replace(/[^a-zA-Z0-9]+/g, '-');
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Anchored regex source for everything inside a workspace directory. */
function dirRe(prefix: string, path: string): string {
  if (path === CONTRACTS_GLOB) return `^${escapeRe(prefix)}packages/contracts/[^/]+/`;
  return `^${escapeRe(prefix)}${escapeRe(path)}/`;
}

function isCoreFolder(key: string): boolean {
  return key.startsWith('packages/core/src/');
}

function ruleFamily(key: string, entry: PackageOwnership): string {
  if (key.startsWith('apps/')) return 'R4';
  if (key === 'packages/core') return 'R1';
  if (key === 'packages/db') return 'R2';
  if (key === 'packages/kernel') return 'R10';
  if (entry.kind === 'module') return 'R3';
  if (entry.kind === 'contract') return 'R9';
  return 'R8';
}

const FAMILY_ADVICE: Record<string, string> = {
  R1: 'packages/core is contract zero: it imports no other workspace package, so everyone can import it.',
  R2: 'among implementation packages, packages/db imports only @paperos/core; other modules contribute src/schema/<module>.ts through the generator.',
  R3: 'optional modules couple through @paperos/core/events, a @paperos/contract-* port or the kernel, never by import.',
  R4: 'apps import packages, never another app; they compose modules through the kernel (composeRoutes, UI slots).',
  R8: "add the dependency to this package's allowedDeps in ownership.json (owner review) or reach the code through a contract port.",
  R9: 'a contract package holds types, schemas, topics and ports only: it imports @paperos/core and other contracts, nothing else.',
  R10: 'the kernel is the one place a cross-module dependency may exist, and it holds it as a contract port, not as an import.',
};

/** Every module-kind directory, longest path first so regexes stay unambiguous. */
function moduleKeys(ownership: Ownership): string[] {
  return Object.entries(ownership.packages)
    .filter(([key, entry]) => entry.kind === 'module' && !isCoreFolder(key))
    .map(([key]) => key);
}

function generatedRegexes(ownership: Ownership, prefix: string): string[] {
  return ownership.exempt.generated.map((entry) =>
    globToRegexSource(`${prefix}${entry.glob}`.replace(/^\^/, '')),
  );
}

function testFileRegexes(ownership: Ownership, prefix: string): string[] {
  return ownership.exempt.testFiles.map((glob) => globToRegexSource(`${prefix}${glob}`));
}

function perSourceRule(
  ownership: Ownership,
  prefix: string,
  key: string,
  entry: PackageOwnership,
  moduleDirs: readonly string[],
): CruiserRule {
  const allowed = entry.allowedDeps ?? [];
  const family = ruleFamily(key, entry);
  const allowedList = allowed.length > 0 ? allowed.join(', ') : 'nothing';
  return {
    name: `${family}-${slug(key)}-allowed-deps`,
    severity: 'error',
    comment:
      `${family} ${key} may import only ${allowedList} — ${FAMILY_ADVICE[family] ?? ''} ` +
      `Owner: ${entry.owner} (ownership.json packages."${key}", issues ${entry.issues.join(', ')}).`,
    from: { path: dirRe(prefix, key), pathNot: testFileRegexes(ownership, prefix) },
    to: {
      path: `^${escapeRe(prefix)}(apps|packages)/`,
      pathNot: [
        dirRe(prefix, key),
        ...allowed.map((dep) => dirRe(prefix, dep)),
        // Cross-module imports get their own rule so the message can name the
        // owner of the module being imported.
        ...moduleDirs.filter((dir) => dir !== key).map((dir) => dirRe(prefix, dir)),
        ...generatedRegexes(ownership, prefix),
      ],
    },
  };
}

function perModuleTargetRule(
  ownership: Ownership,
  prefix: string,
  target: string,
  entry: PackageOwnership,
): CruiserRule {
  const allowedSources = Object.entries(ownership.packages)
    .filter(([key, source]) => {
      if (key === target || isCoreFolder(key)) return false;
      const deps = source.allowedDeps;
      return deps === undefined || deps.some((dep) => dep === target);
    })
    .map(([key]) => key);
  return {
    name: `R3-cross-module-${slug(target)}`,
    severity: 'error',
    comment:
      `R3/R8 -> ${target}: optional modules must couple via @paperos/core/events, a ` +
      `@paperos/contract-* port or the kernel, never by importing another module's ` +
      `implementation (type-only imports included). Owner: ${entry.owner} — ask them for a ` +
      `contract port (ownership.json packages."${target}", issues ${entry.issues.join(', ')}).`,
    from: {
      path: `^${escapeRe(prefix)}(apps|packages)/`,
      pathNot: [
        dirRe(prefix, target),
        ...allowedSources.map((source) => dirRe(prefix, source)),
        ...testFileRegexes(ownership, prefix),
      ],
    },
    to: { path: dirRe(prefix, target) },
  };
}

function staticRules(ownership: Ownership, prefix: string): CruiserRule[] {
  const reactAllowed = ownership.exempt.react.map((dir) => dirRe(prefix, dir));
  return [
    {
      name: 'R9-no-circular',
      severity: 'error',
      comment:
        'R9 the import graph is acyclic — the contract graph especially. A cycle means two ' +
        'packages are really one: split the shared part into @paperos/core or a contract.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'R5-no-generated-or-sql',
      severity: 'error',
      comment:
        'R5 generated files and SQL belong to their generator, not to you: ' +
        `${ownership.exempt.generated.map((entry) => `${entry.glob} (${entry.by})`).join('; ')}. ` +
        "Import the generator's typed output instead, and re-run the generator to change it.",
      from: { path: `^${escapeRe(prefix)}(apps|packages)/` },
      to: {
        path: [...generatedRegexes(ownership, prefix), `^${escapeRe(prefix)}.*\\.sql$`],
      },
    },
    {
      name: 'R6-react-only-in-ui-layers',
      severity: 'error',
      comment:
        'R6 React lives in the UI layers only ' +
        `(${ownership.exempt.react.join(', ')}). Everything else is pure TypeScript so it can ` +
        'run in a worker, in the API and in a test without a DOM.',
      from: { path: `^${escapeRe(prefix)}(apps|packages)/`, pathNot: reactAllowed },
      to: { dependencyTypes: ['npm'], path: '^react(-dom)?(/|$)' },
    },
    {
      name: 'R11-conformance-only-from-tests',
      severity: 'error',
      comment:
        "R11 a contract's conformance/ suite is test-only: import it from **/*.test.ts or " +
        '**/test/**, never from shipped code.',
      from: {
        path: `^${escapeRe(prefix)}(apps|packages)/`,
        pathNot: testFileRegexes(ownership, prefix),
      },
      to: { path: `^${escapeRe(prefix)}packages/contracts/[^/]+/conformance/` },
    },
    {
      name: 'R12-core-barrel-reexports-folder-indexes',
      severity: 'error',
      comment:
        'R12 packages/core/src/index.ts is a curated barrel: it re-exports ' +
        './<folder>/index.js and nothing deeper, so each sub-folder owner decides what leaves ' +
        'their folder (ownership.json packages."packages/core/src/*").',
      from: { path: `^${escapeRe(prefix)}packages/core/src/index\\.ts$` },
      to: {
        path: `^${escapeRe(prefix)}packages/core/src/[^/]+/.+`,
        pathNot: `^${escapeRe(prefix)}packages/core/src/[^/]+/index\\.ts$`,
      },
    },
  ];
}

/** Options block: how dependency-cruiser resolves and what it never walks into. */
export function generateOptions(ownership: Ownership, prefix: string): Record<string, unknown> {
  return {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: ['node_modules'] },
    exclude: {
      path: ownership.exempt.notCruised.map((glob) => globToRegexSource(`${prefix}${glob}`)),
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  };
}

/** The whole rule set, generated from the boundary map. */
export function generateRuleSet(
  ownership: Ownership,
  options: GenerateOptions = {},
): CruiserConfig {
  const prefix = options.pathPrefix ?? '';
  const moduleDirs = moduleKeys(ownership);
  const perSource: CruiserRule[] = [];
  for (const [key, entry] of Object.entries(ownership.packages)) {
    if (isCoreFolder(key) || entry.allowedDeps === undefined) continue;
    perSource.push(perSourceRule(ownership, prefix, key, entry, moduleDirs));
  }
  const perTarget = moduleDirs.map((target) =>
    perModuleTargetRule(ownership, prefix, target, ownership.packages[target] as PackageOwnership),
  );
  return {
    forbidden: [...staticRules(ownership, prefix), ...perSource, ...perTarget],
    options: generateOptions(ownership, prefix),
  };
}

/** The text of `.dependency-cruiser.cjs`, header and all. */
export function renderConfigFile(config: CruiserConfig): string {
  return [
    '/**',
    ' * GENERATED FILE — do not edit.',
    ' *',
    ' * Written by `pnpm gen:deps-rules` from `ownership.json` (PAP-305, ADR 0026).',
    ' * Change the boundary map, re-run the generator, commit both. A test fails when',
    ' * this file and `ownership.json` disagree.',
    ' *',
    ' * Run it with `pnpm lint:deps`. Every rule id is explained in',
    ' * `docs/platform/package-boundaries.md`.',
    ' */',
    '',
    `module.exports = ${JSON.stringify(config, null, 2)};`,
    '',
  ].join('\n');
}

/** A Biome config fragment: the same cross-module ban, for editor feedback. */
export interface BiomeBoundaries {
  overrides: Array<{
    includes: string[];
    linter: {
      rules: {
        style: {
          noRestrictedImports: {
            level: 'error';
            options: { paths: Record<string, string> };
          };
        };
      };
    };
  }>;
}

/**
 * Mirror rule R3 as Biome's `noRestrictedImports` so the editor underlines a
 * cross-module import the moment it is typed, instead of at `pnpm lint:deps`.
 * Biome sees package names, not paths, so this is a subset of the real rule:
 * dependency-cruiser stays the gate.
 */
export function generateBiomeBoundaries(ownership: Ownership): BiomeBoundaries {
  const modules = moduleKeys(ownership);
  const packageName = (key: string): string => `@paperos/${key.slice('packages/'.length)}`;
  const overrides = Object.entries(ownership.packages)
    .filter(([key, entry]) => !isCoreFolder(key) && entry.allowedDeps !== undefined)
    .map(([key, entry]) => {
      const banned = modules.filter(
        (target) => target !== key && !(entry.allowedDeps ?? []).includes(target),
      );
      if (banned.length === 0) return undefined;
      const paths: Record<string, string> = {};
      for (const target of banned) {
        const owner = ownership.packages[target]?.owner ?? 'unknown';
        paths[packageName(target)] =
          `R3/R8: ${key} may not import the ${target} module. Couple through ` +
          `@paperos/core/events, a @paperos/contract-* port or the kernel (owner: ${owner}).`;
      }
      return {
        includes: [`${key}/**`],
        linter: {
          rules: {
            style: {
              noRestrictedImports: { level: 'error' as const, options: { paths } },
            },
          },
        },
      };
    })
    .filter((override): override is NonNullable<typeof override> => override !== undefined);
  return { overrides };
}
