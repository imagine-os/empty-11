/**
 * Roster policy (PAP-284, round-4 defaults): the numbers and lists the converter completes a plan
 * skeleton with. Everything here is a default the issue's `Model` / `Effort` labels override for a
 * session (`resolveModel()`, PAP-103 round-4 amendment); prompts never name a model.
 *
 * Leads default to `claude-opus-5` / `high` / `acceptEdits`. Sentinel's reviewer subs run
 * `claude-opus-5` / `high` in `plan` mode with Write and Edit denied (Sonnet 5 / high when the
 * builder was Sonnet, decided per review). Read-mostly subs run `claude-sonnet-5` / `medium`.
 * Fable 5.1 is reserved for the keystone specs and release-candidate reviews as labelled in Linear
 * and appears nowhere in the roster defaults.
 */
import type { CharacterInput, EscalationRule, RosterInput } from '../schema/character.ts';

export const DAILY_ALLOWANCE_USD = 700;

/** Lead shares of the daily allowance, percent. Sentinel 30, Atlas 8, research (Scout) 5, builders share the rest. */
export const LEAD_SHARES: Readonly<Record<string, number>> = {
  atlas: 8,
  forge: 20,
  iris: 8,
  quill: 10,
  sentinel: 30,
  nova: 12,
  ledger: 4,
  beacon: 3,
  scout: 5,
};

/** How many sessions of a lead PAP-99 may run at once (character sheets). */
export const LEAD_PARALLELISM: Readonly<Record<string, number>> = {
  atlas: 1,
  forge: 6,
  iris: 3,
  quill: 2,
  sentinel: 8,
  nova: 4,
  ledger: 2,
  beacon: 2,
  scout: 2,
};

export const LEAD_SESSION = { perSessionUsd: 40, maxTurns: 200 } as const;
export const SUB_SESSION = { perSessionUsd: 15, maxTurns: 80 } as const;

/** Subs the roster runs on `claude-sonnet-5` / `medium` (Agent Roster, "Models"). */
export const READ_MOSTLY_SUBS: readonly string[] = [
  'library-evaluator',
  'prompt-logger',
  'changelog-scribe',
  'token-keeper',
  'motion-and-input-stylist',
  'crm-builder',
  'template-packager',
];

/** The lead whose subs are reviewers: `plan` mode, Write and Edit denied. */
export const REVIEWER_LEAD = 'sentinel';

/** Fallback for a lead added without a share: the research-sized day until Atlas reweights. */
const FALLBACK_SHARE_PCT = 5;

export const ROSTER_DEFAULTS: NonNullable<RosterInput['defaults']> = {
  lead: {
    model: 'claude-opus-5',
    fallbackModel: 'claude-sonnet-5',
    effort: 'high',
    permissionMode: 'acceptEdits',
    budget: {
      perSessionUsd: LEAD_SESSION.perSessionUsd,
      perDayUsd: perDayUsd(FALLBACK_SHARE_PCT),
      maxTurns: LEAD_SESSION.maxTurns,
    },
    memoryMaxTokens: { global: 1000, project: 2000, character: 3000 },
    denyList: 'ops/security/agent-deny.yaml',
  },
  sub: {
    model: 'claude-sonnet-5',
    fallbackModel: 'claude-haiku-4-5',
    effort: 'medium',
    permissionMode: 'acceptEdits',
    budget: {
      perSessionUsd: SUB_SESSION.perSessionUsd,
      perDayUsd: perDayUsd(FALLBACK_SHARE_PCT),
      maxTurns: SUB_SESSION.maxTurns,
    },
    memoryMaxTokens: { global: 1000, project: 2000, character: 1500 },
    denyList: 'ops/security/agent-deny.yaml',
  },
};

export function perDayUsd(sharePct: number, allowance = DAILY_ALLOWANCE_USD): number {
  return Math.round((sharePct / 100) * allowance * 100) / 100;
}

/** Threat model §4 mirrored into every lead's tool deny list. */
export const SECTION_4_DENY: readonly string[] = [
  'Bash(git push * main)',
  'Bash(git push --force*)',
  'Bash(rm -rf *)',
  'Bash(curl * | sh)',
  'Write(.claude/settings.json)',
  'Write(ops/secrets/**)',
  'Edit(.claude/settings.json)',
  'Edit(ops/secrets/**)',
];

export const REVIEWER_DENY: readonly string[] = ['Write', 'Edit'];

/** Escalation rules every lead carries; Atlas swaps the first for its own cycle rule. */
export function sharedLeadEscalation(name: string): EscalationRule[] {
  const first: EscalationRule =
    name === 'atlas'
      ? {
          when: 'a dependency cycle or phase inversion in the blocks graph: break it before the next dispatch and record the fix in the decision log',
          action: 'proceed',
        }
      : {
          when: 'a contract another project consumes must change; a dependency cycle or phase inversion; two sessions on the same files; a third round of builder-reviewer disagreement',
          action: 'escalate',
          to: 'atlas',
        };
  return [
    first,
    {
      when: 'an irreversible external action, spend from the reserve, reversing an architecture decision, anything legal, tax or PCI',
      action: 'needs-justin',
    },
    {
      when: 'anything a spec, ADR or rubric already decides: record the default and continue',
      action: 'proceed',
    },
    {
      when: 'session at 100 percent of its cap: wip commit, footer, stop (PAP-111)',
      action: 'stop',
    },
  ];
}

export function sharedSubEscalation(displayName: string, lead: string): EscalationRule[] {
  return [
    {
      when: `anything outside the ${displayName} lane described above`,
      action: 'escalate',
      to: lead,
    },
    {
      when: 'session at 100 percent of its cap: wip commit, footer, stop (PAP-111)',
      action: 'stop',
    },
  ];
}

export function memoryPath(name: string): NonNullable<CharacterInput['memory']>['path'] {
  return `docs/memory/characters/${name}.md`;
}
