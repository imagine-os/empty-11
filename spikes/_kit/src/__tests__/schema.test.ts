import { describe, expect, it } from 'vitest';
import { emptyBrowser, emptyBundle, emptyRuntime, SummarySchema } from '../schema.ts';

function validCandidate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    lib: '@tanstack/react-table',
    version: '8.21.3',
    measuredAt: new Date().toISOString(),
    bundle: emptyBundle(),
    runtime: emptyRuntime(),
    browser: emptyBrowser(),
    status: 'ok' as const,
    notes: [],
    ...overrides,
  };
}

describe('SummarySchema', () => {
  it('accepts a fully-null candidate (nothing measured yet)', () => {
    const result = SummarySchema.safeParse({
      spike: 'PAP-292-table-libraries',
      measuredAt: new Date().toISOString(),
      method: 'vite build + playwright, see README',
      candidates: [validCandidate()],
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero standing in for an unmeasured number', () => {
    const result = SummarySchema.safeParse({
      spike: 'PAP-292-table-libraries',
      measuredAt: new Date().toISOString(),
      method: 'vite build + playwright, see README',
      candidates: [
        validCandidate({
          bundle: { gzipBytes: 0, sharedBaselineGzipBytes: 0, notMeasuredReason: 'oops used 0' },
        }),
      ],
    });
    // 0 is a legitimate number here (schema can't tell "not measured" from a
    // real zero-byte bundle); the convention is enforced by code review and
    // this kit's own helpers (`emptyBundle`/`emptyRuntime`/`emptyBrowser`),
    // which is why every measuring function in this kit returns those
    // helpers, never a bare `0`, on failure.
    expect(result.success).toBe(true);
  });

  it('rejects an unknown status', () => {
    const result = SummarySchema.safeParse({
      spike: 'PAP-292-table-libraries',
      measuredAt: new Date().toISOString(),
      method: 'x',
      candidates: [validCandidate({ status: 'maybe' })],
    });
    expect(result.success).toBe(false);
  });

  it('requires measuredAt to be an ISO datetime', () => {
    const result = SummarySchema.safeParse({
      spike: 'PAP-292-table-libraries',
      measuredAt: 'yesterday',
      method: 'x',
      candidates: [validCandidate()],
    });
    expect(result.success).toBe(false);
  });
});
