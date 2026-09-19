/**
 * A minimal, in-memory `PayrollProvider` used only to type-check the interface
 * (`provider.test.ts`) and as a starting point for PAP-398's contract test
 * suite. It has no network calls and is not a real adapter — do not wire it to
 * a route or expose it to a tenant.
 */

import type {
  Capabilities,
  PayrollCompany,
  PayrollCompanyInput,
  PayrollEmployee,
  PayrollEmployeeInput,
  PayrollEvent,
  PayrollProvider,
  PayrollRun,
  PayrollRunPreview,
} from './provider.js';

const capabilities: Capabilities = {
  contractors: false,
  offCycleRuns: false,
  internationalContractors: false,
  benefits: false,
  timeTracking: false,
  statePayrollTaxStates: ['CA', 'NY', 'TX'],
  webhooks: true,
  pollFallback: true,
};

const company: PayrollCompany = {
  externalCompanyId: 'mock-company-1',
  onboardingStatus: 'complete',
  payFrequency: 'biweekly',
  nextPayDate: '2026-10-01',
  bankVerified: true,
};

const employee: PayrollEmployee = {
  externalEmployeeId: 'mock-employee-1',
  partyId: 'party-1',
  onboardingStatus: 'complete',
  ssnLast4Masked: '1234',
  w4Complete: true,
};

const run: PayrollRun = {
  externalRunId: 'mock-run-1',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-15',
  payDate: '2026-09-20',
  status: 'draft',
  totals: null,
};

/**
 * Note: `contractors` is intentionally omitted here (`capabilities.contractors`
 * is `false`), which is the case `provider.test.ts` checks: `PayrollProvider`
 * must accept an adapter that leaves the optional member out entirely.
 */
export const mockPayrollProvider: PayrollProvider = {
  id: 'mock',

  capabilities: () => capabilities,

  companies: {
    create: async (_input: PayrollCompanyInput) => company,
    get: async (_externalCompanyId: string) => company,
    onboardingLink: async (_externalCompanyId: string) => 'https://sandbox.example/onboard/company',
  },

  employees: {
    upsert: async (_externalCompanyId: string, _input: PayrollEmployeeInput) => employee,
    onboardingLink: async (_externalEmployeeId: string) =>
      'https://sandbox.example/onboard/employee',
    list: async (_externalCompanyId: string) => [employee],
  },

  paySchedules: {
    list: async (_externalCompanyId: string) => [
      { id: 'sched-1', frequency: 'biweekly', nextPayDate: '2026-10-01' },
    ],
    create: async (_externalCompanyId: string, frequency) => ({
      id: 'sched-1',
      frequency,
      nextPayDate: '2026-10-01',
    }),
  },

  payrolls: {
    preview: async (_externalCompanyId: string, _input): Promise<PayrollRunPreview> => ({
      externalRunId: run.externalRunId,
      totals: {
        gross: { amountMinor: 500000n, currency: 'USD' },
        employerTaxes: { amountMinor: 38250n, currency: 'USD' },
        withholdings: { amountMinor: 120000n, currency: 'USD' },
        fees: { amountMinor: 2500n, currency: 'USD' },
        net: { amountMinor: 380000n, currency: 'USD' },
      },
      items: [],
      blockedEmployees: [],
    }),
    create: async (_externalCompanyId: string, _input) => run,
    approve: async (_input) => ({ ...run, status: 'approved' }),
    cancel: async (_externalRunId: string) => ({ ...run, status: 'cancelled' }),
    list: async (_externalCompanyId: string) => [run],
    get: async (_externalRunId: string) => run,
  },

  paystubs: {
    list: async (_externalEmployeeId: string) => [],
    pdfUrl: async (_externalEmployeeId: string, _externalRunId: string) =>
      'https://sandbox.example/paystubs/mock-run-1.pdf',
  },

  taxes: {
    filings: async (_externalCompanyId: string) => [],
  },

  webhooks: {
    verify: (_signatureHeader: string, _rawBody: string) => true,
    parse: (rawBody: string): PayrollEvent => JSON.parse(rawBody) as PayrollEvent,
  },
};
