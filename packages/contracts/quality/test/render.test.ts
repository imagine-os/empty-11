import { describe, expect, it } from 'vitest';
import { makeFinding } from '../src/finding.js';
import { renderReview } from '../src/render.js';

const findings = [
  makeFinding({
    reviewer: 'security',
    rubricId: 'RUB-SEC-01',
    severity: 'S0',
    title: 'voidInvoice has no authorize() so any signed-in user can void invoices',
    body: 'Call voidInvoice as role viewer: 200 and the row is void.\nProving test: permission matrix row for finance.write on voidInvoice.',
    file: 'packages/finance/src/router/invoices.ts',
    line: 12,
    endLine: 18,
    suggestion:
      "@@ -12,1 +12,2 @@\n-export const voidInvoice = procedure\n+export const voidInvoice = procedure\n+  .use(authorize('finance.write'))",
    evidence: [{ kind: 'code', ref: 'packages/finance/src/router/invoices.ts:12' }],
    confidence: 0.95,
    autofixable: true,
  }),
  makeFinding({
    reviewer: 'security',
    rubricId: 'RUB-SEC-10',
    severity: 'S1',
    title: 'Request middleware logs email, IP and full bodies',
    body: 'Bodies on /auth/* include passwords.',
    file: 'apps/api/src/middleware/log.ts',
    line: 7,
    evidence: [{ kind: 'log', ref: 'reports/gate1/api.log' }],
    confidence: 0.8,
    autofixable: false,
  }),
  makeFinding({
    reviewer: 'security',
    rubricId: 'RUB-SEC-09',
    severity: 'S2',
    title: 'lodash added for one debounce',
    body: 'Prefer the existing helper in @paperos/core.',
    file: 'package.json',
    evidence: [],
    confidence: 0.7,
    autofixable: false,
    waiver: {
      reason: 'removed in PAP-300 next week',
      approvedBy: 'Sentinel',
      expires: '2026-10-01',
    },
  }),
  makeFinding({
    reviewer: 'security',
    rubricId: 'RUB-SEC-08',
    severity: 'S2',
    title: 'Is the export endpoint bounded?',
    body: 'Could not find a limiter; the route may be covered by the global one.',
    evidence: [],
    confidence: 0.3,
    autofixable: false,
  }),
  makeFinding({
    reviewer: 'security',
    rubricId: 'RUB-SEC-03',
    severity: 'praise',
    title: 'Strict Zod input with bounded arrays on every new procedure',
    body: 'Mass assignment is impossible here.',
    evidence: [],
    confidence: 1,
    autofixable: false,
  }),
];

describe('renderReview', () => {
  it('matches the rendering template snapshot', () => {
    const md = renderReview(findings, {
      reviewer: 'security',
      sha: '0123456789abcdef0123',
      fileLinkBase: 'https://github.com/imagine-os/paperos-template/blob/0123456789abcdef0123',
      coverage: {
        'RUB-SEC-01': 'checked',
        'RUB-SEC-02': 'checked',
        'RUB-SEC-05': 'n/a',
        'RUB-SEC-07': 'skipped',
      },
      notChecked: ['Trivy container results (scanner errored)'],
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(md).toMatchSnapshot();
    expect(md).toContain('| 1 | 1 | 1 | 0 | 1 | 1 |');
    expect(md).toContain('<!-- finding:');
    expect(md).toContain('```diff');
    expect(md).toContain('**Gate:** fail (1 S0 finding(s))');
  });
  it('renders an empty review', () => {
    const md = renderReview([], { reviewer: 'correctness' });
    expect(md).toContain('No findings.');
    expect(md).toContain('**Gate:** pass');
  });
  it('is deterministic regardless of input order', () => {
    const a = renderReview(findings, { reviewer: 'security', now: new Date('2026-09-19') });
    const b = renderReview([...findings].reverse(), {
      reviewer: 'security',
      now: new Date('2026-09-19'),
    });
    expect(a).toBe(b);
  });
});
