/**
 * Inheritance resolution (PAP-103): a sub inherits its parent's defaults, then the roster's.
 *
 * Precedence per field: the character's own value, then (for subs) the parent's resolved value,
 * then `roster.defaults[kind]`. Budgets resolve field by field so a sub may override only
 * `maxTurns`. Nothing is ever unlimited: every resolved character has a full budget.
 *
 * Tools, MCP servers and access are NOT inherited: an omitted list on a sub means "none",
 * which is the least-privilege default PAP-106 builds bundles from.
 */
import type { BudgetSpec, Character, Roster } from './character.ts';
import { DEFAULT_MODEL } from './models.ts';

export interface ResolvedCharacter extends Character {
  model: string;
  fallbackModel: string;
  effort: Character['effort'] & string;
  permissionMode: Character['permissionMode'] & string;
  maxParallelSessions: number;
  tools: NonNullable<Character['tools']>;
  memory: NonNullable<Character['memory']>;
  budget: BudgetSpec;
  denyList: string;
}

export interface ResolvedRoster extends Omit<Roster, 'characters'> {
  characters: ResolvedCharacter[];
}

export function resolveInheritance(roster: Roster): ResolvedRoster {
  const byName = new Map(roster.characters.map((c) => [c.name, c] as const));
  const cache = new Map<string, ResolvedCharacter>();

  const resolve = (c: Character, trail: string[]): ResolvedCharacter => {
    const cached = cache.get(c.name);
    if (cached) return cached;
    if (trail.includes(c.name)) {
      // A reportsTo cycle is a validation error (REPORTS_TO_CYCLE); resolution falls back to roster defaults.
      return fromDefaults(c, roster, undefined);
    }
    const parent = c.kind === 'sub' && c.parent !== undefined ? byName.get(c.parent) : undefined;
    const resolvedParent = parent ? resolve(parent, [...trail, c.name]) : undefined;
    const out = fromDefaults(c, roster, resolvedParent);
    cache.set(c.name, out);
    return out;
  };

  return {
    ...roster,
    characters: roster.characters.map((c) => resolve(c, [])),
  };
}

function fromDefaults(
  c: Character,
  roster: Roster,
  parent: ResolvedCharacter | undefined,
): ResolvedCharacter {
  const d = roster.defaults?.[c.kind];
  // A missing value resolves to NaN so validateRoster reports BUDGET_MISSING; never "unlimited".
  const budget: BudgetSpec = {
    perSessionUsd:
      c.budget?.perSessionUsd ??
      parent?.budget.perSessionUsd ??
      d?.budget.perSessionUsd ??
      Number.NaN,
    perDayUsd: c.budget?.perDayUsd ?? parent?.budget.perDayUsd ?? d?.budget.perDayUsd ?? Number.NaN,
    maxTurns: c.budget?.maxTurns ?? parent?.budget.maxTurns ?? d?.budget.maxTurns ?? Number.NaN,
  };
  // The daily share is a lead-level number; subs draw from their lead's day budget and carry none.
  const share =
    c.budget?.dailySharePct ?? (c.kind === 'lead' ? d?.budget.dailySharePct : undefined);
  if (share !== undefined) budget.dailySharePct = share;
  return {
    ...c,
    model: c.model ?? parent?.model ?? d?.model ?? DEFAULT_MODEL,
    fallbackModel: c.fallbackModel ?? parent?.fallbackModel ?? d?.fallbackModel ?? DEFAULT_MODEL,
    effort: c.effort ?? parent?.effort ?? d?.effort ?? 'high',
    permissionMode: c.permissionMode ?? parent?.permissionMode ?? d?.permissionMode ?? 'default',
    maxParallelSessions: c.maxParallelSessions ?? 1,
    tools: c.tools ?? { allow: [], deny: [] },
    memory: c.memory ?? {
      path: `docs/memory/characters/${c.name}.md`,
      maxTokens: d?.memoryMaxTokens.character ?? 3000,
    },
    budget,
    denyList: c.denyList ?? parent?.denyList ?? d?.denyList ?? 'ops/security/agent-deny.yaml',
  };
}
