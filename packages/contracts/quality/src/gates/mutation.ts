// `mutation.json` (PAP-686): nightly mutation testing; survivors become findings.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const MutationPackageSchema = z
  .object({
    name: z.string().min(1),
    /** Mutation score, 0..100. */
    score: z.number().min(0).max(100),
    floor: z.number().min(0).max(100),
    killed: z.number().int().nonnegative(),
    survived: z.number().int().nonnegative(),
    timeout: z.number().int().nonnegative(),
    noCoverage: z.number().int().nonnegative(),
    survivors: z.array(
      z
        .object({
          file: z.string().min(1),
          line: z.number().int().positive(),
          mutator: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const MutationDataSchema = z
  .object({
    packages: z.array(MutationPackageSchema),
    /** Pages URL of the HTML report, `/nightly/<date>/mutation/`. */
    reportUrl: z.url().optional(),
  })
  .strict();
export type MutationData = z.infer<typeof MutationDataSchema>;

export const MutationReportSchema = defineGateReport('mutation', MutationDataSchema);
export type MutationReport = z.infer<typeof MutationReportSchema>;
