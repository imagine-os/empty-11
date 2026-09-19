import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type AccessScope,
  type BudgetSpec,
  type Character,
  type CharacterInput,
  CharacterSchema,
  type EscalationRule,
  type Roster,
  type RosterInput,
  RosterSchema,
} from './character.ts';
import type { Effort } from './models.ts';
import type { ValidationResult } from './validate.ts';
import { validateRoster } from './validate.ts';

const minimal: CharacterInput = {
  schemaVersion: 1,
  name: 'alpha',
  displayName: 'Alpha',
  role: 'Test lead',
  kind: 'lead',
  reportsTo: 'justin',
  description: 'A minimal lead used by the schema tests to isolate one rule.',
  linearLabel: 'Character/Alpha',
};

describe('CharacterSchema', () => {
  it('fills defaults on parse', () => {
    const c = CharacterSchema.parse(minimal);
    expect(c.mcpServers).toEqual([]);
    expect(c.access).toEqual([]);
    expect(c.escalation).toEqual([]);
    expect(c.denyList).toBe('ops/security/agent-deny.yaml');
    expect(c.model).toBeUndefined();
  });

  it('normalises xhigh to high and rejects unknown efforts', () => {
    expect(CharacterSchema.parse({ ...minimal, effort: 'xhigh' }).effort).toBe('high');
    expect(CharacterSchema.parse({ ...minimal, effort: 'max' }).effort).toBe('max');
    expect(CharacterSchema.safeParse({ ...minimal, effort: 'ultra' }).success).toBe(false);
  });

  it('is strict: an unknown key fails', () => {
    expect(CharacterSchema.safeParse({ ...minimal, colour: 'blue' }).success).toBe(false);
  });

  it('enforces kind/parent/reportsTo consistency', () => {
    expect(CharacterSchema.safeParse({ ...minimal, kind: 'sub' }).success).toBe(false);
    expect(CharacterSchema.safeParse({ ...minimal, parent: 'atlas' }).success).toBe(false);
    // Self-report is a cycle of length one; the validator reports it, not the schema.
    expect(
      validateRoster({
        schemaVersion: 1,
        characters: [{ ...minimal, reportsTo: 'alpha' }],
      }).errors.map((e) => e.code),
    ).toContain('REPORTS_TO_CYCLE');
    const sub = {
      ...minimal,
      kind: 'sub',
      parent: 'atlas',
      reportsTo: 'atlas',
      linearLabel: undefined,
    };
    expect(CharacterSchema.safeParse(sub).success).toBe(true);
    expect(CharacterSchema.safeParse({ ...sub, reportsTo: 'forge' }).success).toBe(false);
  });

  it('checks ids, labels, scopes and tool grammar', () => {
    expect(CharacterSchema.safeParse({ ...minimal, name: 'Alpha' }).success).toBe(false);
    expect(CharacterSchema.safeParse({ ...minimal, linearLabel: 'alpha' }).success).toBe(false);
    expect(CharacterSchema.safeParse({ ...minimal, access: ['Linear Admin'] }).success).toBe(false);
    expect(
      CharacterSchema.safeParse({ ...minimal, tools: { allow: ['mcp_linear'] } }).success,
    ).toBe(false);
    expect(
      CharacterSchema.safeParse({
        ...minimal,
        tools: { allow: ['Bash(pnpm *)', 'mcp__linear__*'] },
      }).success,
    ).toBe(true);
  });

  it('requires `to` on an escalate rule', () => {
    expect(
      CharacterSchema.safeParse({
        ...minimal,
        escalation: [{ when: 'anything at all', action: 'escalate' }],
      }).success,
    ).toBe(false);
    expect(
      CharacterSchema.safeParse({
        ...minimal,
        escalation: [{ when: 'anything at all', action: 'escalate', to: 'atlas' }],
      }).success,
    ).toBe(true);
  });
});

describe('RosterSchema', () => {
  it('accepts a roster without defaults and with an inline character list', () => {
    expect(RosterSchema.safeParse({ schemaVersion: 1, characters: [minimal] }).success).toBe(true);
    expect(RosterSchema.safeParse({ schemaVersion: 2, characters: [minimal] }).success).toBe(false);
    expect(RosterSchema.safeParse({ schemaVersion: 1, characters: [] }).success).toBe(false);
  });

  it('validateRoster reports SCHEMA_INVALID with the character name and path', () => {
    const r = validateRoster({
      schemaVersion: 1,
      characters: [{ ...minimal, permissionMode: 'yolo' }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({
      code: 'SCHEMA_INVALID',
      character: 'alpha',
      path: 'characters.0.permissionMode',
    });
  });
});

describe('types', () => {
  it('infers the documented shapes', () => {
    expectTypeOf<Character['effort']>().toEqualTypeOf<Effort | undefined>();
    expectTypeOf<Effort>().toEqualTypeOf<'low' | 'medium' | 'high' | 'max'>();
    expectTypeOf<CharacterInput['effort']>().toEqualTypeOf<
      'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined
    >();
    expectTypeOf<Character['kind']>().toEqualTypeOf<'lead' | 'sub'>();
    expectTypeOf<Character['mcpServers']>().toEqualTypeOf<string[]>();
    expectTypeOf<CharacterInput['mcpServers']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<AccessScope>().toBeString();
    expectTypeOf<BudgetSpec>().toEqualTypeOf<{
      perSessionUsd: number;
      perDayUsd: number;
      maxTurns: number;
      dailySharePct?: number | undefined;
    }>();
    expectTypeOf<EscalationRule['action']>().toEqualTypeOf<
      'escalate' | 'needs-justin' | 'proceed' | 'stop'
    >();
    expectTypeOf<Roster['characters']>().toEqualTypeOf<Character[]>();
    expectTypeOf<RosterInput['defaults']>().toBeNullable();
    expectTypeOf(validateRoster).returns.toEqualTypeOf<ValidationResult>();
    expectTypeOf(validateRoster).parameter(0).toBeUnknown();
  });
});
