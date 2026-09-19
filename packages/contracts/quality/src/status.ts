// Gate status registry (PAP-239 "Status registry").
// Every commit status a gate may publish is listed here as a const, so a typo in a
// producer or a consumer fails typecheck instead of leaving a PR waiting on a status
// that will never arrive. Human docs: docs/quality/gates.md, "Artifacts and statuses".
import { z } from 'zod';

/**
 * The twelve statuses of the PAP-239 spec plus the round-4 additions
 * (`gate/1-coverage` PAP-681, `gate/1-migrations` PAP-682, `gate/2-docs` PAP-677,
 * `gate/dast` PAP-675). Order: gate number, then the order the gates run in.
 */
export const GATE_STATUSES = [
  'gate/1-static',
  'gate/1-security',
  'gate/1-perf',
  'gate/1-coverage',
  'gate/1-migrations',
  'gate/2-correctness',
  'gate/2-security',
  'gate/2-spec',
  'gate/2-docs',
  'gate/2-review',
  'gate/3-visual',
  'gate/3-video',
  'gate/3-vision',
  'gate/3-e2e',
  'gate/4-edge',
  'gate/dast',
] as const;
export type GateStatusName = (typeof GATE_STATUSES)[number];
export const GateStatusNameSchema = z.enum(GATE_STATUSES);

/**
 * The one aggregate status PAP-46 marks as required (PAP-78 round-4 amendment). It is
 * computed from the PR class and the registry above; no gate publishes it directly.
 */
export const AGGREGATE_STATUS = 'gates/required' as const;

/** Outcome of a gate, of one job inside it, or of one check in a certification. */
export const GATE_STATES = ['pass', 'fail', 'error', 'skipped'] as const;
export type GateState = (typeof GATE_STATES)[number];
export const GateStateSchema = z.enum(GATE_STATES);

/** The four gates plus the release-candidate checks that run outside a PR. */
export const GATE_NUMBERS = [1, 2, 3, 4, 'rc'] as const;
export type GateNumber = (typeof GATE_NUMBERS)[number];

export interface GateStatusInfo {
  /** Which gate publishes it. */
  gate: GateNumber;
  /** Issue that owns the producer. */
  owner: string;
  /** One line for the docs table. */
  summary: string;
}

/** Docs-table row per status; `docs/quality/gates.md` is generated from it. */
export const GATE_STATUS_INFO: Record<GateStatusName, GateStatusInfo> = {
  'gate/1-static': {
    gate: 1,
    owner: 'PAP-78',
    summary: 'lint, typecheck, test, coverage floor, build, generated-file drift, boundaries',
  },
  'gate/1-security': {
    gate: 1,
    owner: 'PAP-80',
    summary: 'secret, dependency, SAST and container scans merged from SARIF',
  },
  'gate/1-perf': {
    gate: 1,
    owner: 'PAP-87',
    summary: 'Lighthouse and bundle budgets (web), k6 and query budgets (api, PAP-242)',
  },
  'gate/1-coverage': {
    gate: 1,
    owner: 'PAP-681',
    summary: 'diff coverage of the changed lines against the budget',
  },
  'gate/1-migrations': {
    gate: 1,
    owner: 'PAP-682',
    summary: 'migration safety lint; destructive steps need `migration-ack`',
  },
  'gate/2-correctness': {
    gate: 2,
    owner: 'PAP-244',
    summary: 'correctness reviewer agent',
  },
  'gate/2-security': {
    gate: 2,
    owner: 'PAP-245',
    summary: 'security reviewer agent, reads security.json and the waivers',
  },
  'gate/2-spec': {
    gate: 2,
    owner: 'PAP-244',
    summary: 'spec-conformance reviewer agent',
  },
  'gate/2-docs': {
    gate: 2,
    owner: 'PAP-677',
    summary: 'docs-and-spec reviewer agent on specs, docs, prompts, ADRs and changelogs',
  },
  'gate/2-review': {
    gate: 2,
    owner: 'PAP-81',
    summary: 'aggregate of the gate 2 reviewers; the merge gate',
  },
  'gate/3-visual': {
    gate: 3,
    owner: 'PAP-82',
    summary: 'screenshot suite across the breakpoint matrix and themes with baseline diffs',
  },
  'gate/3-video': {
    gate: 3,
    owner: 'PAP-83',
    summary: 'video replays of critical flows per width and theme',
  },
  'gate/3-vision': {
    gate: 3,
    owner: 'PAP-84',
    summary:
      'vision agent inspection of screenshots for overflow, misalignment, contrast, truncation',
  },
  'gate/3-e2e': {
    gate: 3,
    owner: 'PAP-86',
    summary: 'functional Playwright flows; cross-browser and desktop targets (PAP-687, PAP-690)',
  },
  'gate/4-edge': {
    gate: 4,
    owner: 'PAP-85',
    summary: 'edge-case hunter scenarios derived from page specs',
  },
  'gate/dast': {
    gate: 'rc',
    owner: 'PAP-675',
    summary: 'nightly ZAP baseline and weekly authenticated scan on the release-candidate branch',
  },
};

export function isGateStatusName(value: unknown): value is GateStatusName {
  return typeof value === 'string' && (GATE_STATUSES as readonly string[]).includes(value);
}
