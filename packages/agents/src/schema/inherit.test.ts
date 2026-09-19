import { describe, expect, it } from 'vitest';
import { type RosterInput, RosterSchema } from './character.ts';
import { resolveInheritance } from './inherit.ts';
import { validateRoster } from './validate.ts';

const defaults = {
  model: 'claude-opus-5',
  fallbackModel: 'claude-sonnet-5',
  effort: 'medium',
  permissionMode: 'default',
  budget: { perSessionUsd: 10, perDayUsd: 20, maxTurns: 30 },
  memoryMaxTokens: { global: 1000, project: 2000, character: 3000 },
} as const;

const roster: RosterInput = {
  schemaVersion: 1,
  defaults: {
    lead: { ...defaults, model: 'claude-fable-5-1' },
    sub: { ...defaults, budget: { perSessionUsd: 5, perDayUsd: 6, maxTurns: 7 } },
  },
  characters: [
    {
      schemaVersion: 1,
      name: 'lead',
      displayName: 'Lead',
      role: 'Lead',
      kind: 'lead',
      reportsTo: 'justin',
      description: 'A lead with explicit effort and a partial budget for the inheritance tests.',
      effort: 'xhigh',
      permissionMode: 'acceptEdits',
      budget: { perDayUsd: 100, dailySharePct: 50 },
      linearLabel: 'Character/Lead',
    },
    {
      schemaVersion: 1,
      name: 'child',
      displayName: 'Child',
      role: 'Child',
      kind: 'sub',
      reportsTo: 'lead',
      parent: 'lead',
      description: 'A sub that overrides only maxTurns and inherits the rest from its lead.',
      budget: { maxTurns: 3 },
    },
    {
      schemaVersion: 1,
      name: 'loner',
      displayName: 'Loner',
      role: 'Loner',
      kind: 'lead',
      reportsTo: 'justin',
      description: 'A lead that sets nothing and takes every roster default.',
      linearLabel: 'Character/Loner',
    },
  ],
};

describe('resolveInheritance', () => {
  const resolved = resolveInheritance(RosterSchema.parse(roster));
  const byName = Object.fromEntries(resolved.characters.map((c) => [c.name, c]));

  it('sub inherits model, effort and permission mode from its parent, then the roster', () => {
    expect(byName.child?.model).toBe('claude-fable-5-1');
    expect(byName.child?.effort).toBe('high');
    expect(byName.child?.permissionMode).toBe('acceptEdits');
    expect(byName.child?.fallbackModel).toBe('claude-sonnet-5');
  });

  it('budget resolves field by field: own, parent, roster default', () => {
    expect(byName.child?.budget).toEqual({ perSessionUsd: 10, perDayUsd: 100, maxTurns: 3 });
    expect(byName.lead?.budget).toEqual({
      perSessionUsd: 10,
      perDayUsd: 100,
      maxTurns: 30,
      dailySharePct: 50,
    });
    expect(byName.loner?.budget).toEqual({ perSessionUsd: 10, perDayUsd: 20, maxTurns: 30 });
  });

  it('memory defaults to the character file with the roster token budget', () => {
    expect(byName.loner?.memory).toEqual({
      path: 'docs/memory/characters/loner.md',
      maxTokens: 3000,
    });
  });

  it('tools, access and mcpServers are not inherited (least privilege)', () => {
    expect(byName.child?.tools).toEqual({ allow: [], deny: [] });
    expect(byName.child?.access).toEqual([]);
  });

  it('never resolves to unlimited: without defaults a missing budget is BUDGET_MISSING', () => {
    const { defaults: _d, ...bare } = roster;
    const r = validateRoster(bare);
    const codes = r.errors.map((e) => `${e.character}:${e.code}:${e.path}`);
    expect(codes).toContain('child:BUDGET_MISSING:budget.perSessionUsd');
    expect(codes).toContain('loner:BUDGET_MISSING:budget.perDayUsd');
    expect(codes).not.toContain('lead:BUDGET_MISSING:budget.perDayUsd');
  });
});
