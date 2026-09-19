// The kind registry: one entry per gate artifact, `reports/<kind>.json` (PAP-239, plus the
// round-4 kinds PAP-462 enumerates). A kind or status present here and not in the docs table,
// or the other way round, fails the drift test and `pnpm build`.
import type { z } from 'zod';
import type { GateStatusName } from '../status.js';
import { CalibrationSummaryReportSchema } from './calibration.js';
import { CertificationReportSchema } from './certification.js';
import { ConformanceReportSchema } from './conformance.js';
import { CoverageReportSchema } from './coverage.js';
import { E2eReportSchema } from './e2e.js';
import { EdgecasesReportSchema } from './edgecases.js';
import { FlakesDeltaReportSchema } from './flakes-delta.js';
import { Gate1ReportSchema } from './gate1.js';
import { MigrationsReportSchema } from './migrations.js';
import { MutationReportSchema } from './mutation.js';
import { PerfReportSchema } from './perf.js';
import { ReviewReportSchema } from './review.js';
import { ReviewCostReportSchema } from './review-cost.js';
import { SecurityReportSchema } from './security.js';
import { VideosReportSchema } from './videos.js';
import { VisionReportSchema } from './vision.js';
import { VisualReportSchema } from './visual.js';

export * from './calibration.js';
export * from './certification.js';
export * from './conformance.js';
export * from './coverage.js';
export * from './e2e.js';
export * from './edgecases.js';
export * from './flakes-delta.js';
export * from './gate1.js';
export * from './migrations.js';
export * from './mutation.js';
export * from './perf.js';
export * from './report.js';
export * from './review.js';
export * from './review-cost.js';
export * from './security.js';
export * from './videos.js';
export * from './vision.js';
export * from './visual.js';

/** Every artifact kind, in the order the docs table lists them. `reports/<kind>.json`. */
export const GATE_KINDS = [
  'gate1',
  'security',
  'perf',
  'coverage',
  'migrations',
  'conformance',
  'review',
  'review-cost',
  'visual',
  'videos',
  'vision',
  'e2e',
  'edgecases',
  'flakes-delta',
  'mutation',
  'calibration',
  'certification',
] as const;
export type GateKind = (typeof GATE_KINDS)[number];

export const GATE_REPORT_SCHEMAS = {
  gate1: Gate1ReportSchema,
  security: SecurityReportSchema,
  perf: PerfReportSchema,
  coverage: CoverageReportSchema,
  migrations: MigrationsReportSchema,
  conformance: ConformanceReportSchema,
  review: ReviewReportSchema,
  'review-cost': ReviewCostReportSchema,
  visual: VisualReportSchema,
  videos: VideosReportSchema,
  vision: VisionReportSchema,
  e2e: E2eReportSchema,
  edgecases: EdgecasesReportSchema,
  'flakes-delta': FlakesDeltaReportSchema,
  mutation: MutationReportSchema,
  calibration: CalibrationSummaryReportSchema,
  certification: CertificationReportSchema,
} as const satisfies Record<GateKind, z.ZodType>;

/** The parsed report of one kind. */
export type GateReportOf<K extends GateKind> = z.infer<(typeof GATE_REPORT_SCHEMAS)[K]>;
export type AnyGateReport = { [K in GateKind]: GateReportOf<K> }[GateKind];

export interface GateKindInfo {
  /** Issue that produces the artifact. */
  owner: string;
  /** Statuses this artifact's gate publishes; empty for informational artifacts. */
  statuses: readonly GateStatusName[];
  /** Who reads it. */
  consumers: readonly string[];
  /** One line for the docs table. */
  summary: string;
}

export const GATE_KIND_INFO: Record<GateKind, GateKindInfo> = {
  gate1: {
    owner: 'PAP-78',
    statuses: ['gate/1-static'],
    consumers: ['PAP-81', 'PAP-243', 'PAP-89', 'PAP-97'],
    summary: 'static gate: jobs, failures, PR class, env',
  },
  security: {
    owner: 'PAP-80',
    statuses: ['gate/1-security', 'gate/dast'],
    consumers: ['PAP-245', 'PAP-88', 'PAP-89', 'PAP-97', 'PAP-217'],
    summary: 'merged scanner results, SBOM, waiver state; DAST entries carry `tool: zap`',
  },
  perf: {
    owner: 'PAP-87',
    statuses: ['gate/1-perf'],
    consumers: ['PAP-242', 'PAP-88', 'PAP-89', 'PAP-217'],
    summary: 'web vitals and bundle budgets; `data.api` from PAP-242',
  },
  coverage: {
    owner: 'PAP-681',
    statuses: ['gate/1-coverage'],
    consumers: ['PAP-243', 'PAP-89'],
    summary: 'diff coverage of changed lines against the budget',
  },
  migrations: {
    owner: 'PAP-682',
    statuses: ['gate/1-migrations'],
    consumers: ['PAP-254', 'PAP-89'],
    summary: 'per-migration reversibility and rule hits; `migration-ack`',
  },
  conformance: {
    owner: 'PAP-441',
    statuses: ['gate/1-static'],
    consumers: ['PAP-248', 'PAP-442', 'PAP-446'],
    summary: 'module conformance suites against the default implementation',
  },
  review: {
    owner: 'PAP-243',
    statuses: [
      'gate/2-correctness',
      'gate/2-security',
      'gate/2-spec',
      'gate/2-docs',
      'gate/2-review',
    ],
    consumers: ['PAP-97', 'PAP-241', 'PAP-89', 'PAP-110'],
    summary: 'one reviewer run: findings, rubric coverage, verdict, model routing',
  },
  'review-cost': {
    owner: 'PAP-243',
    statuses: [],
    consumers: ['PAP-98', 'PAP-680'],
    summary: 'tokens, cost and duration per reviewer run',
  },
  visual: {
    owner: 'PAP-248',
    statuses: ['gate/3-visual'],
    consumers: ['PAP-84', 'PAP-89', 'PAP-137', 'PAP-97'],
    summary: 'screenshots per breakpoint and theme with baseline diffs and contact sheets',
  },
  videos: {
    owner: 'PAP-83',
    statuses: ['gate/3-video'],
    consumers: ['PAP-84', 'PAP-89', 'PAP-137', 'PAP-90'],
    summary: 'flow recordings per width and theme with step captions',
  },
  vision: {
    owner: 'PAP-84',
    statuses: ['gate/3-vision'],
    consumers: ['PAP-85', 'PAP-89', 'PAP-137'],
    summary: 'vision agent findings per screenshot with layout scores and boxes',
  },
  e2e: {
    owner: 'PAP-86',
    statuses: ['gate/3-e2e'],
    consumers: ['PAP-90', 'PAP-89', 'PAP-687', 'PAP-690'],
    summary: 'functional flow runs per project, engine and target',
  },
  edgecases: {
    owner: 'PAP-85',
    statuses: ['gate/4-edge'],
    consumers: ['PAP-251', 'PAP-89', 'PAP-90'],
    summary: 'edge-case scenario matrix with repro test paths',
  },
  'flakes-delta': {
    owner: 'PAP-90',
    statuses: [],
    consumers: ['PAP-90', 'PAP-89'],
    summary: 'tests that passed only on retry in this run',
  },
  mutation: {
    owner: 'PAP-686',
    statuses: [],
    consumers: ['PAP-89'],
    summary: 'nightly mutation scores and survivors per package',
  },
  calibration: {
    owner: 'PAP-241',
    statuses: [],
    consumers: ['PAP-89'],
    summary: 'weekly reviewer agreement against the calibration set',
  },
  certification: {
    owner: 'PAP-254',
    statuses: [],
    consumers: ['PAP-88', 'PAP-89', 'PAP-97'],
    summary: 'release-candidate checks and the certified flag',
  },
};

export function isGateKind(value: unknown): value is GateKind {
  return typeof value === 'string' && (GATE_KINDS as readonly string[]).includes(value);
}

/** `reports/<kind>.json`, the one file name a kind is written to. */
export function artifactFileName(kind: GateKind): `${GateKind}.json` {
  return `${kind}.json`;
}

/** Inverse of `artifactFileName`; accepts a bare name or a path ending in it. */
export function kindFromFileName(name: string): GateKind | undefined {
  const base = name.split('/').at(-1) ?? name;
  const stem = base.endsWith('.json') ? base.slice(0, -'.json'.length) : base;
  return isGateKind(stem) ? stem : undefined;
}
