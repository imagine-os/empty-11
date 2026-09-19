// `conformance.json` (PAP-441 runner, one per Gate 1 run): every registered module
// conformance suite against the default implementation.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const CONFORMANCE_CASE_STATUSES = ['passed', 'failed', 'pending', 'unsupported'] as const;

export const ConformanceCaseSchema = z
  .object({
    /** `<module>.<port>.<n>`. */
    id: z.string().regex(/^[a-z0-9-]+\.[A-Za-z0-9]+\.\d+$/),
    status: z.enum(CONFORMANCE_CASE_STATUSES),
    durationMs: z.number().int().nonnegative().optional(),
    /** Set on `unsupported`: the capability the implementation declared missing. */
    capability: z.string().min(1).optional(),
    message: z.string().optional(),
  })
  .strict();

export const ConformanceSuiteSchema = z
  .object({
    module: z.string().min(1),
    /** `@paperos/contract-<module>` version the suite was pinned to. */
    contractVersion: z.string().min(1),
    implementation: z.string().min(1),
    fixturesLock: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    cases: z.array(ConformanceCaseSchema),
  })
  .strict();

export const ConformanceDataSchema = z
  .object({
    suites: z.array(ConformanceSuiteSchema),
    /** Side-by-side diffs by case id when two implementations were compared. */
    diffs: z
      .array(z.object({ caseId: z.string().min(1), a: z.string(), b: z.string() }).strict())
      .default([]),
  })
  .strict();
export type ConformanceData = z.infer<typeof ConformanceDataSchema>;

export const ConformanceReportSchema = defineGateReport('conformance', ConformanceDataSchema);
export type ConformanceReport = z.infer<typeof ConformanceReportSchema>;
