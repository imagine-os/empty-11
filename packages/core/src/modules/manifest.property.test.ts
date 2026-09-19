/**
 * Property tests for cycle detection. Random `requires` graphs, with and
 * without a cycle: the validator must agree with a plain reachability check,
 * and when it reports `CYCLE` the path it names must be a real cycle.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type ModuleManifestInput, validateManifest, validateManifests } from './manifest.js';

const idOf = (index: number): string => `mod-${index}`;
const contractOf = (index: number): string => `@paperos/contract-mod-${index}`;

function buildModule(index: number, edges: readonly number[]): ModuleManifestInput {
  return {
    id: idOf(index),
    kind: 'process',
    version: '0.1.0',
    owner: { agent: 'Atlas', project: 'module-system' },
    provides: [{ contract: contractOf(index), version: '0.1.0' }],
    requires: edges.map((target) => ({ contract: contractOf(target), range: '^0.1.0' })),
    swapRisk: 'low',
  };
}

/** True when `from` can reach itself by following the edges. */
function hasCycleThrough(from: number, edges: ReadonlyMap<number, readonly number[]>): boolean {
  const stack = [...(edges.get(from) ?? [])];
  const seen = new Set<number>();
  while (stack.length > 0) {
    const current = stack.pop() as number;
    if (current === from) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(edges.get(current) ?? []));
  }
  return false;
}

/** A graph of `size` modules where every edge points at a lower index: acyclic by construction. */
const acyclicGraph = fc
  .integer({ min: 2, max: 8 })
  .chain((size) =>
    fc.tuple(
      fc.constant(size),
      fc.array(fc.array(fc.nat({ max: size - 2 }), { maxLength: 3 }), {
        minLength: size,
        maxLength: size,
      }),
    ),
  )
  .map(([size, raw]) => {
    const edges = new Map<number, number[]>();
    for (let index = 0; index < size; index += 1) {
      edges.set(index, [...new Set((raw[index] ?? []).filter((target) => target < index))]);
    }
    return { size, edges };
  });

/** Any graph at all: edges may point anywhere, so cycles happen. */
const anyGraph = fc.integer({ min: 2, max: 7 }).chain((size) =>
  fc
    .array(fc.array(fc.nat({ max: size - 1 }), { maxLength: 3 }), {
      minLength: size,
      maxLength: size,
    })
    .map((raw) => {
      const edges = new Map<number, number[]>();
      for (let index = 0; index < size; index += 1) {
        edges.set(index, [...new Set((raw[index] ?? []).filter((target) => target !== index))]);
      }
      return { size, edges };
    }),
);

const manifestsOf = ({
  size,
  edges,
}: {
  size: number;
  edges: ReadonlyMap<number, readonly number[]>;
}) => Array.from({ length: size }, (_unused, index) => buildModule(index, edges.get(index) ?? []));

describe('cycle detection (property)', () => {
  it('never reports a cycle in an acyclic graph', () => {
    fc.assert(
      fc.property(acyclicGraph, (graph) => {
        const result = validateManifests(manifestsOf(graph));
        expect(result.diagnostics.filter((diagnostic) => diagnostic.code === 'CYCLE')).toEqual([]);
        expect(result.ok).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('agrees with plain reachability on any graph', () => {
    fc.assert(
      fc.property(anyGraph, (graph) => {
        const manifests = manifestsOf(graph);
        for (let index = 0; index < graph.size; index += 1) {
          const others = manifests.filter((_unused, other) => other !== index);
          const diagnostics = validateManifest(manifests[index], { others }).diagnostics.filter(
            (diagnostic) => diagnostic.code === 'CYCLE',
          );
          expect(diagnostics.length > 0).toBe(hasCycleThrough(index, graph.edges));
        }
      }),
      { numRuns: 150 },
    );
  });

  it('names a path that really is a cycle', () => {
    fc.assert(
      fc.property(anyGraph, (graph) => {
        const manifests = manifestsOf(graph);
        for (let index = 0; index < graph.size; index += 1) {
          const others = manifests.filter((_unused, other) => other !== index);
          for (const diagnostic of validateManifest(manifests[index], { others }).diagnostics) {
            if (diagnostic.code !== 'CYCLE') continue;
            const path = diagnostic.related as string[];
            expect(path[0]).toBe(idOf(index));
            expect(path[path.length - 1]).toBe(idOf(index));
            expect(path.length).toBeGreaterThanOrEqual(2);
            for (let step = 0; step < path.length - 1; step += 1) {
              const from = Number((path[step] as string).slice('mod-'.length));
              const to = Number((path[step + 1] as string).slice('mod-'.length));
              expect(graph.edges.get(from)).toContain(to);
            }
            expect(diagnostic.message).toContain(path.join(' -> '));
          }
        }
      }),
      { numRuns: 150 },
    );
  });
});
