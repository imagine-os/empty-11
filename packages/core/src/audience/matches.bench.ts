/**
 * `pnpm --filter @paperos/core exec vitest bench --run src/audience` — the spec's budget is a
 * median under 50 µs at depth 6. Numbers land in `docs/evidence/PAP-55/bench.txt`.
 */
import { bench, describe } from 'vitest';
import { BUILTIN_AUDIENCES } from './builtin.js';
import { matches } from './matches.js';
import type { Segment } from './segment.js';

const staff = BUILTIN_AUDIENCES['staff-support'].examples.matching;
const deep: Segment = {
  all: [
    {
      any: [
        {
          all: [
            {
              any: [
                {
                  all: [
                    { not: { role: 'owner' } },
                    { attr: 'staffRole', op: 'eq', value: 'support' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    { audience: 'staff-support' },
    { attr: 'mfa', op: 'eq', value: true },
  ],
};

describe('matches', () => {
  bench('leaf', () => {
    matches(staff, { role: 'staff' });
  });
  bench('depth 6 with an audience reference', () => {
    matches(staff, deep);
  });
  bench('all fifteen built-ins', () => {
    for (const a of Object.values(BUILTIN_AUDIENCES)) matches(staff, a.match);
  });
});
