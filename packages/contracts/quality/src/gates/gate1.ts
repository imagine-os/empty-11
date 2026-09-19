// `gate1.json` (PAP-78): the static gate. Shape agreed with PAP-78's `packages/gate/src/gate1.ts`,
// which becomes a re-export of this file.
import { z } from 'zod';
import { GateStateSchema, GateStatusNameSchema } from '../status.js';
import { defineGateReport } from './report.js';

/** One job of the gate. */
export const GateJobSchema = z
  .object({
    name: z.string().min(1),
    status: GateStateSchema,
    durationMs: z.number().int().nonnegative(),
    /** The command the job ran, so a reader can reproduce it locally. */
    command: z.string().min(1).optional(),
  })
  .strict();
export type GateJob = z.infer<typeof GateJobSchema>;

/** One machine-readable failure, the shape the CI annotator prints. */
export const GateFailureSchema = z
  .object({
    job: z.string().min(1),
    file: z.string().min(1).optional(),
    line: z.number().int().positive().optional(),
    message: z.string().min(1),
  })
  .strict();
export type GateFailure = z.infer<typeof GateFailureSchema>;

/** PR class from the touched paths; decides which statuses are required (PAP-78 round-4 amendment). */
export const PR_CLASSES = ['docs-only', 'infra', 'code'] as const;
export const PrClassSchema = z.enum(PR_CLASSES);
export type PrClass = z.infer<typeof PrClassSchema>;

export const Gate1DataSchema = z
  .object({
    jobs: z.array(GateJobSchema),
    failures: z.array(GateFailureSchema),
    /** The status name this gate publishes; a consumer keys off it, not off `kind`. */
    statusName: GateStatusNameSchema,
    prClass: PrClassSchema,
    /** Total wall time of the gate, the number the 3-minute soft alarm watches. */
    totalDurationMs: z.number().int().nonnegative(),
    /** `TZ` and `LANG` as the run saw them: gate 1 is only deterministic if these are pinned. */
    env: z.object({ TZ: z.string(), LANG: z.string(), node: z.string() }).strict(),
  })
  .strict();
export type Gate1Data = z.infer<typeof Gate1DataSchema>;

export const Gate1ReportSchema = defineGateReport('gate1', Gate1DataSchema);
export type Gate1Report = z.infer<typeof Gate1ReportSchema>;
