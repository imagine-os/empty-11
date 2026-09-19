// `flakes-delta.json` (PAP-90): tests that passed only on retry in this run. Every gate
// workflow writes one; the collector merges them into `ops/quality/flakes.json`.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const FLAKE_SOURCES = ['vitest', 'playwright', 'visual', 'videos', 'edgecases'] as const;

export const FlakeSchema = z
  .object({
    /** Stable test id: `<file>::<title>` for Vitest, Playwright's test id otherwise. */
    testId: z.string().min(1),
    source: z.enum(FLAKE_SOURCES),
    file: z.string().min(1).optional(),
    retries: z.number().int().positive(),
    passedOnRetry: z.boolean(),
    /** Browser engine for cross-browser runs (PAP-687). */
    engine: z.enum(['chromium', 'webkit', 'firefox']).optional(),
    /** `FL-<n>` once the collector has tracked it. */
    flakeId: z
      .string()
      .regex(/^FL-\d+$/)
      .optional(),
  })
  .strict();
export type Flake = z.infer<typeof FlakeSchema>;

export const FlakesDeltaDataSchema = z
  .object({
    /** The gate workflow that produced this delta. */
    workflow: z.string().min(1),
    flakes: z.array(FlakeSchema),
  })
  .strict();
export type FlakesDeltaData = z.infer<typeof FlakesDeltaDataSchema>;

export const FlakesDeltaReportSchema = defineGateReport('flakes-delta', FlakesDeltaDataSchema);
export type FlakesDeltaReport = z.infer<typeof FlakesDeltaReportSchema>;
