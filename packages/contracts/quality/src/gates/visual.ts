// `visual.json` (PAP-82 / PAP-248): the screenshot suite across the breakpoint matrix.
// Consumed by the vision agent (PAP-84), the digest (PAP-89), the QA viewer (PAP-137) and the
// PR status comment (PAP-97).
import { z } from 'zod';
import { ArtifactPathSchema } from '../artifacts.js';
import { defineGateReport } from './report.js';

export const VISUAL_IMAGE_STATUSES = ['pass', 'diff', 'new', 'missing'] as const;
export const VisualImageStatusSchema = z.enum(VISUAL_IMAGE_STATUSES);

export const THEMES = ['light', 'dark', 'hc'] as const;
export const ThemeSchema = z.enum(THEMES);

export const VisualImageSchema = z
  .object({
    /** Screenshot id from the PAP-82 grammar (`<page>@<width>/<theme>`). */
    id: z.string().min(1),
    /** Playwright project name (one per breakpoint). */
    project: z.string().min(1),
    theme: ThemeSchema,
    /** Page or story id; `screenshots/<page>/<width>.png` is the file convention. */
    page: z.string().min(1).optional(),
    width: z.number().int().positive().optional(),
    status: VisualImageStatusSchema,
    /** Fraction of pixels that differ, 0..1; 0 on `pass`. */
    diffRatio: z.number().min(0).max(1),
    paths: z
      .object({
        actual: ArtifactPathSchema,
        expected: ArtifactPathSchema.optional(),
        diff: ArtifactPathSchema.optional(),
      })
      .strict(),
  })
  .strict();
export type VisualImage = z.infer<typeof VisualImageSchema>;

export const VisualDataSchema = z
  .object({
    images: z.array(VisualImageSchema),
    /** Contact sheets per page (PAP-248). */
    sheets: z.array(z.object({ page: z.string().min(1), path: ArtifactPathSchema }).strict()),
    /** Baseline the diffs were computed against. */
    baselineSha: z.string().min(1).optional(),
  })
  .strict();
export type VisualData = z.infer<typeof VisualDataSchema>;

export const VisualReportSchema = defineGateReport('visual', VisualDataSchema);
export type VisualReport = z.infer<typeof VisualReportSchema>;
