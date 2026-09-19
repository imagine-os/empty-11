/**
 * Org tree rendering and plan diff (PAP-284, `pnpm --filter @paperos/agents tree [--check]`).
 */

import { HUMAN_PRINCIPAL } from '../schema/character.ts';
import type { ResolvedCharacter, ResolvedRoster } from '../schema/inherit.ts';
import type { PlanAgent } from './plan.ts';
import { planStructure } from './plan.ts';

export interface TreeOptions {
  /** Print model / effort / mode and budget after each name. Default true. */
  readonly details?: boolean;
  /** Sibling order (plan order, usually); names not listed sort after, alphabetically. */
  readonly order?: readonly string[];
}

/** Render the roster as an indented org tree rooted at `justin`. */
export function renderTree(roster: ResolvedRoster, options: TreeOptions = {}): string {
  const details = options.details ?? true;
  const byName = new Map(roster.characters.map((c) => [c.name, c] as const));
  const leads = roster.characters.filter((c) => c.kind === 'lead');
  const rank = new Map((options.order ?? []).map((n, i) => [n, i] as const));
  const sort = (xs: ResolvedCharacter[]): ResolvedCharacter[] =>
    xs.sort((a, b) => {
      const ra = rank.get(a.name) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.name) ?? Number.MAX_SAFE_INTEGER;
      return ra === rb ? a.name.localeCompare(b.name) : ra - rb;
    });
  const children = (name: string): ResolvedCharacter[] => {
    const lead = byName.get(name);
    const subs = roster.characters.filter((c) => c.kind === 'sub' && c.parent === name);
    const subOrder = new Map((lead?.subCharacters ?? []).map((n, i) => [n, i] as const));
    subs.sort((a, b) => (subOrder.get(a.name) ?? 99) - (subOrder.get(b.name) ?? 99));
    return [...subs, ...sort(leads.filter((c) => c.reportsTo === name))];
  };
  const lines: string[] = [HUMAN_PRINCIPAL];
  const roots = sort(
    leads.filter((c) => c.reportsTo === HUMAN_PRINCIPAL || !byName.has(c.reportsTo)),
  );
  const walk = (nodes: ResolvedCharacter[], prefix: string): void => {
    nodes.forEach((node, i) => {
      const last = i === nodes.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${label(node, details)}`);
      walk(children(node.name), `${prefix}${last ? '    ' : '│   '}`);
    });
  };
  walk(roots, '');
  return lines.join('\n');
}

function label(c: ResolvedCharacter, details: boolean): string {
  const head = `${c.displayName} — ${c.role}`;
  if (!details) return head;
  const run = `${c.model} / ${c.effort} / ${c.permissionMode}`;
  const money =
    c.kind === 'lead'
      ? `${c.budget.dailySharePct ?? '?'}% = $${c.budget.perDayUsd}/day, $${c.budget.perSessionUsd} × ${c.budget.maxTurns} turns`
      : `$${c.budget.perSessionUsd} × ${c.budget.maxTurns} turns`;
  const tag = c.kind === 'lead' ? ` · ${c.linearLabel ?? 'no label'}` : '';
  return `${head}  [${c.kind} · ${run} · ${money}${tag}]`;
}

/** Differences between the roster's org chart and plan.json `agents[]`. Empty means they match. */
export function diffAgainstPlan(roster: ResolvedRoster, plan: readonly PlanAgent[]): string[] {
  const out: string[] = [];
  const structure = planStructure(plan);
  const leads = roster.characters.filter((c) => c.kind === 'lead');
  const leadNames = new Set(leads.map((c) => c.name));
  for (const p of structure.leads) {
    const lead = leads.find((c) => c.name === p.name);
    if (!lead) {
      out.push(`lead ${p.name} is in the plan but not in the roster`);
      continue;
    }
    if (lead.displayName !== p.displayName)
      out.push(`lead ${p.name}: displayName ${lead.displayName}, plan ${p.displayName}`);
    if (lead.reportsTo !== p.reportsTo)
      out.push(`lead ${p.name}: reportsTo ${lead.reportsTo}, plan ${p.reportsTo}`);
    const subs = roster.characters
      .filter((c) => c.kind === 'sub' && c.parent === p.name)
      .map((c) => c.name);
    if (subs.slice().sort().join(',') !== p.subs.slice().sort().join(','))
      out.push(`lead ${p.name}: subs [${subs.join(', ')}], plan [${p.subs.join(', ')}]`);
    if (lead.subCharacters && lead.subCharacters.join(',') !== p.subs.join(','))
      out.push(
        `lead ${p.name}: subCharacters order [${lead.subCharacters.join(', ')}], plan [${p.subs.join(', ')}]`,
      );
  }
  for (const name of leadNames)
    if (!structure.leads.some((p) => p.name === name))
      out.push(`lead ${name} is in the roster but not in the plan`);
  const planSubs = new Set(structure.leads.flatMap((p) => p.subs));
  for (const c of roster.characters)
    if (c.kind === 'sub' && !planSubs.has(c.name))
      out.push(`sub ${c.name} is in the roster but not in the plan`);
  return out;
}

export function countKinds(roster: ResolvedRoster): { leads: number; subs: number } {
  return {
    leads: roster.characters.filter((c) => c.kind === 'lead').length,
    subs: roster.characters.filter((c) => c.kind === 'sub').length,
  };
}
