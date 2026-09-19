// `coverage.json` (PAP-681): diff coverage of the changed lines.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const CoverageDataSchema = z
  .object({
    changedLines: z.number().int().nonnegative(),
    coveredLines: z.number().int().nonnegative(),
    /** coveredLines / changedLines, 0..1; 1 when nothing changed. */
    ratio: z.number().min(0).max(1),
    /** The floor from `ops/ci/coverage.budget.json`. */
    floor: z.number().min(0).max(1),
    files: z.array(
      z
        .object({
          file: z.string().min(1),
          uncovered: z.array(z.number().int().positive()),
        })
        .strict(),
    ),
  })
  .strict()
  .refine((d) => d.coveredLines <= d.changedLines, {
    message: 'coveredLines cannot exceed changedLines',
    path: ['coveredLines'],
  });
export type CoverageData = z.infer<typeof CoverageDataSchema>;

export const CoverageReportSchema = defineGateReport('coverage', CoverageDataSchema);
export type CoverageReport = z.infer<typeof CoverageReportSchema>;
