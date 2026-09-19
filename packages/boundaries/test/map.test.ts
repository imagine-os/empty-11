/**
 * The committed dependency map describes this tree (PAP-305).
 */

import { describe, expect, it } from 'vitest';
import {
  buildDependencyMap,
  owningPackage,
  renderDependencyMapMarkdown,
  resolveSpecifier,
} from '../src/map.js';
import { findRepoRoot, loadOwnership } from '../src/repo.js';

const repoRoot = findRepoRoot();
const ownership = loadOwnership(repoRoot);
const map = buildDependencyMap(repoRoot, ownership);

describe('the dependency map', () => {
  it('has a node for every ownership entry', () => {
    expect(map.nodes).toHaveLength(Object.keys(ownership.packages).length);
    expect(map.nodes.find((node) => node.id === 'packages/pm')).toMatchObject({
      kind: 'module',
      owner: 'pm-linear',
      optional: true,
      present: true,
    });
  });

  it('has no undeclared import edge', () => {
    const undeclared = map.edges
      .filter((edge) => edge.kind === 'import' && edge.undeclared)
      .map((edge) => `${edge.from} -> ${edge.to} (${(edge.via ?? []).join(', ')})`);
    expect(
      undeclared,
      'either add the dependency to allowedDeps in ownership.json or reach the code through a contract port',
    ).toEqual([]);
  });

  it('resolves @paperos specifiers and relative imports to their package', () => {
    expect(resolveSpecifier(ownership, 'packages/views/src/index.ts', '@paperos/core')).toBe(
      'packages/core',
    );
    expect(
      resolveSpecifier(ownership, 'packages/views/src/index.ts', '@paperos/contract-quality'),
    ).toBe('packages/contracts/quality');
    expect(
      resolveSpecifier(ownership, 'packages/views/src/index.ts', '../../core/src/index.js'),
    ).toBe('packages/core');
    expect(resolveSpecifier(ownership, 'packages/views/src/index.ts', 'node:fs')).toBeUndefined();
  });

  it('attributes a file to the longest matching directory', () => {
    expect(owningPackage(ownership, 'packages/contracts/quality/src/index.ts')).toBe(
      'packages/contracts/quality',
    );
  });

  it('renders Mermaid with a subgraph per kind and the owners table', () => {
    const markdown = renderDependencyMapMarkdown(map);
    expect(markdown).toContain('```mermaid');
    expect(markdown).toContain('subgraph core["core"]');
    expect(markdown).toContain('| `packages/pm` | module | pm-linear |');
    expect(markdown.startsWith('<!-- GENERATED FILE')).toBe(true);
  });
});
