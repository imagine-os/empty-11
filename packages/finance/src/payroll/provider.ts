/**
 * The `PayrollProvider` port — PAP-176's lasting artefact.
 *
 * Decided by ADR [0007-payroll-provider](../../../../docs/adr/0007-payroll-provider.md): the shape
 * below is fixed regardless of which vendor (Gusto Embedded, Check, ...) PAP-184's adapter children
 * (PAP-398/399/400) implement it against, and regardless of Justin's NJ-12 answer. PAP-186's
 * `upcomingPayroll` reads `PayrollRun` rows shaped by this file; its notifications and the ledger
 * posting flow consume `PayrollEvent`.
 *
 * Types only — no runtime, no provider SDK, no fetch call. An adapter package (PAP-398) implements
 * this interface against a real vendor's REST API; `mock-adapter.ts` in this folder is a minimal
 * in-memory implementation used only to type-check the interface itself (see `provider.test.ts`).
 *
 * Money: PaperOS's shared value type (`@paperos/core`, PAP-302, ADR 0011) is not merged yet, so
 * `Money` is declared locally with the same field shape (`amountMinor: bigint`, ISO 4217
 * `currency`) it will have there. Swapping the import later is not a breaking change to this
 * interface.
 */

// ---------------------------------------------------------------------------
// Shared value shapes
// ---------------------------------------------------------------------------

/** ISO 4217 alpha-3 currency code, upper case (e.g. `"USD"`). */
export type Iso4217 = string;

/**
 * An exact amount of money: an integer count of the currency's minor units plus
 * its ISO 4217 code. Never a float. See `@paperos/core`'s `Money` (PAP-302) for
 * the canonical, arithmetic-bearing version this type will be replaced by.
 */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: Iso4217;
}

/** An ISO 8601 calendar date, `YYYY-MM-DD`, no time component. */
export type IsoDate = string;

/** An ISO 8601 timestamp with an offset, e.g. `2026-09-19T12:00:00Z`. */
export type IsoDateTime = string;

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'blocked' | 'complete';

/** Mirrors `payroll_company` (PAP-184's binding table decision). */
export interface PayrollCompany {
  readonly externalCompanyId: string;
  readonly onboardingStatus: OnboardingStatus;
  readonly payFrequency: PayFrequency;
  readonly nextPayDate: IsoDate | null;
  readonly bankVerified: boolean;
}

export interface PayrollCompanyInput {
  readonly tenantId: string;
  readonly legalName: string;
  readonly ein?: string;
  readonly payFrequency: PayFrequency;
}

// ---------------------------------------------------------------------------
// Employees and contractors
// ---------------------------------------------------------------------------

/**
 * What PaperOS sends the provider when syncing from `fin_employee` (PAP-175).
 * No SSNs or bank account numbers travel through this type — PAP-184's binding
 * decision is that only the provider ever holds those, and PaperOS keeps only
 * `PayrollEmployee.ssnLast4Masked`.
 */
export interface PayrollEmployeeInput {
  readonly partyId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly startDate: IsoDate;
  readonly type: 'employee' | 'contractor';
  /** Provider-shaped pay rate/salary/schedule details; the adapter validates the shape it needs. */
  readonly compensation: Readonly<Record<string, unknown>>;
}

/** Mirrors `payroll_employee_link` (PAP-184's binding table decision). */
export interface PayrollEmployee {
  readonly externalEmployeeId: string;
  readonly partyId: string;
  readonly onboardingStatus: OnboardingStatus;
  readonly ssnLast4Masked: string | null;
  readonly w4Complete: boolean;
}

// ---------------------------------------------------------------------------
// Pay schedules
// ---------------------------------------------------------------------------

export interface PaySchedule {
  readonly id: string;
  readonly frequency: PayFrequency;
  readonly nextPayDate: IsoDate;
}

// ---------------------------------------------------------------------------
// Payroll runs
// ---------------------------------------------------------------------------

/** Mirrors `payroll_run.status` (PAP-184's binding table decision). */
export type PayrollRunStatus =
  | 'draft'
  | 'previewed'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

/**
 * Per-employee totals for one run. The shape ledger posting (PAP-179/PAP-184)
 * needs: debit `wages_expense`, `payroll_tax_expense`, `payroll_fees`; credit
 * `payroll_liability` (net) and `payroll_tax_liability`.
 */
export interface PayrollRunItem {
  readonly externalEmployeeId: string;
  readonly gross: Money;
  readonly employerTaxes: Money;
  readonly withholdings: Money;
  readonly fees: Money;
  readonly net: Money;
}

export interface PayrollRunTotals {
  readonly gross: Money;
  readonly employerTaxes: Money;
  readonly withholdings: Money;
  readonly fees: Money;
  readonly net: Money;
}

export interface PayrollRun {
  readonly externalRunId: string;
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
  readonly payDate: IsoDate;
  readonly status: PayrollRunStatus;
  readonly totals: PayrollRunTotals | null;
}

export interface CreatePayrollRunInput {
  readonly payScheduleId: string;
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
  /** externalEmployeeId -> hours worked, for hourly employees; omitted for salaried-only runs. */
  readonly hours?: Readonly<Record<string, number>>;
  /** Only valid when `Capabilities.offCycleRuns` is true. */
  readonly offCycle?: boolean;
}

export interface BlockedRunEmployee {
  readonly externalEmployeeId: string;
  readonly reason: string;
}

export interface PayrollRunPreview {
  readonly externalRunId: string;
  readonly totals: PayrollRunTotals;
  readonly items: readonly PayrollRunItem[];
  /** Employees the provider will refuse to pay in this run (e.g. missing tax setup). */
  readonly blockedEmployees: readonly BlockedRunEmployee[];
}

/**
 * The approver retypes the net total as a confirmation step (PAP-184's binding
 * decision: "typing the net total"). Agents may draft a run but must never call
 * `approve` — that guard is enforced by the caller (the `payroll.approve`
 * permission), not by this interface.
 */
export interface ApprovePayrollRunInput {
  readonly externalRunId: string;
  readonly typedNetTotal: Money;
  readonly approvedBy: string;
}

// ---------------------------------------------------------------------------
// Paystubs and tax filings
// ---------------------------------------------------------------------------

export interface Paystub {
  readonly externalEmployeeId: string;
  readonly externalRunId: string;
  readonly payDate: IsoDate;
  readonly net: Money;
}

export type TaxFilingStatus = 'pending' | 'filed' | 'accepted' | 'rejected';

export interface TaxFiling {
  readonly id: string;
  readonly jurisdiction: string;
  readonly period: string;
  readonly status: TaxFilingStatus;
  readonly filedAt: IsoDateTime | null;
}

// ---------------------------------------------------------------------------
// Webhook events
// ---------------------------------------------------------------------------

/**
 * The event PAP-184's webhook route parses on `payroll.approved`. Per-employee
 * totals let the ledger post `wages_expense`, `payroll_tax_expense`,
 * `payroll_fees` against `payroll_liability` (net) and `payroll_tax_liability`.
 */
export interface PayrollApprovedEvent {
  readonly type: 'payroll.approved';
  readonly externalRunId: string;
  readonly payDate: IsoDate;
  readonly totals: PayrollRunTotals;
  readonly items: readonly PayrollRunItem[];
}

/** Moves `payroll_liability` to `cash` (PAP-184's binding posting decision). */
export interface PayrollPaidEvent {
  readonly type: 'payroll.paid';
  readonly externalRunId: string;
  readonly paidAt: IsoDateTime;
}

export interface PayrollFailedEvent {
  readonly type: 'payroll.failed';
  readonly externalRunId: string;
  readonly reason: string;
}

export interface PayrollEmployeeOnboardedEvent {
  readonly type: 'payroll.employee.onboarded';
  readonly externalEmployeeId: string;
}

export type PayrollEvent =
  | PayrollApprovedEvent
  | PayrollPaidEvent
  | PayrollFailedEvent
  | PayrollEmployeeOnboardedEvent;

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * What a given adapter actually supports, read by the UI (PAP-400's run flow)
 * and by PAP-184's binding decision that "`capabilities()` drives the UI".
 * `contractors` gates whether `PayrollProvider.contractors` is present at
 * runtime (see `provider.test.ts` for the type-level check).
 */
export interface Capabilities {
  readonly contractors: boolean;
  readonly offCycleRuns: boolean;
  readonly internationalContractors: boolean;
  readonly benefits: boolean;
  readonly timeTracking: boolean;
  /** USPS state codes this adapter can run payroll tax for, e.g. `["CA", "NY"]`. */
  readonly statePayrollTaxStates: readonly string[];
  readonly webhooks: boolean;
  /** True when the adapter also needs the 15-minute poll fallback (PAP-399). */
  readonly pollFallback: boolean;
}

// ---------------------------------------------------------------------------
// The port
// ---------------------------------------------------------------------------

/**
 * The provider port every payroll adapter (Gusto Embedded, Check, ...)
 * implements. Method groups and names match this issue's Interface contract
 * verbatim: `companies`, `employees`, `contractors?`, `paySchedules`,
 * `payrolls`, `paystubs`, `taxes`, `webhooks`.
 */
export interface PayrollProvider {
  /** The adapter's own id, e.g. `"gusto-embedded"` or `"check"`. Matches `payroll_company.provider`. */
  readonly id: string;

  capabilities(): Capabilities;

  readonly companies: {
    create(input: PayrollCompanyInput): Promise<PayrollCompany>;
    get(externalCompanyId: string): Promise<PayrollCompany>;
    /** A hosted onboarding URL to embed (sandboxed iframe) or redirect to. */
    onboardingLink(externalCompanyId: string): Promise<string>;
  };

  readonly employees: {
    upsert(externalCompanyId: string, input: PayrollEmployeeInput): Promise<PayrollEmployee>;
    onboardingLink(externalEmployeeId: string): Promise<string>;
    list(externalCompanyId: string): Promise<readonly PayrollEmployee[]>;
  };

  /** Present only when `capabilities().contractors` is true. */
  readonly contractors?: {
    upsert(externalCompanyId: string, input: PayrollEmployeeInput): Promise<PayrollEmployee>;
    list(externalCompanyId: string): Promise<readonly PayrollEmployee[]>;
  };

  readonly paySchedules: {
    list(externalCompanyId: string): Promise<readonly PaySchedule[]>;
    create(externalCompanyId: string, frequency: PayFrequency): Promise<PaySchedule>;
  };

  readonly payrolls: {
    preview(externalCompanyId: string, input: CreatePayrollRunInput): Promise<PayrollRunPreview>;
    create(externalCompanyId: string, input: CreatePayrollRunInput): Promise<PayrollRun>;
    /** The caller must have typed the net total; agents never call this (permission-gated by the caller). */
    approve(input: ApprovePayrollRunInput): Promise<PayrollRun>;
    /** Allowed until the provider's cutoff; rejected afterward. */
    cancel(externalRunId: string): Promise<PayrollRun>;
    list(externalCompanyId: string): Promise<readonly PayrollRun[]>;
    get(externalRunId: string): Promise<PayrollRun>;
  };

  readonly paystubs: {
    list(externalEmployeeId: string): Promise<readonly Paystub[]>;
    pdfUrl(externalEmployeeId: string, externalRunId: string): Promise<string>;
  };

  readonly taxes: {
    filings(externalCompanyId: string): Promise<readonly TaxFiling[]>;
  };

  readonly webhooks: {
    /** Verifies the provider's signature header against the raw request body. */
    verify(signatureHeader: string, rawBody: string): boolean;
    /** Throws if `rawBody` is not a recognised payroll event. */
    parse(rawBody: string): PayrollEvent;
  };
}
