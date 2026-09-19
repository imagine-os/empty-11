/**
 * `pnpm gen:dep-map` — the committed picture of the dependency graph (PAP-305).
 *
 * Walks every source file under `apps/` and `packages/`, resolves each import
 * to the workspace directory that owns it and writes two files:
 *
 * * `docs/platform/dependency-map.json` — nodes (directories and contracts,
 *   with owner project and Linear issues) and edges (`allowed` from
 *   `ownership.json`, `import` from the code, `requires` between contracts).
 * * `docs/platform/dependency-map.md` — the same graph as Mermaid plus tables.
 *
 * An `import` edge that no `allowed` edge covers is an **undeclared
 * dependency**: it is listed in the map and `pnpm lint:deps` fails on it
 * (Module System §3). The Blueprint's dependency views and the orchestrator's
 * promotion graph read the same JSON, so the picture, the lint and the plan
 * cannot drift apart.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import type { ContractOwnership, Ownership, PackageOwnership } from '@paperos/core';
import { isAllowedDep, matchesDep } from '@paperos/core';
import { matchesAnyGlob } from './glob.js';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]|\bimport\s+['"]([^'"]+)['"]/g;

/** A node of the dependency map: one owned directory. */
export interface MapNode {
  id: string;
  kind: string;
  owner: string;
  optional: boolean;
  issues: readonly string[];
  present: boolean;
}

/** A contract node (module system §7). */
export interface MapContractNode {
  id: string;
  path: string;
  owner: string;
  ownerAgent: string;
  swapRisk: string;
  present: boolean;
}

/** An edge of the dependency map. */
export interface MapEdge {
  from: string;
  to: string;
  kind: 'allowed' | 'import' | 'requires';
  /** `true` for an import edge no `allowedDeps` entry covers. */
  undeclared?: boolean;
  /** Linear issues that own the edge's source. */
  issues?: readonly string[];
  /** Files the import edge was seen in. */
  via?: string[];
}

/** The committed `dependency-map.json`. */
export interface DependencyMap {
  generated: true;
  by: string;
  issue: string;
  adr: string;
  ownershipVersion: number;
  nodes: MapNode[];
  contracts: MapContractNode[];
  edges: MapEdge[];
}

function isSourceFile(path: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function walk(root: string, directory: string, out: string[], skip: readonly string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(join(root, directory));
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    const relativePath = posix.join(directory, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (matchesAnyGlob(skip, relativePath)) continue;
    const absolute = join(root, relativePath);
    if (statSync(absolute).isDirectory()) walk(root, relativePath, out, skip);
    else if (isSourceFile(relativePath)) out.push(relativePath);
  }
}

/** Every source file the map considers, repo-relative and sorted. */
export function sourceFiles(repoRoot: string, ownership: Ownership): string[] {
  const out: string[] = [];
  for (const top of ['apps', 'packages']) walk(repoRoot, top, out, ownership.exempt.notCruised);
  return out.sort();
}

/** The directory key that owns a repo-relative path, longest match first. */
export function owningPackage(ownership: Ownership, path: string): string | undefined {
  return Object.keys(ownership.packages)
    .filter((key) => !key.startsWith('packages/core/src/'))
    .filter((key) => path === key || path.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Resolve one import specifier to the workspace directory it lands in. */
export function resolveSpecifier(
  ownership: Ownership,
  fromFile: string,
  specifier: string,
): string | undefined {
  if (specifier.startsWith('.')) {
    const target = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
    return owningPackage(ownership, target);
  }
  if (!specifier.startsWith('@paperos/')) return undefined;
  const name = specifier.slice('@paperos/'.length).split('/')[0] as string;
  const candidate = name.startsWith('contract-')
    ? `packages/contracts/${name.slice('contract-'.length)}`
    : `packages/${name}`;
  return ownership.packages[candidate] === undefined ? candidate : candidate;
}

/** Every cross-directory import edge found in the working tree. */
export function scanImportEdges(repoRoot: string, ownership: Ownership): MapEdge[] {
  const edges = new Map<string, MapEdge>();
  for (const file of sourceFiles(repoRoot, ownership)) {
    // Test files are exempt from the boundary rules (a test may import another
    // module's fixtures), so they are not part of the shipped graph either.
    if (matchesAnyGlob(ownership.exempt.testFiles, file)) continue;
    const from = owningPackage(ownership, file);
    if (from === undefined) continue;
    const text = readFileSync(join(repoRoot, file), 'utf8');
    for (const match of text.matchAll(IMPORT_RE)) {
      const specifier = match[1] ?? match[2];
      if (specifier === undefined) continue;
      const to = resolveSpecifier(ownership, file, specifier);
      if (to === undefined || to === from) continue;
      const key = `${from} -> ${to}`;
      const entry = ownership.packages[from];
      const existing = edges.get(key);
      if (existing === undefined) {
        edges.set(key, {
          from,
          to,
          kind: 'import',
          undeclared: !isAllowedDep(ownership, from, to),
          issues: entry?.issues ?? [],
          via: [file],
        });
      } else if (!existing.via?.includes(file)) {
        existing.via?.push(file);
      }
    }
  }
  return [...edges.values()].sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`));
}

function exists(repoRoot: string, path: string): boolean {
  try {
    statSync(resolve(repoRoot, path));
    return true;
  } catch {
    return false;
  }
}

/** Build the whole map: nodes, contracts and every edge kind. */
export function buildDependencyMap(repoRoot: string, ownership: Ownership): DependencyMap {
  const nodes: MapNode[] = Object.entries(ownership.packages).map(([id, entry]) => ({
    id,
    kind: entry.kind,
    owner: entry.owner,
    optional: entry.optional,
    issues: entry.issues,
    present: exists(repoRoot, id),
  }));
  const contracts: MapContractNode[] = Object.entries(ownership.contracts).map(
    ([id, entry]: [string, ContractOwnership]) => ({
      id,
      path: entry.path,
      owner: entry.owner,
      ownerAgent: entry.ownerAgent,
      swapRisk: entry.swapRisk,
      present: exists(repoRoot, entry.path),
    }),
  );
  const known = Object.keys(ownership.packages);
  const allowed: MapEdge[] = [];
  for (const [id, entry] of Object.entries<PackageOwnership>(
    ownership.packages as Record<string, PackageOwnership>,
  )) {
    for (const pattern of entry.allowedDeps ?? []) {
      for (const target of known) {
        if (target !== id && matchesDep(pattern, target)) {
          allowed.push({ from: id, to: target, kind: 'allowed', issues: entry.issues });
        }
      }
    }
  }
  const requires: MapEdge[] = Object.entries(ownership.contracts).flatMap(([id, entry]) =>
    entry.requires.map((target) => ({ from: id, to: target, kind: 'requires' as const })),
  );
  return {
    generated: true,
    by: 'pnpm gen:dep-map',
    issue: 'PAP-305',
    adr: 'docs/adr/0026-package-boundaries.md',
    ownershipVersion: ownership.version,
    nodes,
    contracts,
    edges: [...allowed, ...scanImportEdges(repoRoot, ownership), ...requires],
  };
}

function mermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]+/g, '_');
}

function mermaidLabel(id: string): string {
  return id.replace('packages/', '').replace('apps/', 'app:');
}

/** The Mermaid + tables rendering that ships as `dependency-map.md`. */
export function renderDependencyMapMarkdown(map: DependencyMap): string {
  const imports = map.edges.filter((edge) => edge.kind === 'import');
  const undeclared = imports.filter((edge) => edge.undeclared);
  const groups = ['core', 'runtime', 'module', 'contract', 'tooling'];
  const present = map.nodes.filter((node) => node.present && !node.id.includes('/src/'));

  const lines: string[] = [
    '<!-- GENERATED FILE — do not edit. Written by `pnpm gen:dep-map` (PAP-305, ADR 0026). -->',
    '',
    '# Dependency map',
    '',
    'Generated from `ownership.json` and the import graph of the working tree.',
    'Run `pnpm gen:dep-map` after any import or ownership change and commit both files;',
    '`pnpm lint:deps` and the `@paperos/boundaries` tests fail when the committed copy is stale.',
    '',
    `Packages on disk today: **${present.length}**. Import edges: **${imports.length}**, of them undeclared: **${undeclared.length}**.`,
    '',
    '## Imports today',
    '',
    'Solid arrows are imports `ownership.json` allows; thick arrows are undeclared dependencies.',
    '',
    '```mermaid',
    'flowchart LR',
  ];
  for (const group of groups) {
    const members = present.filter((node) => node.kind === group);
    if (members.length === 0) continue;
    lines.push(`  subgraph ${group}["${group}"]`);
    for (const node of members) {
      lines.push(
        `    ${mermaidId(node.id)}["${mermaidLabel(node.id)}<br/><small>${node.owner}</small>"]`,
      );
    }
    lines.push('  end');
  }
  if (imports.length === 0) {
    lines.push('  %% no cross-package imports in the tree yet');
  }
  for (const edge of imports) {
    lines.push(
      `  ${mermaidId(edge.from)} ${edge.undeclared ? '==>|undeclared|' : '-->'} ${mermaidId(edge.to)}`,
    );
  }
  lines.push('```', '');

  lines.push('## Contract graph', '', '```mermaid', 'flowchart LR');
  for (const contract of map.contracts) {
    lines.push(
      `  ${mermaidId(contract.id)}["${contract.id.replace('@paperos/', '')}<br/><small>${contract.owner} · ${contract.swapRisk}</small>"]`,
    );
  }
  for (const edge of map.edges.filter((entry) => entry.kind === 'requires')) {
    if (map.contracts.some((contract) => contract.id === edge.to)) {
      lines.push(`  ${mermaidId(edge.from)} --> ${mermaidId(edge.to)}`);
    }
  }
  lines.push('```', '');

  lines.push(
    '## Undeclared dependencies',
    '',
    ...(undeclared.length === 0
      ? ['None. Every import in the tree is covered by `allowedDeps`.']
      : [
          '| From | To | Seen in | Owner to ask |',
          '| -- | -- | -- | -- |',
          ...undeclared.map((edge) => {
            const owner = map.nodes.find((node) => node.id === edge.to)?.owner ?? 'unknown';
            return `| \`${edge.from}\` | \`${edge.to}\` | ${(edge.via ?? []).map((file) => `\`${file}\``).join(', ')} | ${owner} |`;
          }),
        ]),
    '',
    '## Owners',
    '',
    '| Directory | Kind | Owner | Optional | On disk | Issues |',
    '| -- | -- | -- | -- | -- | -- |',
    ...map.nodes.map(
      (node) =>
        `| \`${node.id}\` | ${node.kind} | ${node.owner} | ${node.optional ? 'yes' : 'no'} | ${node.present ? 'yes' : 'planned'} | ${node.issues.join(', ')} |`,
    ),
    '',
    '## Allowed dependency graph',
    '',
    '| Package | May import |',
    '| -- | -- |',
    ...map.nodes
      .filter((node) => !node.id.includes('/src/'))
      .map((node) => {
        const targets = map.edges
          .filter((edge) => edge.kind === 'allowed' && edge.from === node.id)
          .map((edge) => `\`${edge.to}\``);
        return `| \`${node.id}\` | ${targets.length === 0 ? '— (nothing)' : targets.join(', ')} |`;
      }),
    '',
  );
  return lines.join('\n');
}
