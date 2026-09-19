/**
 * plan.json -> roster conversion (PAP-284).
 *
 * `convertPlan()` turns `agents[]` into 37 character documents plus the roster defaults. A fresh
 * skeleton carries the plan-owned fields and the policy defaults; the hand-completed parts (tools,
 * MCP servers, skills, sheet-derived scopes, escalation prose) are added in the YAML files and kept
 * by `mergeCharacter()`, which only rewrites the plan-owned fields when the plan is re-run.
 */
import { type CharacterInput, CharacterSchema, type RosterInput } from '../schema/character.ts';
import { resolveScope, SCOPES } from '../schema/scopes.ts';
import { kebab, normaliseAccess, type PlanAgent } from './plan.ts';
import {
  DAILY_ALLOWANCE_USD,
  LEAD_PARALLELISM,
  LEAD_SESSION,
  LEAD_SHARES,
  memoryPath,
  perDayUsd,
  READ_MOSTLY_SUBS,
  REVIEWER_DENY,
  REVIEWER_LEAD,
  ROSTER_DEFAULTS,
  SECTION_4_DENY,
  SUB_SESSION,
  sharedLeadEscalation,
  sharedSubEscalation,
} from './policy.ts';

/** Fields the plan owns; `mergeCharacter` overwrites them and leaves every other field alone. */
export const PLAN_OWNED_FIELDS = [
  'name',
  'displayName',
  'kind',
  'reportsTo',
  'parent',
  'linearLabel',
  'subCharacters',
] as const;

export interface ConvertOptions {
  readonly allowance?: number;
  readonly shares?: Readonly<Record<string, number>>;
}

export interface ConvertedRoster {
  /** `roster.yaml` without `characters` (they live one per file). */
  readonly roster: Omit<RosterInput, 'characters'>;
  /** Plan order: each lead followed by its subs. */
  readonly characters: readonly CharacterInput[];
}

export function convertPlan(
  plan: readonly PlanAgent[],
  options: ConvertOptions = {},
): ConvertedRoster {
  const allowance = options.allowance ?? DAILY_ALLOWANCE_USD;
  const shares = options.shares ?? LEAD_SHARES;
  const characters: CharacterInput[] = [];
  for (const a of plan) {
    const lead = leadSkeleton(a, shares, allowance);
    characters.push(lead);
    for (const s of a.subAgents) characters.push(subSkeleton(s.name, s.role, lead));
  }
  return {
    roster: { schemaVersion: 1, dailyAllowanceUsd: allowance, defaults: ROSTER_DEFAULTS },
    characters,
  };
}

function leadSkeleton(
  a: PlanAgent,
  shares: Readonly<Record<string, number>>,
  allowance: number,
): CharacterInput {
  const name = kebab(a.name);
  const [title, ...rest] = a.role.split(':');
  const remit = rest.join(':').trim();
  const share = shares[name];
  const budget: NonNullable<CharacterInput['budget']> = {
    perSessionUsd: LEAD_SESSION.perSessionUsd,
    maxTurns: LEAD_SESSION.maxTurns,
    ...(share === undefined
      ? {}
      : { perDayUsd: perDayUsd(share, allowance), dailySharePct: share }),
  };
  const parallel = LEAD_PARALLELISM[name];
  return {
    schemaVersion: 1,
    name,
    displayName: a.name,
    role: (title as string).trim(),
    kind: 'lead',
    reportsTo: kebab(a.reportsTo),
    description: remit ? `Use for ${lowerFirst(remit)}.` : `Use for ${lowerFirst(a.role)}.`,
    ...(parallel === undefined ? {} : { maxParallelSessions: parallel }),
    tools: { allow: [], deny: [...SECTION_4_DENY] },
    access: uniq(a.access.flatMap(normaliseAccess)),
    plugins: [...a.plugins],
    memory: { path: memoryPath(name), maxTokens: ROSTER_DEFAULTS.lead.memoryMaxTokens.character },
    budget,
    escalation: sharedLeadEscalation(name),
    linearLabel: `Character/${a.name.replace(/[^A-Za-z]/g, '')}`,
    subCharacters: a.subAgents.map((s) => kebab(s.name)),
  };
}

function subSkeleton(displayName: string, role: string, lead: CharacterInput): CharacterInput {
  const name = kebab(displayName);
  const reviewer = lead.name === REVIEWER_LEAD;
  const readMostly = READ_MOSTLY_SUBS.includes(name);
  const skeleton: CharacterInput = {
    schemaVersion: 1,
    name,
    displayName,
    role,
    kind: 'sub',
    reportsTo: lead.name,
    parent: lead.name,
    description: `Use for ${lowerFirst(role)}.`,
    // Reviewers and read-mostly subs pin their model; every other sub inherits its lead.
    ...(reviewer ? { model: 'claude-opus-5', effort: 'high', permissionMode: 'plan' } : {}),
    ...(readMostly
      ? { model: 'claude-sonnet-5', fallbackModel: 'claude-haiku-4-5', effort: 'medium' }
      : {}),
    tools: { allow: [], deny: reviewer ? [...REVIEWER_DENY] : [] },
    // Missing access on a sub: the lead's read-class subset, never more (PAP-284 edge case).
    access: (lead.access ?? []).filter((s) => resolveScope(s)?.definition.class === 'read'),
    memory: { path: memoryPath(name), maxTokens: ROSTER_DEFAULTS.sub.memoryMaxTokens.character },
    budget: { perSessionUsd: SUB_SESSION.perSessionUsd, maxTurns: SUB_SESSION.maxTurns },
    escalation: sharedSubEscalation(displayName, lead.name),
  };
  return skeleton;
}

/**
 * Re-run merge: the plan-owned fields come from `generated`, everything else from `existing`.
 * Plan scopes are unioned into `access` (hand-added scopes stay); plan plugins likewise.
 */
export function mergeCharacter(
  existing: CharacterInput,
  generated: CharacterInput,
): CharacterInput {
  const out: Record<string, unknown> = { ...existing };
  for (const key of PLAN_OWNED_FIELDS) {
    if (generated[key] === undefined) delete out[key];
    else out[key] = generated[key];
  }
  if (generated.kind === 'lead') {
    out.access = uniq([...(existing.access ?? []), ...(generated.access ?? [])]);
    out.plugins = uniq([...(existing.plugins ?? []), ...(generated.plugins ?? [])]);
  }
  const parsed = CharacterSchema.safeParse(out);
  if (!parsed.success) {
    throw new Error(
      `merge of ${generated.name} is not a valid character: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }
  // Return the raw document, not the parsed one: parsing would add every schema default to the file.
  return orderFields(out) as CharacterInput;
}

/** One line per difference between a character file and its plan-derived merge. Empty = in sync. */
export function characterDrift(existing: CharacterInput, generated: CharacterInput): string[] {
  const merged = mergeCharacter(existing, generated);
  const drift: string[] = [];
  for (const key of PLAN_OWNED_FIELDS) {
    if (canonical(existing[key]) !== canonical(merged[key]))
      drift.push(`${key}: file ${show(existing[key])}, plan ${show(merged[key])}`);
  }
  // The plan carries access and plugins for leads only; a sub skeleton's access is a fresh default.
  if (generated.kind === 'lead') {
    for (const s of generated.access ?? [])
      if (!(existing.access ?? []).includes(s)) drift.push(`access: plan scope ${s} missing`);
    for (const p of generated.plugins ?? [])
      if (!(existing.plugins ?? []).includes(p)) drift.push(`plugins: plan plugin ${p} missing`);
  }
  return drift;
}

/** Stable key order for writing YAML: the schema's field order, unknown keys last. */
export const FIELD_ORDER: readonly string[] = [
  'schemaVersion',
  'name',
  'displayName',
  'role',
  'kind',
  'reportsTo',
  'parent',
  'description',
  'model',
  'fallbackModel',
  'effort',
  'permissionMode',
  'maxParallelSessions',
  'tools',
  'mcpServers',
  'access',
  'plugins',
  'skills',
  'memory',
  'budget',
  'escalation',
  'denyList',
  'linearLabel',
  'subCharacters',
];

export function orderFields<T extends Record<string, unknown>>(doc: T): T {
  const out: Record<string, unknown> = {};
  for (const key of FIELD_ORDER) if (key in doc) out[key] = doc[key];
  for (const key of Object.keys(doc)) if (!(key in out)) out[key] = doc[key];
  return out as T;
}

/** Every scope id the registry knows; exported for the converter's dry-run report. */
export const REGISTRY_SCOPE_IDS: readonly string[] = SCOPES.map((s) => s.id);

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function uniq<T>(xs: readonly T[]): T[] {
  return [...new Set(xs)];
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}

function show(value: unknown): string {
  return value === undefined ? '(absent)' : JSON.stringify(value);
}
