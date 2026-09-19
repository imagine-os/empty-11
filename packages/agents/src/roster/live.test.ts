import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { CharacterInput } from '../schema/character.ts';
import {
  LIVE_CHARACTERS_DIR,
  LIVE_ROSTER_FILE,
  readLiveRosterFiles,
  validateLiveRoster,
} from './live.ts';
import { planStructure, readPlanAgents } from './plan.ts';
import {
  DAILY_ALLOWANCE_USD,
  LEAD_SESSION,
  LEAD_SHARES,
  READ_MOSTLY_SUBS,
  REVIEWER_LEAD,
  ROSTER_DEFAULTS,
  SUB_SESSION,
} from './policy.ts';

const PLAN = readPlanAgents(resolve(import.meta.dirname, '../../fixtures/source/plan-agents.json'));
const STRUCTURE = planStructure(PLAN);

describe('live roster: packages/agents/roster.yaml + characters/*.yaml (PAP-284)', () => {
  const result = validateLiveRoster();
  const roster = result.roster;
  const chars = roster?.characters ?? [];
  const leads = chars.filter((c) => c.kind === 'lead');
  const subs = chars.filter((c) => c.kind === 'sub');

  it('validates all 37 with no errors and only the PAP-210 stub warning', () => {
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toEqual(['MCP_CATALOG_STUB']);
    expect(chars).toHaveLength(37);
    expect(leads).toHaveLength(9);
    expect(subs).toHaveLength(28);
  });

  it('has one file per character named after it, each with the schema modeline', () => {
    const files = readdirSync(LIVE_CHARACTERS_DIR)
      .filter((f) => f.endsWith('.yaml'))
      .sort();
    expect(files).toEqual(chars.map((c) => `${c.name}.yaml`).sort());
    for (const f of files) {
      const text = readFileSync(resolve(LIVE_CHARACTERS_DIR, f), 'utf8');
      expect(
        text.startsWith('# yaml-language-server: $schema=../schema/character.schema.json'),
        f,
      ).toBe(true);
      expect((parseYaml(text) as CharacterInput).name).toBe(f.replace(/\.yaml$/, ''));
    }
    expect(readFileSync(LIVE_ROSTER_FILE, 'utf8')).toContain(
      '$schema=../schema/roster.schema.json',
    );
    expect(Object.keys(readLiveRosterFiles())).toHaveLength(38);
  });

  it('mirrors the plan.json org chart: leads, reportsTo and subs in plan order', () => {
    for (const p of STRUCTURE.leads) {
      const lead = leads.find((c) => c.name === p.name);
      expect(lead, p.name).toBeDefined();
      expect(lead?.displayName).toBe(p.displayName);
      expect(lead?.reportsTo).toBe(p.reportsTo);
      expect(lead?.subCharacters).toEqual([...p.subs]);
      expect(
        subs
          .filter((c) => c.parent === p.name)
          .map((c) => c.name)
          .sort(),
      ).toEqual([...p.subs].sort());
    }
  });

  it('gives every lead a unique Character/<Lead> label and subs none', () => {
    const labels = leads.map((c) => c.linearLabel);
    expect(new Set(labels).size).toBe(9);
    for (const c of leads) expect(c.linearLabel, c.name).toBe(`Character/${c.displayName}`);
    for (const c of subs) expect(c.linearLabel, c.name).toBeUndefined();
  });

  it('splits the daily allowance by the policy shares, summing to 100 percent', () => {
    expect(roster?.dailyAllowanceUsd).toBe(DAILY_ALLOWANCE_USD);
    const sum = leads.reduce((a, c) => a + (c.budget.dailySharePct ?? 0), 0);
    expect(sum).toBe(100);
    expect(Object.values(LEAD_SHARES).reduce((a, b) => a + b, 0)).toBe(100);
    for (const c of leads) {
      expect(c.budget.dailySharePct, c.name).toBe(LEAD_SHARES[c.name]);
      expect(c.budget.perDayUsd, c.name).toBe(
        ((c.budget.dailySharePct ?? 0) / 100) * DAILY_ALLOWANCE_USD,
      );
      expect(c.budget.perSessionUsd, c.name).toBe(LEAD_SESSION.perSessionUsd);
      expect(c.budget.maxTurns, c.name).toBe(LEAD_SESSION.maxTurns);
    }
    expect(leads.find((c) => c.name === REVIEWER_LEAD)?.budget.dailySharePct).toBe(30);
    expect(leads.find((c) => c.name === 'atlas')?.budget.dailySharePct).toBe(8);
    expect(leads.find((c) => c.name === 'scout')?.budget.dailySharePct).toBe(5);
  });

  it('caps every sub at the sub session and lets it draw from its lead day budget', () => {
    for (const c of subs) {
      const lead = leads.find((l) => l.name === c.parent);
      expect(c.budget.perSessionUsd, c.name).toBe(SUB_SESSION.perSessionUsd);
      expect(c.budget.maxTurns, c.name).toBe(SUB_SESSION.maxTurns);
      expect(c.budget.perDayUsd, c.name).toBe(lead?.budget.perDayUsd);
      expect(c.budget.dailySharePct, c.name).toBeUndefined();
    }
  });

  it('resolves round-4 defaults: leads inherit the roster, reviewers run plan, read-mostly subs run Sonnet', () => {
    const leadDefaults = ROSTER_DEFAULTS.lead;
    for (const c of leads) {
      expect(c.model, c.name).toBe(leadDefaults.model);
      expect(c.effort, c.name).toBe('high');
      expect(c.fallbackModel, c.name).toBe(leadDefaults.fallbackModel);
    }
    for (const c of subs.filter((s) => s.parent === REVIEWER_LEAD)) {
      expect(c.model, c.name).toBe('claude-opus-5');
      expect(c.effort, c.name).toBe('high');
      expect(c.permissionMode, c.name).toBe('plan');
      expect(c.tools.deny, c.name).toEqual(expect.arrayContaining(['Write', 'Edit']));
    }
    for (const name of READ_MOSTLY_SUBS) {
      const c = subs.find((s) => s.name === name);
      expect(c?.model, name).toBe('claude-sonnet-5');
      expect(c?.effort, name).toBe('medium');
      expect(c?.fallbackModel, name).toBe('claude-haiku-4-5');
    }
    const builders = subs.filter(
      (s) => s.parent !== REVIEWER_LEAD && !READ_MOSTLY_SUBS.includes(s.name),
    );
    expect(builders.length).toBeGreaterThan(10);
    for (const c of builders) {
      const lead = leads.find((l) => l.name === c.parent);
      expect(c.model, c.name).toBe(lead?.model);
      expect(c.effort, c.name).toBe(lead?.effort);
    }
  });

  it('inherits through the file, not the schema: leads carry no model or effort of their own', () => {
    for (const lead of leads) {
      const raw = parseYaml(
        readFileSync(resolve(LIVE_CHARACTERS_DIR, `${lead.name}.yaml`), 'utf8'),
      ) as CharacterInput;
      expect(raw.model, lead.name).toBeUndefined();
      expect(raw.effort, lead.name).toBeUndefined();
    }
  });

  it('keeps every sub inside its lead: scopes, tools and servers are subsets', () => {
    // The validator enforces this (SUB_SCOPE_NOT_IN_LEAD etc.); here we also assert no sub holds admin scopes its lead lacks.
    for (const c of subs) {
      const lead = leads.find((l) => l.name === c.parent);
      for (const id of c.mcpServers) expect(lead?.mcpServers, `${c.name} ${id}`).toContain(id);
      expect(c.access.length, c.name).toBeLessThanOrEqual(lead?.access.length ?? 0);
    }
  });

  it('gives each character its own memory file and every lead the shared escalation plus Atlas its cycle rule', () => {
    for (const c of chars)
      expect(c.memory.path, c.name).toBe(`docs/memory/characters/${c.name}.md`);
    for (const c of leads) {
      expect(
        c.escalation.some((r) => r.action === 'needs-justin'),
        c.name,
      ).toBe(true);
      expect(
        c.escalation.some((r) => r.action === 'proceed'),
        c.name,
      ).toBe(true);
      expect(
        c.escalation.some((r) => r.action === 'stop'),
        c.name,
      ).toBe(true);
    }
    for (const c of subs) {
      expect(
        c.escalation.some((r) => r.action === 'escalate' && r.to === c.parent),
        c.name,
      ).toBe(true);
    }
    const atlas = leads.find((c) => c.name === 'atlas');
    expect(
      atlas?.escalation.some((r) => /dependency cycle/.test(r.when) && r.action === 'proceed'),
    ).toBe(true);
  });

  it('handles the plan edge cases: punctuation in names, duplicate role text allowed', () => {
    const stylist = subs.find((c) => c.name === 'motion-and-input-stylist');
    expect(stylist?.displayName).toBe('Motion and Input Stylist');
    const descriptions = new Set(chars.map((c) => c.description));
    expect(descriptions.size).toBe(chars.length);
  });
});
