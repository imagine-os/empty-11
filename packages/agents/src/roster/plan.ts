/**
 * plan.json `agents[]` as the roster converter reads it (PAP-284).
 *
 * The plan is the structural source of truth for the org chart: which leads exist, whom they report
 * to, which subs each lead spawns, their plugins and their access prose. Everything else on a
 * character (tools, MCP servers, skills, budgets, escalation, prompts) is completed by hand in
 * `packages/agents/characters/*.yaml` and preserved by `plan-to-roster --merge`.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const PlanSubAgentSchema = z.object({ name: z.string().min(1), role: z.string().min(1) });

export const PlanAgentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  reportsTo: z.string().min(1),
  tools: z.array(z.string()).default([]),
  access: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
  subAgents: z.array(PlanSubAgentSchema).default([]),
});

/** `agents[]` on its own, or a whole plan.json document carrying `agents`. */
export const PlanAgentsSchema = z.union([
  z.array(PlanAgentSchema),
  z.object({ agents: z.array(PlanAgentSchema) }).transform((p) => p.agents),
]);

export type PlanAgent = z.output<typeof PlanAgentSchema>;
export type PlanSubAgent = z.output<typeof PlanSubAgentSchema>;

/** Parse a plan document (the `agents[]` array or a full plan.json). */
export function parsePlanAgents(input: unknown): PlanAgent[] {
  return PlanAgentsSchema.parse(input);
}

export function readPlanAgents(path: string): PlanAgent[] {
  return parsePlanAgents(JSON.parse(readFileSync(path, 'utf8')));
}

/** `"Motion and Input Stylist"` -> `motion-and-input-stylist`; `"P&L Analyst"` -> `p-l-analyst`. */
export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Plan access prose -> registry scopes (`resource:verb[:qualifier]`). The table mirrors the
 * normalisation recorded in `src/schema/scopes.ts`. Negations ("no merge rights", "no prod write")
 * drop: the absence of a scope is the denial. Unknown prose passes through unchanged so the
 * validator reports it as `UNKNOWN_SCOPE` instead of the converter guessing.
 */
export function normaliseAccess(raw: string): string[] {
  const s = raw.trim();
  const fixed: Record<string, string[]> = {
    'forgejo:org-admin': ['forgejo:admin:org'],
    'github:imagine-os admin': ['github:admin:imagine-os'],
    'budget:read-write': ['budget:write'],
    'prod:read-only': ['prod:read'],
    'repo:write (all)': ['repo:write:all'],
    'vps:deploy': ['vps:deploy:staging'],
    'postgres:migrate (staging)': ['postgres:migrate:staging'],
    'secrets:infra': ['secrets:read:infra'],
    'notion:read-write': ['notion:write'],
    'repo:review + request-changes': ['repo:review'],
    'no merge rights': [],
    'no prod write': [],
    'yjs-server:deploy (staging)': ['yjs-server:deploy:staging'],
    'stripe:test-mode write': ['stripe:write:test'],
    'stripe:live read-only': ['stripe:read:live'],
    'ledger:post (staging)': ['ledger:post:staging'],
    'crm:write': ['crm:write:staging'],
    'email:send (sandbox until approved)': ['email:send:sandbox'],
  };
  if (s in fixed) return fixed[s] as string[];
  const repo = /^repo:write (.+)$/.exec(s);
  if (repo)
    return (repo[1] as string).split(/\s+/).map((p) => `repo:write:${p.replace(/\/$/, '')}`);
  return [s];
}

/** The org chart the plan encodes, in kebab ids and plan order. */
export interface PlanStructure {
  readonly leads: readonly {
    readonly name: string;
    readonly displayName: string;
    readonly reportsTo: string;
    readonly subs: readonly string[];
  }[];
}

export function planStructure(plan: readonly PlanAgent[]): PlanStructure {
  return {
    leads: plan.map((a) => ({
      name: kebab(a.name),
      displayName: a.name,
      reportsTo: kebab(a.reportsTo),
      subs: a.subAgents.map((s) => kebab(s.name)),
    })),
  };
}
