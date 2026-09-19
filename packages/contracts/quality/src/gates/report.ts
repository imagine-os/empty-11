// `GateReport<K>`: the envelope every gate artifact shares (PAP-239 "Spec").
// One builder, `defineGateReport(kind, dataSchema)`, so the seventeen kinds differ only
// in `kind` and `data`, and every consumer (orchestrator, digest, QA viewer) reads the
// same envelope without knowing the kind.
import { z } from 'zod';
import { ArtifactRefSchema } from '../artifacts.js';
import { FindingSchema, gateDecision } from '../finding.js';
import { GateStateSchema } from '../status.js';

/**
 * Current envelope version. Versioning rule (Interface & Data Contracts §3, shared with
 * the event envelope): a breaking change to the envelope or to a kind's `data` bumps this
 * number, and `readGateReport()` keeps a reader for the previous version for 30 days.
 */
export const GATE_REPORT_VERSION = 1 as const;
export const SUPPORTED_REPORT_VERSIONS = [1] as const;

/** Full or abbreviated git sha, lowercase hex. */
export const ShaSchema = z.string().regex(/^[0-9a-f]{7,40}$/, 'sha is 7..40 lowercase hex chars');

/**
 * Type-equal copy of `ActorRef` from Interface & Data Contracts §1 (`@paperos/core/events`):
 * the agent or service that produced the report. Optional until PAP-96 sessions carry ids.
 */
export const ProducerRefSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(['human', 'agent', 'service', 'anonymous']),
    /** Agent character name (`sentinel`, `forge`, ...) when `type === 'agent'`. */
    character: z.string().min(1).max(64).optional(),
  })
  .strict();
export type ProducerRef = z.infer<typeof ProducerRefSchema>;

/** The envelope fields, without `kind` and `data`. Exported for docs and consumers that build partial views. */
export const GateReportEnvelopeShape = {
  version: z.literal(GATE_REPORT_VERSION),
  /** Commit the gate ran against. */
  sha: ShaSchema,
  /** PR number; absent on `main` and nightly runs. */
  pr: z.number().int().positive().optional(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  status: GateStateSchema,
  /** Shared finding vocabulary (PAP-79). Consumers dedupe by `(reviewer, id)`. */
  findings: z.array(FindingSchema),
  /** One paragraph a human reads first; required even on `error` and `skipped`. */
  summary: z.string().min(1),
  artifacts: z.array(ArtifactRefSchema),
  producer: ProducerRefSchema.optional(),
} as const;

/**
 * Build the report schema of one kind. Strict: an unknown key is an error, not a silent
 * drop, so a producer cannot invent a field no consumer reads.
 *
 * Two envelope rules are enforced across kinds:
 * - `finishedAt` is not before `startedAt`;
 * - a `pass` never carries findings that trip the gate rule (any S0, more than 3 S1,
 *   waivers honoured), so a green status with a blocker in the body cannot exist.
 * A gate that ran but produced nothing usable reports `status: 'error'` with a summary,
 * never an empty `pass` (edge case in the spec); the runner owns that decision.
 */
export function defineGateReport<K extends string, D extends z.ZodType>(kind: K, data: D) {
  return z
    .object({
      kind: z.literal(kind),
      ...GateReportEnvelopeShape,
      data,
    })
    .strict()
    .refine((r) => Date.parse(r.finishedAt) >= Date.parse(r.startedAt), {
      message: 'finishedAt must not precede startedAt',
      path: ['finishedAt'],
    })
    .refine((r) => r.status !== 'pass' || gateDecision(r.findings).status === 'pass', {
      message: 'a pass must not carry findings that trip the gate rule (S0, or more than 3 S1)',
      path: ['status'],
    });
}

/** The TypeScript view of `GateReport<K>` for a given data type. */
export type GateReport<K extends string, D> = {
  kind: K;
  version: typeof GATE_REPORT_VERSION;
  sha: string;
  pr?: number;
  startedAt: string;
  finishedAt: string;
  status: z.infer<typeof GateStateSchema>;
  findings: z.infer<typeof FindingSchema>[];
  summary: string;
  artifacts: z.infer<typeof ArtifactRefSchema>[];
  producer?: ProducerRef;
  data: D;
};
