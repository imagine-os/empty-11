// `vision.json` (PAP-84): the vision agent's inspection of screenshots. Its findings are
// ordinary `Finding`s in the envelope; `data.images` links each image to the ids it produced.
import { z } from 'zod';
import { defineGateReport } from './report.js';

export const VISION_FOCUS = ['truncation', 'mirroring', 'overflow', 'contrast'] as const;
export const VisionFocusSchema = z.enum(VISION_FOCUS);

export const VisionImageSchema = z
  .object({
    /** Screenshot id, the same as `visual.json` `images[].id`. */
    id: z.string().min(1),
    /** 0..1, the agent's overall layout score for the image. */
    layoutScore: z.number().min(0).max(1),
    /** Finding ids (envelope `findings[].id`) raised on this image. */
    findings: z.array(z.string().regex(/^[0-9a-f]{10}$/)),
    /** Bounding boxes per finding, in percent of the image. */
    boxes: z
      .array(
        z
          .object({
            findingId: z.string().regex(/^[0-9a-f]{10}$/),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            w: z.number().min(0).max(100),
            h: z.number().min(0).max(100),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export type VisionImage = z.infer<typeof VisionImageSchema>;

export const VisionDataSchema = z
  .object({
    images: z.array(VisionImageSchema),
    /** Set on a focused run (pseudo-locale, RTL); the digest groups these separately. */
    focus: z.array(VisionFocusSchema).optional(),
    /** Model and effort the inspector ran on; priced by PAP-98. */
    model: z.string().min(1).optional(),
    costUsd: z.number().nonnegative().optional(),
  })
  .strict();
export type VisionData = z.infer<typeof VisionDataSchema>;

export const VisionReportSchema = defineGateReport('vision', VisionDataSchema);
export type VisionReport = z.infer<typeof VisionReportSchema>;
