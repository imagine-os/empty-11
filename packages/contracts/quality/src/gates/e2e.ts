// `e2e.json` (PAP-86 functional flows; PAP-687 adds `engine`, PAP-690 adds `target`).
import { z } from 'zod';
import { GateStateSchema } from '../status.js';
import { defineGateReport } from './report.js';

export const E2E_TARGETS = [
  'web',
  'desktop-linux',
  'desktop-macos',
  'desktop-windows',
  'mobile',
] as const;
export const E2E_ENGINES = ['chromium', 'webkit', 'firefox', 'tauri'] as const;

export const E2eRunSchema = z
  .object({
    /** Playwright project or suite name. */
    project: z.string().min(1),
    target: z.enum(E2E_TARGETS).default('web'),
    engine: z.enum(E2E_ENGINES).default('chromium'),
    status: GateStateSchema,
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    flaky: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
export type E2eRun = z.infer<typeof E2eRunSchema>;

export const E2eDataSchema = z
  .object({
    runs: z.array(E2eRunSchema),
    /** Failed tests, with the trace or video that shows the failure. */
    failures: z
      .array(
        z
          .object({
            project: z.string().min(1),
            testId: z.string().min(1),
            message: z.string().min(1),
            trace: z.string().min(1).optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export type E2eData = z.infer<typeof E2eDataSchema>;

export const E2eReportSchema = defineGateReport('e2e', E2eDataSchema);
export type E2eReport = z.infer<typeof E2eReportSchema>;
