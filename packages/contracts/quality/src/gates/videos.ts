// `videos.json` (PAP-83): video replays of critical flows per width and theme.
import { z } from 'zod';
import { ArtifactPathSchema } from '../artifacts.js';
import { defineGateReport } from './report.js';
import { ThemeSchema } from './visual.js';

export const VideoStepSchema = z
  .object({ note: z.string().min(1), atMs: z.number().int().nonnegative() })
  .strict();

export const VideoSchema = z
  .object({
    flowId: z.string().min(1),
    width: z.number().int().positive(),
    theme: ThemeSchema,
    mp4: ArtifactPathSchema,
    poster: ArtifactPathSchema,
    /** 3x4 contact sheet PNG. */
    sheet: ArtifactPathSchema.optional(),
    durationMs: z.number().int().nonnegative(),
    steps: z.array(VideoStepSchema),
    /** Signed URL to the stored recording (MinIO); `expiresAt` lives on the matching ArtifactRef. */
    url: z.url().optional(),
  })
  .strict();
export type Video = z.infer<typeof VideoSchema>;

export const VideosDataSchema = z.object({ videos: z.array(VideoSchema) }).strict();
export type VideosData = z.infer<typeof VideosDataSchema>;

export const VideosReportSchema = defineGateReport('videos', VideosDataSchema);
export type VideosReport = z.infer<typeof VideosReportSchema>;
