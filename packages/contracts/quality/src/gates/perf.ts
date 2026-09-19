// `perf.json` (PAP-87 web budgets; PAP-242 adds `data.api`).
import { z } from 'zod';
import { GateStateSchema } from '../status.js';
import { defineGateReport } from './report.js';

const Budgeted = { budget: z.number().nonnegative(), status: GateStateSchema } as const;

export const PerfWebEntrySchema = z
  .object({
    url: z.string().min(1),
    preset: z.enum(['mobile', 'desktop']),
    /** Milliseconds. */
    lcp: z.number().nonnegative(),
    tbt: z.number().nonnegative(),
    /** Unitless. */
    cls: z.number().nonnegative(),
    /** Lighthouse category scores, 0..100. */
    scores: z.record(z.string(), z.number().min(0).max(100)),
    ...Budgeted,
  })
  .strict();

export const PerfBundleSchema = z
  .object({
    name: z.string().min(1),
    /** Bytes, gzip. */
    sizeBytes: z.number().int().nonnegative(),
    ...Budgeted,
  })
  .strict();

export const PerfApiProcedureSchema = z
  .object({
    name: z.string().min(1),
    p50: z.number().nonnegative(),
    p95: z.number().nonnegative(),
    errorRate: z.number().min(0).max(1),
    ...Budgeted,
  })
  .strict();

export const PerfDataSchema = z
  .object({
    web: z.array(PerfWebEntrySchema),
    bundles: z.array(PerfBundleSchema),
    api: z
      .object({
        procedures: z.array(PerfApiProcedureSchema),
        slowQueries: z.array(
          z
            .object({
              query: z.string().min(1),
              meanMs: z.number().nonnegative(),
              calls: z.number().int(),
            })
            .strict(),
        ),
        imageBytes: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type PerfData = z.infer<typeof PerfDataSchema>;

export const PerfReportSchema = defineGateReport('perf', PerfDataSchema);
export type PerfReport = z.infer<typeof PerfReportSchema>;
