import { describe, expect, it } from 'vitest';
import { isKnownScope, resolveScope, SCOPES, scopeCovers } from './scopes.ts';
import { daysSince, isKnownTool, KNOWN_TOOLS, parseTool, toolCovers } from './tools.ts';
import { validateRoster } from './validate.ts';

describe('scope registry', () => {
  it('resolves every registered id with a valid qualifier and rejects the rest', () => {
    expect(resolveScope('linear:admin')?.definition.class).toBe('admin');
    expect(resolveScope('repo:write:packages/ui')?.qualifier).toBe('packages/ui');
    expect(resolveScope('repo:write:.claude')?.qualifier).toBe('.claude');
    expect(isKnownScope('stripe:write:test')).toBe(true);
    expect(isKnownScope('stripe:write:live')).toBe(false);
    expect(isKnownScope('linear:admin:org')).toBe(false);
    expect(isKnownScope('repo:write')).toBe(false);
    expect(isKnownScope('jira:admin')).toBe(false);
    expect(isKnownScope('Linear Admin')).toBe(false);
  });

  it('has unique ids and a class for each', () => {
    const ids = SCOPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCOPES) expect(['read', 'write', 'admin', 'destructive']).toContain(s.class);
  });

  it('scopeCovers understands path qualifiers', () => {
    expect(scopeCovers('repo:write:all', 'repo:write:packages/ui')).toBe(true);
    expect(scopeCovers('repo:write:packages', 'repo:write:packages/ui')).toBe(true);
    expect(scopeCovers('repo:write:packages/ui', 'repo:write:packages/tokens')).toBe(false);
    expect(scopeCovers('stripe:write:test', 'stripe:read:test')).toBe(false);
    expect(scopeCovers('linear:comment', 'linear:comment')).toBe(true);
  });
});

describe('known tools', () => {
  it('parses built-ins, rule arguments and mcp names', () => {
    expect(parseTool('Read')).toEqual({ kind: 'builtin', name: 'Read' });
    expect(parseTool('Bash(pnpm *)')).toEqual({
      kind: 'builtin',
      name: 'Bash',
      argument: 'pnpm *',
    });
    expect(parseTool('mcp__linear')).toEqual({ kind: 'mcp', server: 'linear', tool: undefined });
    expect(parseTool('mcp__linear__create_issue')).toEqual({
      kind: 'mcp',
      server: 'linear',
      tool: 'create_issue',
    });
    expect(isKnownTool('Teleport')).toBe(false);
    expect(isKnownTool('Glob(src/**)')).toBe(false);
    expect(isKnownTool('mcp_linear')).toBe(false);
  });

  it('toolCovers: unrestricted covers rule, glob covers narrower, server covers tool', () => {
    expect(toolCovers('Bash', 'Bash(pnpm test)')).toBe(true);
    expect(toolCovers('Bash(pnpm *)', 'Bash(pnpm test*)')).toBe(true);
    expect(toolCovers('Bash(pnpm test*)', 'Bash(pnpm *)')).toBe(false);
    expect(toolCovers('Bash(git *)', 'Bash(cargo *)')).toBe(false);
    expect(toolCovers('mcp__linear', 'mcp__linear__create_issue')).toBe(true);
    expect(toolCovers('mcp__linear__list', 'mcp__linear__create_issue')).toBe(false);
    expect(toolCovers('Read', 'Write')).toBe(false);
  });

  it('warns TOOLS_STALE when lastVerified is older than 30 days', () => {
    const roster = {
      schemaVersion: 1,
      characters: [
        {
          schemaVersion: 1,
          name: 'alpha',
          displayName: 'Alpha',
          role: 'Lead',
          kind: 'lead',
          reportsTo: 'justin',
          description: 'A lead used to exercise the stale-tools warning.',
          budget: { perSessionUsd: 1, perDayUsd: 1, maxTurns: 1 },
          linearLabel: 'Character/Alpha',
        },
      ],
    };
    const fresh = validateRoster(roster, {
      now: new Date(`${KNOWN_TOOLS.lastVerified}T12:00:00Z`),
    });
    expect(fresh.warnings.map((w) => w.code)).not.toContain('TOOLS_STALE');
    const late = new Date(
      new Date(`${KNOWN_TOOLS.lastVerified}T00:00:00Z`).getTime() + 31 * 86_400_000,
    );
    expect(daysSince(KNOWN_TOOLS.lastVerified, late)).toBe(31);
    const stale = validateRoster(roster, { now: late });
    expect(stale.warnings.map((w) => w.code)).toContain('TOOLS_STALE');
  });

  it('warns MODEL_UNKNOWN for a model outside the price table and UNKNOWN_SKILL for an unlisted skill', () => {
    const r = validateRoster({
      schemaVersion: 1,
      characters: [
        {
          schemaVersion: 1,
          name: 'alpha',
          displayName: 'Alpha',
          role: 'Lead',
          kind: 'lead',
          reportsTo: 'justin',
          description: 'A lead with a model the price table does not know.',
          model: 'claude-mythic-9',
          skills: ['juggle'],
          budget: { perSessionUsd: 1, perDayUsd: 1, maxTurns: 1 },
          linearLabel: 'Character/Alpha',
        },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['MODEL_UNKNOWN', 'UNKNOWN_SKILL']),
    );
  });
});
