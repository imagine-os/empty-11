import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResolvedRoster } from '../schema/inherit.ts';
import { validateLiveRoster } from './live.ts';
import { planStructure, readPlanAgents } from './plan.ts';
import { countKinds, diffAgainstPlan, renderTree } from './tree.ts';

const PLAN = readPlanAgents(resolve(import.meta.dirname, '../../fixtures/source/plan-agents.json'));
const ORDER = planStructure(PLAN).leads.map((l) => l.name);

describe('agents tree (PAP-284)', () => {
  const roster = validateLiveRoster().roster as ResolvedRoster;

  it('renders justin at the root, Atlas under justin, the eight other leads and every sub indented', () => {
    const tree = renderTree(roster, { order: ORDER });
    const lines = tree.split('\n');
    expect(lines[0]).toBe('justin');
    expect(lines[1]).toMatch(/^└── Atlas — Chief Architect and Orchestrator/);
    expect(lines[2]).toMatch(/^ {4}├── Dispatcher/);
    expect(lines.filter((l) => /^ {4}[├└]── /.test(l))).toHaveLength(3 + 8);
    expect(lines).toHaveLength(1 + 37);
    expect(tree).toContain(
      'Sentinel — Quality Lead  [lead · claude-opus-5 / high / acceptEdits · 30% = $210/day',
    );
    expect(tree).toContain(
      'Code Reviewer — Correctness reviewer  [sub · claude-opus-5 / high / plan · $15 × 80 turns]',
    );
    // Plan order for leads: Forge follows Atlas's subs, Scout is last.
    const leadLines = lines
      .filter((l) => /^ {4}[├└]── /.test(l))
      .map((l) => l.replace(/^ {4}[├└]── /, '').split(' — ')[0]);
    expect(leadLines).toEqual([
      'Dispatcher',
      'Decomposer',
      'Merger',
      'Forge',
      'Iris',
      'Quill',
      'Sentinel',
      'Nova',
      'Ledger',
      'Beacon',
      'Scout',
    ]);
  });

  it('renders names only with --plain', () => {
    const tree = renderTree(roster, { details: false });
    expect(tree).not.toContain('[');
    // Without an order, siblings sort alphabetically: Sentinel closes the list.
    expect(tree).toContain('├── Scout — Library and Migration Researcher');
    expect(tree).toContain('└── Sentinel — Quality Lead');
  });

  it('matches plan.json structure', () => {
    expect(diffAgainstPlan(roster, PLAN)).toEqual([]);
    expect(countKinds(roster)).toEqual({ leads: 9, subs: 28 });
  });

  it('names every structural difference', () => {
    const mutated: ResolvedRoster = {
      ...roster,
      characters: roster.characters.map((c) =>
        c.name === 'merger'
          ? { ...c, name: 'releaser' }
          : c.name === 'nova'
            ? { ...c, reportsTo: 'forge' }
            : c,
      ),
    };
    const diff = diffAgainstPlan(mutated, PLAN);
    expect(diff).toContain('lead nova: reportsTo forge, plan atlas');
    expect(diff.some((d) => d.startsWith('lead atlas: subs ['))).toBe(true);
    expect(diff).toContain('sub releaser is in the roster but not in the plan');
    expect(
      diffAgainstPlan(
        { ...roster, characters: roster.characters.filter((c) => c.name !== 'scout') },
        PLAN,
      ),
    ).toContain('lead scout is in the plan but not in the roster');
  });
});
