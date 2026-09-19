// `review.json` (PAP-243 `runReview()` output, one per reviewer): the findings are in the
// envelope; `data` records coverage, verdict and the model routing that PAP-98 prices.
import { z } from 'zod';
import { RubricCoverageSchema } from '../finding.js';
import { GateStatusNameSchema } from '../status.js';
import { defineGateReport } from './report.js';

export const REVIEW_VERDICTS = ['comment', 'request-changes'] as const;

export const ReviewDataSchema = z
  .object({
    /** `correctness`, `security`, `spec-conformance`, `docs-and-spec`, or a release-candidate reviewer. */
    reviewer: z.string().min(1),
    statusName: GateStatusNameSchema,
    rubricCoverage: RubricCoverageSchema,
    /** Reviewers never approve: `comment`, or `request-changes` on any S0 or more than 3 S1. */
    verdict: z.enum(REVIEW_VERDICTS),
    /** Model and effort chosen by the routing rule; named here, never in code. */
    model: z.string().min(1).optional(),
    effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
    /** Changed lines seen; over 10 000 posts one S1 "PR too large". */
    changedLines: z.number().int().nonnegative().optional(),
    /** True when the run was an incremental re-review. */
    incremental: z.boolean().default(false),
  })
  .strict();
export type ReviewData = z.infer<typeof ReviewDataSchema>;

export const ReviewReportSchema = defineGateReport('review', ReviewDataSchema);
export type ReviewReport = z.infer<typeof ReviewReportSchema>;
