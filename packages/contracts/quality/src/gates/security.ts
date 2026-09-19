// `security.json` (PAP-80, extended by PAP-675 DAST and PAP-357 security tests):
// SARIF from every scanner merged into one report. Findings carry `RUB-SEC-*` rubric ids
// and cite `SEC-*` controls in their body.
import { z } from 'zod';
import { ArtifactPathSchema } from '../artifacts.js';
import { GateStateSchema } from '../status.js';
import { defineGateReport } from './report.js';

/** One scanner run merged into the report. */
export const SecurityToolSchema = z
  .object({
    /** `gitleaks`, `osv-scanner`, `pnpm-audit`, `semgrep`, `trivy`, `zap`, `security-tests`, ... */
    name: z.string().min(1),
    version: z.string().min(1).optional(),
    status: GateStateSchema,
    /** Findings this tool contributed, after waivers. */
    findings: z.number().int().nonnegative(),
    /** Findings suppressed by an active waiver. */
    waived: z.number().int().nonnegative().default(0),
    durationMs: z.number().int().nonnegative().optional(),
    /** The tool's SARIF file, relative to `reports/`. */
    sarif: ArtifactPathSchema.optional(),
  })
  .strict();
export type SecurityTool = z.infer<typeof SecurityToolSchema>;

export const SecurityDataSchema = z
  .object({
    tools: z.array(SecurityToolSchema),
    /** CycloneDX SBOM path when produced. */
    sbom: ArtifactPathSchema.optional(),
    /** Waiver file state: expired waivers fail certification (PAP-88). */
    waivers: z
      .object({ active: z.number().int().nonnegative(), expired: z.number().int().nonnegative() })
      .strict()
      .optional(),
  })
  .strict();
export type SecurityData = z.infer<typeof SecurityDataSchema>;

export const SecurityReportSchema = defineGateReport('security', SecurityDataSchema);
export type SecurityReport = z.infer<typeof SecurityReportSchema>;
