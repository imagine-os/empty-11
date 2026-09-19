import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml, stringify } from 'yaml';
import type { CharacterInput } from '../schema/character.ts';
import { validateRoster } from '../schema/validate.ts';
import { characterDrift, convertPlan, mergeCharacter, PLAN_OWNED_FIELDS } from './convert.ts';
import { LIVE_CHARACTERS_DIR } from './live.ts';
import { kebab, normaliseAccess, parsePlanAgents, readPlanAgents } from './plan.ts';
import { READ_MOSTLY_SUBS } from './policy.ts';

const PLAN_PATH = resolve(import.meta.dirname, '../../fixtures/source/plan-agents.json');
const PLAN = readPlanAgents(PLAN_PATH);

describe('plan-to-roster conversion (PAP-284)', () => {
  const converted = convertPlan(PLAN);

  it('produces 37 characters in plan order and a roster with the round-4 defaults', () => {
    expect(converted.characters).toHaveLength(37);
    expect(converted.characters.filter((c) => c.kind === 'lead')).toHaveLength(9);
    expect(converted.characters.slice(0, 4).map((c) => c.name)).toEqual([
      'atlas',
      'dispatcher',
      'decomposer',
      'merger',
    ]);
    expect(converted.roster.defaults?.lead.model).toBe('claude-opus-5');
    expect(converted.roster.defaults?.sub.model).toBe('claude-sonnet-5');
  });

  it('matches the committed snapshot (fixtures/plan-to-roster.snapshot.yaml)', async () => {
    await expect(stringify(converted, { lineWidth: 100 })).toMatchFileSnapshot(
      resolve(import.meta.dirname, '../../fixtures/plan-to-roster.snapshot.yaml'),
    );
  });

  it('validates as a roster on its own: every skeleton has a full budget and resolves', () => {
    const result = validateRoster({ ...converted.roster, characters: converted.characters });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.code)).toEqual(['MCP_CATALOG_STUB']);
    const shares =
      result.roster?.characters
        .filter((c) => c.kind === 'lead')
        .map((c) => c.budget.dailySharePct ?? 0) ?? [];
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('pins reviewers and read-mostly subs, leaves builder subs inheriting their lead', () => {
    const byName = new Map(converted.characters.map((c) => [c.name, c] as const));
    expect(byName.get('code-reviewer')).toMatchObject({
      model: 'claude-opus-5',
      effort: 'high',
      permissionMode: 'plan',
    });
    expect(byName.get('code-reviewer')?.tools?.deny).toEqual(['Write', 'Edit']);
    for (const name of READ_MOSTLY_SUBS)
      expect(byName.get(name), name).toMatchObject({ model: 'claude-sonnet-5', effort: 'medium' });
    expect(byName.get('tauri-smith')?.model).toBeUndefined();
    expect(byName.get('tauri-smith')?.effort).toBeUndefined();
  });

  it('gives a sub without access the read-class subset of its lead, never more', () => {
    const byName = new Map(converted.characters.map((c) => [c.name, c] as const));
    expect(byName.get('dispatcher')?.access).toEqual(['prod:read']);
    expect(byName.get('payments-integrator')?.access).toEqual(['stripe:read:live']);
    expect(byName.get('tauri-smith')?.access).toEqual([]);
  });

  it('kebabs names with spaces and punctuation and keeps the display name', () => {
    expect(kebab('Motion and Input Stylist')).toBe('motion-and-input-stylist');
    expect(kebab('P&L Analyst')).toBe('p-l-analyst');
    const stylist = converted.characters.find((c) => c.name === 'motion-and-input-stylist');
    expect(stylist?.displayName).toBe('Motion and Input Stylist');
  });

  it('normalises plan access prose to registry scopes and drops negations', () => {
    expect(normaliseAccess('repo:write packages/views packages/collab apps/web')).toEqual([
      'repo:write:packages/views',
      'repo:write:packages/collab',
      'repo:write:apps/web',
    ]);
    expect(normaliseAccess('no merge rights')).toEqual([]);
    expect(normaliseAccess('stripe:test-mode write')).toEqual(['stripe:write:test']);
  });

  it('accepts a whole plan.json document as well as the agents array', () => {
    expect(parsePlanAgents({ agents: JSON.parse(readFileSync(PLAN_PATH, 'utf8')) })).toHaveLength(
      9,
    );
  });

  it('--merge preserves hand edits: every live file merges to itself', () => {
    for (const generated of converted.characters) {
      const existing = parseYaml(
        readFileSync(resolve(LIVE_CHARACTERS_DIR, `${generated.name}.yaml`), 'utf8'),
      ) as CharacterInput;
      expect(characterDrift(existing, generated), generated.name).toEqual([]);
      expect(mergeCharacter(existing, generated), generated.name).toEqual(existing);
    }
  });

  it('--merge rewrites plan-owned fields only', () => {
    const generated = converted.characters.find((c) => c.name === 'decomposer') as CharacterInput;
    const existing = parseYaml(
      readFileSync(resolve(LIVE_CHARACTERS_DIR, 'decomposer.yaml'), 'utf8'),
    ) as CharacterInput;
    const renamed = { ...generated, displayName: 'Issue Decomposer' };
    expect(characterDrift(existing, renamed)).toEqual([
      'displayName: file "Decomposer", plan "Issue Decomposer"',
    ]);
    const merged = mergeCharacter(existing, renamed);
    expect(merged.displayName).toBe('Issue Decomposer');
    for (const key of Object.keys(existing) as (keyof CharacterInput)[]) {
      if (!(PLAN_OWNED_FIELDS as readonly string[]).includes(key))
        expect(merged[key], key).toEqual(existing[key]);
    }
  });

  it('--merge unions new plan scopes into a lead and refuses an invalid result', () => {
    const generated = converted.characters.find((c) => c.name === 'forge') as CharacterInput;
    const existing = parseYaml(
      readFileSync(resolve(LIVE_CHARACTERS_DIR, 'forge.yaml'), 'utf8'),
    ) as CharacterInput;
    const withScope = { ...generated, access: [...(generated.access ?? []), 'budget:read'] };
    expect(characterDrift(existing, withScope)).toEqual(['access: plan scope budget:read missing']);
    expect(mergeCharacter(existing, withScope).access).toContain('budget:read');
    expect(() => mergeCharacter(existing, { ...generated, reportsTo: 'Not Kebab' })).toThrow(
      /not a valid character/,
    );
  });
});
