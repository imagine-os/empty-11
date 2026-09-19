import { describe, expect, it } from 'vitest';
import { and, defineFields, type FilterTree, or, toSql } from './index.js';

const fields = defineFields({
  name: { type: 'string' },
  email: { type: 'string', caseInsensitive: true },
  amount: { type: 'number' },
  status: { type: 'enum', values: ['open', 'closed', 'paused'] },
  due: { type: 'date' },
  tags: { type: 'array', items: 'string' },
  meta: { type: 'json' },
});

/** 50 conditions across 10 groups, the spec's perf fixture. */
function fixture(): FilterTree {
  const groups: FilterTree[] = [];
  for (let g = 0; g < 10; g += 1) {
    groups.push(
      or(
        { field: 'name', operator: 'contains', value: `ada${g}` },
        { field: 'email', operator: 'eq', value: `user${g}@example.com` },
        { field: 'amount', operator: 'between', value: [g, g + 10] },
        { field: 'status', operator: 'in', value: ['open', 'paused'] },
        { field: 'meta', operator: 'matches', value: { path: ['a', String(g)], equals: g } },
      ),
    );
  }
  return and(...groups);
}

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
}

describe('toSql performance', () => {
  it('compiles a 50-condition tree in under 1 ms (median of 200 runs after warm-up)', () => {
    const tree = fixture();
    const ctx = { fields };
    for (let i = 0; i < 100; i += 1) toSql(tree, 'things', ctx);
    const samples: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const start = performance.now();
      toSql(tree, 'things', ctx);
      samples.push(performance.now() - start);
    }
    const ms = median(samples);
    // eslint-disable-next-line no-console
    console.info(`toSql 50 conditions: median ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(1);
  });
});
