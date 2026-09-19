// `migrations.json` (PAP-682): migration safety lint over the migrations new in the PR.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const MigrationResultSchema = z
  .object({
    file: z.string().min(1),
    reversible: z.boolean(),
    /** Finding ids (envelope `findings[].id`) raised on this migration. */
    findings: z.array(z.string().regex(/^[0-9a-f]{10}$/)),
    /** Rule ids from `ops/ci/migrations/rules.yaml` that fired. */
    rules: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const MigrationsDataSchema = z
  .object({
    migrations: z.array(MigrationResultSchema),
    /** Present when the PR acknowledged a destructive step (`[x] migration-ack: <reason>` plus the label). */
    ack: z
      .object({ reason: z.string().min(1), label: z.literal('migration-ack') })
      .strict()
      .optional(),
  })
  .strict();
export type MigrationsData = z.infer<typeof MigrationsDataSchema>;

export const MigrationsReportSchema = defineGateReport('migrations', MigrationsDataSchema);
export type MigrationsReport = z.infer<typeof MigrationsReportSchema>;
