/**
 * `pnpm --filter @paperos/core modules:validate [--json] [--root <dir>]`
 *
 * Finds every `module.manifest.json` in the workspace, validates the whole set
 * with {@link validateManifests} and prints one row per module. Exit code 0
 * when there is no error-severity diagnostic, 1 otherwise, so CI and the swap
 * CLI can gate on it.
 *
 * The walk and the `package.json` reads are the only impure part of the module
 * system: `manifest.ts` stays pure and takes what this file found as data.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  type ContractPackageInfo,
  type Diagnostic,
  type ModuleManifest,
  ModuleManifestSchema,
  validateManifests,
} from './manifest.js';

const MANIFEST_FILE = 'module.manifest.json';
/**
 * `fixtures` is skipped so the eighteen golden manifests do not masquerade as
 * real modules once the real ones land (they would collide on
 * `DUPLICATE_PROVIDER`). `run()` falls back to them while no real manifest
 * exists, which is what makes the PAP-433 demo work on an empty workspace.
 */
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.turbo',
  '.vite',
  'fixtures',
]);

/** Where the golden manifests live, relative to a workspace root. */
export const GOLDEN_FIXTURES = join('packages', 'core', 'src', 'modules', 'fixtures');

export interface DiscoveredManifest {
  /** Path relative to the workspace root, for the table and for error output. */
  readonly file: string;
  readonly manifest: unknown;
}

/** Walk up from `start` to the folder holding `pnpm-workspace.yaml`. */
export function findWorkspaceRoot(start: string): string {
  let current = resolve(start);
  for (;;) {
    try {
      statSync(join(current, 'pnpm-workspace.yaml'));
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) return resolve(start);
      current = parent;
    }
  }
}

/** Every `module.manifest.json` under `root`, sorted by path. */
export function findManifests(root: string): DiscoveredManifest[] {
  const found: DiscoveredManifest[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        walk(join(directory, entry.name));
        continue;
      }
      if (entry.name !== MANIFEST_FILE) continue;
      const file = join(directory, entry.name);
      found.push({ file: relative(root, file), manifest: JSON.parse(readFileSync(file, 'utf8')) });
    }
  };
  walk(root);
  return found.sort((a, b) => a.file.localeCompare(b.file));
}

/** Contract packages under `packages/contracts/*`, keyed by package name. */
export function findContractPackages(root: string): Record<string, ContractPackageInfo> {
  const contracts: Record<string, ContractPackageInfo> = {};
  const directory = join(root, 'packages', 'contracts');
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return contracts;
  }
  for (const entry of entries) {
    try {
      const pkg = JSON.parse(readFileSync(join(directory, entry, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (typeof pkg.name === 'string') contracts[pkg.name] = { version: pkg.version };
    } catch {
      /* A folder without a package.json is not a contract package. */
    }
  }
  return contracts;
}

const STATUS_SYMBOL = { ok: 'ok', warn: 'warn', error: 'FAIL' } as const;

export interface TableRow {
  readonly module: string;
  readonly kind: string;
  readonly provides: string;
  readonly requires: string;
  readonly swapRisk: string;
  readonly status: (typeof STATUS_SYMBOL)[keyof typeof STATUS_SYMBOL];
  readonly file: string;
}

export function buildRows(
  found: readonly DiscoveredManifest[],
  diagnostics: readonly Diagnostic[],
): TableRow[] {
  return found.map(({ file, manifest }) => {
    const parsed = ModuleManifestSchema.safeParse(manifest);
    const id = parsed.success ? parsed.data.id : ((manifest as { id?: string } | null)?.id ?? file);
    const mine = diagnostics.filter((diagnostic) => diagnostic.module === id);
    const status = mine.some((diagnostic) => diagnostic.severity === 'error')
      ? STATUS_SYMBOL.error
      : mine.length > 0
        ? STATUS_SYMBOL.warn
        : STATUS_SYMBOL.ok;
    const data = parsed.success ? (parsed.data as ModuleManifest) : undefined;
    return {
      module: id,
      kind: data?.kind ?? '?',
      provides: String(data?.provides.length ?? '?'),
      requires: String(data?.requires.length ?? '?'),
      swapRisk: data?.swapRisk ?? '?',
      status,
      file,
    };
  });
}

/** Fixed-width table; plain ASCII so it is readable in any CI log. */
export function renderTable(rows: readonly TableRow[]): string {
  const header: TableRow = {
    module: 'MODULE',
    kind: 'KIND',
    provides: 'PROV',
    requires: 'REQ',
    swapRisk: 'SWAP RISK',
    status: 'STATUS' as TableRow['status'],
    file: 'FILE',
  };
  const all = [header, ...rows];
  const columns = ['module', 'kind', 'provides', 'requires', 'swapRisk', 'status', 'file'] as const;
  const widths = columns.map((column) => Math.max(...all.map((row) => row[column].length)));
  const line = (row: TableRow): string =>
    columns
      .map((column, index) => row[column].padEnd(widths[index] as number))
      .join('  ')
      .trimEnd();
  const rule = widths.map((width) => '-'.repeat(width)).join('  ');
  return [line(header), rule, ...rows.map(line)].join('\n');
}

export function renderDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const where = diagnostic.path === undefined ? '' : ` (${diagnostic.path})`;
      return `${diagnostic.severity === 'error' ? 'error' : 'warn '} ${diagnostic.code} ${diagnostic.module}${where}: ${diagnostic.message}`;
    })
    .join('\n');
}

export interface RunResult {
  readonly exitCode: 0 | 1;
  readonly output: string;
}

/** The whole CLI as a pure-ish function, so the tests do not spawn a process. */
export function run(argv: readonly string[], cwd: string): RunResult {
  if (argv.includes('--fix')) {
    return {
      exitCode: 1,
      output:
        '--fix is not wired yet (reserved for PAP-552). Run without it to see the diagnostics.',
    };
  }
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag === -1 ? findWorkspaceRoot(cwd) : resolve(cwd, argv[rootFlag + 1] ?? '.');
  let found = findManifests(root);
  /* No real module has a manifest yet: validate the golden fixtures instead, so
     `modules:validate` shows the eighteen reference manifests rather than an
     empty table. The goldens are self-contained, so no contract information is
     passed for them. */
  let fromFixtures = false;
  if (found.length === 0) {
    const fixtures = join(root, GOLDEN_FIXTURES);
    if (existsSync(fixtures)) {
      found = findManifests(fixtures).map((entry) => ({
        ...entry,
        file: join(GOLDEN_FIXTURES, entry.file),
      }));
      fromFixtures = found.length > 0;
    }
  }
  const contracts = fromFixtures ? {} : findContractPackages(root);
  const { ok, diagnostics } = validateManifests(
    found.map((entry) => entry.manifest),
    Object.keys(contracts).length > 0 ? { contracts } : {},
  );
  const rows = buildRows(found, diagnostics);
  if (argv.includes('--json')) {
    return {
      exitCode: ok ? 0 : 1,
      output: JSON.stringify({ ok, root, fromFixtures, rows, diagnostics }, null, 2),
    };
  }
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.length - errors;
  const parts = [
    renderTable(rows),
    '',
    `${rows.length} manifest${rows.length === 1 ? '' : 's'}, ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}.${
      fromFixtures ? ' No module ships a manifest yet, so these are the golden fixtures.' : ''
    }`,
  ];
  if (diagnostics.length > 0) parts.splice(1, 0, '', renderDiagnostics(diagnostics));
  return { exitCode: ok ? 0 : 1, output: parts.join('\n') };
}

/* Script entry point: the tests drive `run()` directly. */
if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  const result = run(process.argv.slice(2), process.cwd());
  process.stdout.write(`${result.output}\n`);
  process.exitCode = result.exitCode;
}
