// `review-cost.json` (PAP-243, priced by PAP-98): one row per reviewer run on the PR.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const ReviewRunCostSchema = z
  .object({
    reviewer: z.string().min(1),
    model: z.string().min(1),
    effort: z.enum(['low', 'medium', 'high', 'max']),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative().default(0),
    costUsd: z.number().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    turns: z.number().int().nonnegative(),
  })
  .strict();
export type ReviewRunCost = z.infer<typeof ReviewRunCostSchema>;

export const ReviewCostDataSchema = z
  .object({
    runs: z.array(ReviewRunCostSchema),
    totalUsd: z.number().nonnegative(),
  })
  .strict()
  .refine((d) => Math.abs(d.runs.reduce((s, r) => s + r.costUsd, 0) - d.totalUsd) < 0.005, {
    message: 'totalUsd is the sum of runs[].costUsd',
    path: ['totalUsd'],
  });
export type ReviewCostData = z.infer<typeof ReviewCostDataSchema>;

export const ReviewCostReportSchema = defineGateReport('review-cost', ReviewCostDataSchema);
export type ReviewCostReport = z.infer<typeof ReviewCostReportSchema>;
