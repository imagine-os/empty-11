// `certification.json` (PAP-88 / PAP-254 `certify.ts`): the release-candidate checks.
import { z } from 'zod';
import { GATE_STATUSES, GateStateSchema } from '../status.js';
import { defineGateReport } from './report.js';

export const CertificationCheckSchema = z
  .object({
    /** `statuses-green`, `no-open-s0-s1`, `no-expired-waivers`, `perf-within-budget`, `migrations-reversible`, `backup-fresh`, `staging-test-mode-off`. */
    name: z.string().min(1),
    status: GateStateSchema,
    detail: z.string().optional(),
  })
  .strict();

export const CertificationDataSchema = z
  .object({
    rc: z
      .object({
        branch: z.string().min(1),
        sha: z.string().regex(/^[0-9a-f]{7,40}$/),
        tag: z.string().min(1).optional(),
      })
      .strict(),
    /** State of every registered status on the RC head. */
    statuses: z.partialRecord(z.enum(GATE_STATUSES), GateStateSchema),
    checks: z.array(CertificationCheckSchema),
    /** Copied from the PR body when a destructive migration was acknowledged (PAP-682). */
    migrationAck: z
      .object({ reason: z.string().min(1), pr: z.number().int().positive() })
      .strict()
      .optional(),
    certified: z.boolean(),
  })
  .strict();
export type CertificationData = z.infer<typeof CertificationDataSchema>;

export const CertificationReportSchema = defineGateReport('certification', CertificationDataSchema);
export type CertificationReport = z.infer<typeof CertificationReportSchema>;
