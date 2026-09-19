import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CharacterInput } from './character.ts';
import { validateRoster } from './validate.ts';

function lead(i: number, reportsTo: string): CharacterInput {
  return {
    schemaVersion: 1,
    name: `lead-${i}`,
    displayName: `Lead ${i}`,
    role: 'Generated lead',
    kind: 'lead',
    reportsTo,
    description: 'A generated lead for the property tests of the reportsTo graph rules.',
    budget: { perSessionUsd: 1, perDayUsd: 1, maxTurns: 1 },
    linearLabel: `Character/Lead${String.fromCharCode(65 + (i % 26))}${'x'.repeat(Math.floor(i / 26))}`,
  };
}

describe('reportsTo graph properties', () => {
  it('a roster whose reportsTo edges form a permutation with at least one cycle is always rejected', () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 1, max: 12 })
          .chain((n) =>
            fc.tuple(
              fc.constant(n),
              fc.shuffledSubarray([...Array(n).keys()], { minLength: n, maxLength: n }),
            ),
          ),
        ([n, perm]) => {
          // Every node points at exactly one other node (or itself): a functional graph with n edges
          // over n nodes and no edge to justin has at least one cycle.
          const chars = Array.from({ length: n }, (_, i) => lead(i, `lead-${perm[i] ?? 0}`));
          const r = validateRoster({ schemaVersion: 1, characters: chars });
          expect(r.errors.map((e) => e.code)).toContain('REPORTS_TO_CYCLE');
        },
      ),
    );
  });

  it('a roster where every character reports to an earlier one or justin is always accepted', () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 1, max: 12 })
          .chain((n) =>
            fc.tuple(fc.constant(n), fc.array(fc.nat(), { minLength: n, maxLength: n })),
          ),
        ([n, picks]) => {
          const chars = Array.from({ length: n }, (_, i) => {
            const pick = (picks[i] ?? 0) % (i + 1); // 0..i ; i means justin
            return lead(i, pick === i ? 'justin' : `lead-${pick}`);
          });
          const r = validateRoster({ schemaVersion: 1, characters: chars });
          expect(r.errors.filter((e) => e.code === 'REPORTS_TO_CYCLE')).toEqual([]);
          expect(r.ok).toBe(true);
        },
      ),
    );
  });
});
