// `edgecases.json` (PAP-85 / PAP-251): the edge-case hunter's scenario matrix.
import { z } from 'zod';
import { GateStateSchema } from '../status.js';
import { defineGateReport } from './report.js';

export const SCENARIO_CLASSES = [
  'empty',
  'huge',
  'unicode',
  'adversarial-input',
  'network-failure',
  'slow-device',
  'concurrency',
  'permissions',
  'time',
] as const;
export const ScenarioClassSchema = z.enum(SCENARIO_CLASSES);

export const ScenarioResultSchema = z
  .object({
    page: z.string().min(1),
    scenarioId: z.string().min(1),
    class: ScenarioClassSchema,
    status: GateStateSchema,
    /** Finding ids (envelope `findings[].id`) this scenario produced. */
    findings: z.array(z.string().regex(/^[0-9a-f]{10}$/)).default([]),
    /** Repo path of the generated repro test, when one was written (PAP-251). */
    repro: z.string().min(1).optional(),
    durationMs: z.number().int().nonnegative().optional(),
  })
  .strict();
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;

export const EdgecasesDataSchema = z
  .object({
    matrix: z.array(ScenarioResultSchema),
    /** Scenarios planned and the invalid plan entries dropped (never executed). */
    planned: z.number().int().nonnegative(),
    dropped: z.number().int().nonnegative(),
  })
  .strict();
export type EdgecasesData = z.infer<typeof EdgecasesDataSchema>;

export const EdgecasesReportSchema = defineGateReport('edgecases', EdgecasesDataSchema);
export type EdgecasesReport = z.infer<typeof EdgecasesReportSchema>;
