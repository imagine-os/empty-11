// `calibration.json` (PAP-241): weekly reviewer calibration against the PAP-79 set.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const ReviewerCalibrationSchema = z
  .object({
    reviewer: z.string().min(1),
    /** Agreement with the expected findings, 0..1. */
    agreement: z.number().min(0).max(1),
    falsePositives: z.number().int().nonnegative(),
    missed: z.number().int().nonnegative(),
    cases: z.number().int().nonnegative(),
  })
  .strict();

export const CalibrationSummaryDataSchema = z
  .object({
    /** ISO week, `2026-W39`. */
    week: z.string().regex(/^\d{4}-W\d{2}$/),
    /** Overall agreement, 0..1, against the threshold the calibrate CLI enforces. */
    agreement: z.number().min(0).max(1),
    threshold: z.number().min(0).max(1),
    perReviewer: z.array(ReviewerCalibrationSchema),
    /** Cases added this week from defects found later (severity.md, calibration). */
    newCases: z.array(z.string().regex(/^\d{2}-[a-z0-9-]+$/)).default([]),
  })
  .strict();
export type CalibrationSummaryData = z.infer<typeof CalibrationSummaryDataSchema>;

export const CalibrationSummaryReportSchema = defineGateReport(
  'calibration',
  CalibrationSummaryDataSchema,
);
export type CalibrationSummaryReport = z.infer<typeof CalibrationSummaryReportSchema>;
