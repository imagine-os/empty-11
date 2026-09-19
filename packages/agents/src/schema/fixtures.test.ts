import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readRosterDir, validateRosterFiles } from './load.ts';
import type { ErrorCode } from './validate.ts';

const FIXTURES = resolve(import.meta.dirname, '../../fixtures');

const LEADS = ['atlas', 'forge', 'iris', 'quill', 'sentinel', 'nova', 'ledger', 'beacon', 'scout'];
const SUBS: Record<string, string[]> = {
  atlas: ['dispatcher', 'decomposer', 'merger'],
  forge: ['tauri-smith', 'schema-wright', 'ops-runner'],
  iris: ['token-keeper', 'component-crafter', 'motion-and-input-stylist'],
  quill: ['page-spec-writer', 'changelog-scribe', 'prompt-logger'],
  sentinel: ['code-reviewer', 'security-auditor', 'visual-inspector', 'edge-case-hunter'],
  nova: ['crdt-engineer', 'views-engineer', 'canvas-cartographer'],
  ledger: ['payments-integrator', 'bookkeeper', 'payroll-adapter'],
  beacon: ['campaign-composer', 'crm-builder', 'outreach-sequencer'],
  scout: ['library-evaluator', 'import-mapper', 'template-packager'],
};

describe('golden roster (nine leads, 28 subs from docs/characters/*.md)', () => {
  const result = validateRosterFiles(readRosterDir(resolve(FIXTURES, 'valid')));

  it('validates with no errors', () => {
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('warns only that the MCP catalog is the PAP-210 stub', () => {
    expect(result.warnings.map((w) => w.code)).toEqual(['MCP_CATALOG_STUB']);
  });

  it('holds exactly the roster org chart', () => {
    const roster = result.roster;
    expect(roster).toBeDefined();
    if (!roster) return;
    expect(roster.characters).toHaveLength(37);
    const leads = roster.characters.filter((c) => c.kind === 'lead').map((c) => c.name);
    expect(leads.sort()).toEqual([...LEADS].sort());
    for (const lead of LEADS) {
      const subs = roster.characters.filter((c) => c.parent === lead).map((c) => c.name);
      expect(subs.sort(), lead).toEqual([...(SUBS[lead] as string[])].sort());
    }
    expect(roster.characters.find((c) => c.name === 'atlas')?.reportsTo).toBe('justin');
    for (const lead of LEADS.filter((l) => l !== 'atlas')) {
      expect(roster.characters.find((c) => c.name === lead)?.reportsTo, lead).toBe('atlas');
    }
  });

  it('keeps the sheets unchanged: xhigh is accepted and normalised to high', () => {
    const forgeYaml = readFileSync(resolve(FIXTURES, 'valid/characters/forge.yaml'), 'utf8');
    expect(forgeYaml).toContain('effort: xhigh');
    expect(result.roster?.characters.find((c) => c.name === 'forge')?.effort).toBe('high');
  });

  it('lead daily shares sum to 100 percent of the allowance', () => {
    const leads = result.roster?.characters.filter((c) => c.kind === 'lead') ?? [];
    const sum = leads.reduce((a, c) => a + (c.budget.dailySharePct ?? 0), 0);
    expect(sum).toBe(100);
    for (const c of leads) {
      expect(c.budget.perDayUsd, c.name).toBe(((c.budget.dailySharePct ?? 0) / 100) * 700);
    }
  });

  it('resolves every sub to a full budget (never unlimited)', () => {
    for (const c of result.roster?.characters ?? []) {
      expect(Number.isFinite(c.budget.perSessionUsd), c.name).toBe(true);
      expect(Number.isFinite(c.budget.perDayUsd), c.name).toBe(true);
      expect(Number.isFinite(c.budget.maxTurns), c.name).toBe(true);
    }
  });

  it('every reviewer sub of Sentinel runs in plan mode without Write or Edit', () => {
    for (const name of SUBS.sentinel as string[]) {
      const c = result.roster?.characters.find((x) => x.name === name);
      expect(c?.permissionMode, name).toBe('plan');
      expect(c?.tools.deny, name).toEqual(expect.arrayContaining(['Write', 'Edit']));
    }
  });

  it('matches the committed resolved roster.json', () => {
    const committed = JSON.parse(readFileSync(resolve(FIXTURES, 'valid/roster.json'), 'utf8')) as {
      characters: Array<{ name: string }>;
    };
    expect(committed.characters.map((c) => c.name).sort()).toEqual(
      (result.roster?.characters.map((c) => c.name) ?? []).sort(),
    );
    const { $comment: _c, ...rest } = committed as Record<string, unknown>;
    const { characters, ...meta } = result.roster ?? { characters: [] };
    const byName = new Map(characters.map((c) => [c.name, c]));
    expect(rest).toEqual({
      ...meta,
      characters: (rest.characters as Array<{ name: string }>).map((c) => byName.get(c.name)),
    });
  });
});

describe('invalid fixtures: one file per error code', () => {
  const dir = resolve(FIXTURES, 'invalid');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));

  it('covers every error code except the schema catch-all at least once', () => {
    const expected = files.map(
      (f) => /^# expect: (\w+)$/m.exec(readFileSync(resolve(dir, f), 'utf8'))?.[1],
    );
    expect(new Set(expected)).toEqual(
      new Set<ErrorCode>([
        'SCHEMA_INVALID',
        'DUP_NAME',
        'DUP_LABEL',
        'LEAD_LABEL_MISSING',
        'UNKNOWN_REPORTS_TO',
        'UNKNOWN_PARENT',
        'PARENT_NOT_LEAD',
        'REPORTS_TO_CYCLE',
        'SUB_LIST_MISMATCH',
        'UNKNOWN_SCOPE',
        'DESTRUCTIVE_SCOPE',
        'SUB_SCOPE_NOT_IN_LEAD',
        'UNKNOWN_TOOL',
        'SUB_TOOL_NOT_IN_LEAD',
        'UNKNOWN_MCP_SERVER',
        'SUB_MCP_NOT_IN_LEAD',
        'BUDGET_MISSING',
      ]),
    );
  });

  for (const file of files) {
    it(`${file} fails with its expected code`, () => {
      const text = readFileSync(resolve(dir, file), 'utf8');
      const expected = /^# expect: (\w+)$/m.exec(text)?.[1];
      expect(expected).toBeDefined();
      const result = validateRosterFiles({ [file]: text });
      expect(result.ok).toBe(false);
      expect(result.errors.map((e) => e.code)).toContain(expected);
    });
  }

  it('names the cycle in REPORTS_TO_CYCLE', () => {
    const text = readFileSync(resolve(dir, 'cycle.yaml'), 'utf8');
    const result = validateRosterFiles({ 'cycle.yaml': text });
    const cycle = result.errors.find((e) => e.code === 'REPORTS_TO_CYCLE');
    expect(cycle?.message).toMatch(
      /alpha -> beta -> gamma -> alpha|beta -> gamma -> alpha -> beta|gamma -> alpha -> beta -> gamma/,
    );
  });

  it('SUB_TOOL_NOT_IN_LEAD names both the sub and the lead', () => {
    const text = readFileSync(resolve(dir, 'sub-tool-not-in-lead.yaml'), 'utf8');
    const result = validateRosterFiles({ f: text });
    const f = result.errors.find((e) => e.code === 'SUB_TOOL_NOT_IN_LEAD');
    expect(f?.character).toBe('first');
    expect(f?.message).toContain('lead alpha');
  });
});
