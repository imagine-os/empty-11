import { describe, expect, expectTypeOf, it } from 'vitest';
import { mockPayrollProvider } from './mock-adapter.js';
import type { Capabilities, PayrollEvent, PayrollProvider } from './provider.js';

describe('PayrollProvider', () => {
  it('the mock adapter satisfies the PayrollProvider interface', () => {
    expectTypeOf(mockPayrollProvider).toMatchTypeOf<PayrollProvider>();
  });

  it('capabilities() returns a Capabilities object', () => {
    expectTypeOf(mockPayrollProvider.capabilities()).toEqualTypeOf<Capabilities>();
  });

  it('Capabilities gates the optional `contractors` member: an adapter may omit it entirely', () => {
    // The mock reports capabilities().contractors === false and does not implement
    // `contractors` at all. `PayrollProvider.contractors?` must allow that — this
    // line only type-checks (and the assignment below only compiles) because the
    // member is optional, not because it is present.
    expectTypeOf<PayrollProvider['contractors']>().toEqualTypeOf<
      | {
          upsert: (
            externalCompanyId: string,
            input: import('./provider.js').PayrollEmployeeInput,
          ) => Promise<import('./provider.js').PayrollEmployee>;
          list: (
            externalCompanyId: string,
          ) => Promise<readonly import('./provider.js').PayrollEmployee[]>;
        }
      | undefined
    >();
    expect(mockPayrollProvider.contractors).toBeUndefined();
    expect(mockPayrollProvider.capabilities().contractors).toBe(false);
  });

  it('webhooks.parse returns a PayrollEvent', () => {
    // JSON has no bigint literal, so the raw body is written by hand (Money's
    // real wire codec, PAP-302, decodes `amountMinor` from a decimal string —
    // this mock's `parse` is a naive `JSON.parse` cast and is not that codec).
    const rawBody =
      '{"type":"payroll.approved","externalRunId":"run-1","payDate":"2026-09-20",' +
      '"totals":{"gross":{"amountMinor":0,"currency":"USD"},"employerTaxes":{"amountMinor":0,"currency":"USD"},' +
      '"withholdings":{"amountMinor":0,"currency":"USD"},"fees":{"amountMinor":0,"currency":"USD"},' +
      '"net":{"amountMinor":0,"currency":"USD"}},"items":[]}';
    const event = mockPayrollProvider.webhooks.parse(rawBody);
    expectTypeOf(event).toEqualTypeOf<PayrollEvent>();
    expect(event.type).toBe('payroll.approved');
  });

  it('runs a preview and reads back typed totals (runtime smoke test)', async () => {
    const preview = await mockPayrollProvider.payrolls.preview('mock-company-1', {
      payScheduleId: 'sched-1',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-15',
    });
    expect(preview.totals.net.currency).toBe('USD');
    expect(preview.blockedEmployees).toHaveLength(0);
  });
});
