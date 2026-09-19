/**
 * Roster validation (PAP-103): structural parse plus the cross-character rules the schema alone
 * cannot express. Every finding carries a stable `code`; the invalid fixtures under
 * `fixtures/invalid/` hold one file per code.
 */
import { z } from 'zod';
import { type Character, type Roster, RosterSchema } from './character.ts';
import { type ResolvedCharacter, type ResolvedRoster, resolveInheritance } from './inherit.ts';
import { MCP_CATALOG_STUB, type McpCatalogRef } from './mcp-catalog.ts';
import { PRICE_TABLE_MODELS } from './models.ts';
import { resolveScope, scopeCovers } from './scopes.ts';
import { KNOWN_SKILLS } from './skills.ts';
import { daysSince, isKnownTool, KNOWN_TOOLS, toolCovers } from './tools.ts';

export const ERROR_CODES = [
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
] as const;
export const WARNING_CODES = [
  'MODEL_UNKNOWN',
  'MCP_CATALOG_STUB',
  'TOOLS_STALE',
  'UNKNOWN_SKILL',
  'BUDGET_SHARE_SUM',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type WarningCode = (typeof WARNING_CODES)[number];
export type FindingCode = ErrorCode | WarningCode;

export interface Finding {
  readonly code: FindingCode;
  readonly severity: 'error' | 'warning';
  readonly character?: string;
  readonly path?: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly Finding[];
  readonly warnings: readonly Finding[];
  /** Present when the roster parsed; resolved with inheritance applied. */
  readonly roster?: ResolvedRoster;
}

export interface ValidateOptions {
  /** MCP catalog to check `mcpServers[]` against; defaults to the PAP-210 stub. */
  readonly mcpCatalog?: McpCatalogRef;
  /** Price-table model ids; defaults to `PRICE_TABLE_MODELS`. */
  readonly models?: readonly string[];
  /** Skill ids; defaults to `KNOWN_SKILLS`. */
  readonly skills?: readonly string[];
  /** Clock for the `TOOLS_STALE` check. */
  readonly now?: Date;
}

/** Validate a raw roster document (already parsed from YAML or JSON). */
export function validateRoster(input: unknown, options: ValidateOptions = {}): ValidationResult {
  const findings: Finding[] = [];
  const parsed = RosterSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push({
        code: 'SCHEMA_INVALID',
        severity: 'error',
        ...characterOfIssue(input, issue.path),
        path: issue.path.map(String).join('.'),
        message: issue.message,
      });
    }
    return finish(findings);
  }
  const roster = parsed.data;
  checkNames(roster, findings);
  checkReportsTo(roster, findings);
  checkSubLists(roster, findings);
  const resolved = resolveInheritance(roster);
  checkBudgets(roster, resolved, findings);
  checkScopes(resolved, findings);
  checkTools(resolved, findings, options.now ?? new Date());
  checkMcp(resolved, findings, options.mcpCatalog ?? MCP_CATALOG_STUB);
  checkModels(resolved, findings, options.models ?? PRICE_TABLE_MODELS);
  checkSkills(resolved, findings, options.skills ?? KNOWN_SKILLS);
  checkShares(resolved, findings);
  return finish(findings, resolved);
}

function finish(findings: Finding[], roster?: ResolvedRoster): ValidationResult {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  return roster
    ? { ok: errors.length === 0, errors, warnings, roster }
    : { ok: errors.length === 0, errors, warnings };
}

function characterOfIssue(input: unknown, path: PropertyKey[]): { character?: string } {
  if (path[0] !== 'characters' || typeof path[1] !== 'number') return {};
  const chars = (input as { characters?: unknown[] } | null)?.characters;
  const c = chars?.[path[1]] as { name?: unknown } | undefined;
  return typeof c?.name === 'string' ? { character: c.name } : {};
}

function err(
  code: ErrorCode,
  character: string | undefined,
  path: string | undefined,
  message: string,
): Finding {
  return character === undefined
    ? { code, severity: 'error', ...(path ? { path } : {}), message }
    : { code, severity: 'error', character, ...(path ? { path } : {}), message };
}
function warn(
  code: WarningCode,
  character: string | undefined,
  path: string | undefined,
  message: string,
): Finding {
  return character === undefined
    ? { code, severity: 'warning', ...(path ? { path } : {}), message }
    : { code, severity: 'warning', character, ...(path ? { path } : {}), message };
}

function checkNames(roster: Roster, out: Finding[]): void {
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const c of roster.characters) {
    seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
    if (c.linearLabel) {
      const other = labels.get(c.linearLabel);
      if (other)
        out.push(
          err(
            'DUP_LABEL',
            c.name,
            'linearLabel',
            `label ${c.linearLabel} is also carried by ${other}`,
          ),
        );
      else labels.set(c.linearLabel, c.name);
    }
    if (c.kind === 'lead' && !c.linearLabel) {
      out.push(
        err(
          'LEAD_LABEL_MISSING',
          c.name,
          'linearLabel',
          `lead ${c.name} needs a Character/<Lead> label`,
        ),
      );
    }
  }
  for (const [name, n] of seen)
    if (n > 1) out.push(err('DUP_NAME', name, 'name', `${name} is declared ${n} times`));
}

function checkReportsTo(roster: Roster, out: Finding[]): void {
  const byName = new Map(roster.characters.map((c) => [c.name, c] as const));
  for (const c of roster.characters) {
    if (c.reportsTo !== 'justin' && !byName.has(c.reportsTo)) {
      out.push(
        err(
          'UNKNOWN_REPORTS_TO',
          c.name,
          'reportsTo',
          `${c.name} reports to unknown character ${c.reportsTo}`,
        ),
      );
    }
    if (c.parent !== undefined) {
      const p = byName.get(c.parent);
      if (!p)
        out.push(
          err('UNKNOWN_PARENT', c.name, 'parent', `${c.name} has unknown parent ${c.parent}`),
        );
      else if (p.kind !== 'lead')
        out.push(
          err('PARENT_NOT_LEAD', c.name, 'parent', `${c.name}'s parent ${c.parent} is a sub`),
        );
    }
  }
  // Cycle detection over reportsTo, following only edges that resolve.
  const state = new Map<string, 'open' | 'done'>();
  const reported = new Set<string>();
  const visit = (name: string, trail: string[]): void => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'open') {
      const cycle = [...trail.slice(trail.indexOf(name)), name];
      const key = [...cycle].sort().join('|');
      if (!reported.has(key)) {
        reported.add(key);
        out.push(
          err('REPORTS_TO_CYCLE', name, 'reportsTo', `reportsTo cycle: ${cycle.join(' -> ')}`),
        );
      }
      return;
    }
    state.set(name, 'open');
    const c = byName.get(name);
    if (c && c.reportsTo !== 'justin' && byName.has(c.reportsTo))
      visit(c.reportsTo, [...trail, name]);
    state.set(name, 'done');
  };
  for (const c of roster.characters) visit(c.name, []);
}

function checkSubLists(roster: Roster, out: Finding[]): void {
  for (const lead of roster.characters) {
    if (lead.kind !== 'lead' || lead.subCharacters === undefined) continue;
    const actual = roster.characters
      .filter((c) => c.kind === 'sub' && c.parent === lead.name)
      .map((c) => c.name)
      .sort();
    const declared = [...lead.subCharacters].sort();
    if (actual.join(',') !== declared.join(',')) {
      out.push(
        err(
          'SUB_LIST_MISMATCH',
          lead.name,
          'subCharacters',
          `${lead.name} lists [${declared.join(', ')}] but the roster has [${actual.join(', ')}]`,
        ),
      );
    }
  }
}

function checkBudgets(_roster: Roster, resolved: ResolvedRoster, out: Finding[]): void {
  for (const c of resolved.characters) {
    for (const field of ['perSessionUsd', 'perDayUsd', 'maxTurns'] as const) {
      if (!Number.isFinite(c.budget[field])) {
        out.push(
          err(
            'BUDGET_MISSING',
            c.name,
            `budget.${field}`,
            `${c.name} has no ${field} on itself, its parent or the roster defaults`,
          ),
        );
      }
    }
  }
}

function leadOf(resolved: ResolvedRoster, c: ResolvedCharacter): ResolvedCharacter | undefined {
  return c.kind === 'sub' && c.parent !== undefined
    ? resolved.characters.find((x) => x.name === c.parent)
    : undefined;
}

function checkScopes(resolved: ResolvedRoster, out: Finding[]): void {
  for (const c of resolved.characters) {
    const lead = leadOf(resolved, c);
    for (const scope of c.access) {
      const r = resolveScope(scope);
      if (!r) {
        out.push(err('UNKNOWN_SCOPE', c.name, 'access', `${scope} is not in the scope registry`));
        continue;
      }
      if (
        r.definition.class === 'destructive' &&
        !(c.kind === 'lead' && c.reportsTo === 'justin')
      ) {
        out.push(
          err(
            'DESTRUCTIVE_SCOPE',
            c.name,
            'access',
            `${scope} is destructive-class; only a lead reporting to justin may hold it (threat model §4)`,
          ),
        );
      }
      if (lead && !lead.access.some((held) => scopeCovers(held, scope))) {
        out.push(
          err(
            'SUB_SCOPE_NOT_IN_LEAD',
            c.name,
            'access',
            `sub ${c.name} holds ${scope} but lead ${lead.name} does not`,
          ),
        );
      }
    }
  }
}

function checkTools(resolved: ResolvedRoster, out: Finding[], now: Date): void {
  const age = daysSince(KNOWN_TOOLS.lastVerified, now);
  if (age > KNOWN_TOOLS.staleAfterDays) {
    out.push(
      warn(
        'TOOLS_STALE',
        undefined,
        undefined,
        `KNOWN_TOOLS last verified ${KNOWN_TOOLS.lastVerified} (${age} days ago); re-verify against Claude Code`,
      ),
    );
  }
  for (const c of resolved.characters) {
    const lead = leadOf(resolved, c);
    for (const list of ['allow', 'deny'] as const) {
      for (const entry of c.tools[list]) {
        if (!isKnownTool(entry)) {
          out.push(
            err(
              'UNKNOWN_TOOL',
              c.name,
              `tools.${list}`,
              `${entry} is not a known built-in or mcp__server__tool pattern`,
            ),
          );
        }
      }
    }
    if (lead) {
      for (const entry of c.tools.allow) {
        if (!lead.tools.allow.some((held) => toolCovers(held, entry))) {
          out.push(
            err(
              'SUB_TOOL_NOT_IN_LEAD',
              c.name,
              'tools.allow',
              `sub ${c.name} allows ${entry} but lead ${lead.name} does not`,
            ),
          );
        }
      }
    }
  }
}

function checkMcp(resolved: ResolvedRoster, out: Finding[], catalog: McpCatalogRef): void {
  if (catalog.stub) {
    out.push(
      warn(
        'MCP_CATALOG_STUB',
        undefined,
        undefined,
        'mcpServers[] checked against the PAP-210 stub catalog, not the generated one',
      ),
    );
  }
  const ids = new Set(catalog.servers.map((s) => s.id));
  for (const c of resolved.characters) {
    const lead = leadOf(resolved, c);
    for (const id of c.mcpServers) {
      if (!ids.has(id))
        out.push(
          err('UNKNOWN_MCP_SERVER', c.name, 'mcpServers', `${id} is not in the MCP catalog`),
        );
      if (lead && !lead.mcpServers.includes(id)) {
        out.push(
          err(
            'SUB_MCP_NOT_IN_LEAD',
            c.name,
            'mcpServers',
            `sub ${c.name} uses ${id} but lead ${lead.name} does not`,
          ),
        );
      }
    }
    for (const entry of c.tools.allow) {
      const m = /^mcp__([a-z][a-z0-9-]*)/.exec(entry);
      if (m && !c.mcpServers.includes(m[1] as string)) {
        out.push(
          err(
            'UNKNOWN_MCP_SERVER',
            c.name,
            'tools.allow',
            `${entry} names server ${m[1]} which is not in ${c.name}'s mcpServers`,
          ),
        );
      }
    }
  }
}

function checkModels(resolved: ResolvedRoster, out: Finding[], models: readonly string[]): void {
  const known = new Set(models);
  const seen = new Set<string>();
  for (const c of resolved.characters) {
    for (const [field, id] of [
      ['model', c.model],
      ['fallbackModel', c.fallbackModel],
    ] as const) {
      if (!known.has(id) && !seen.has(`${c.name}.${field}`)) {
        seen.add(`${c.name}.${field}`);
        out.push(
          warn(
            'MODEL_UNKNOWN',
            c.name,
            field,
            `${id} is not in the PAP-98 price table; cost cannot be recomputed`,
          ),
        );
      }
    }
  }
}

function checkSkills(resolved: ResolvedRoster, out: Finding[], skills: readonly string[]): void {
  const known = new Set(skills);
  for (const c of resolved.characters) {
    for (const s of c.skills) {
      if (!known.has(s))
        out.push(
          warn(
            'UNKNOWN_SKILL',
            c.name,
            'skills',
            `${s} is not in skills.json (PAP-105); mark it planned there`,
          ),
        );
    }
  }
}

function checkShares(resolved: ResolvedRoster, out: Finding[]): void {
  const leads = resolved.characters.filter((c) => c.kind === 'lead');
  const shares = leads
    .map((c) => c.budget.dailySharePct)
    .filter((s): s is number => s !== undefined);
  if (shares.length === 0 || shares.length !== leads.length) return;
  const sum = shares.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) {
    out.push(
      warn(
        'BUDGET_SHARE_SUM',
        undefined,
        'budget.dailySharePct',
        `lead daily shares sum to ${sum}%, not 100%`,
      ),
    );
  }
}

/** Type guard used by callers that only want the parsed characters. */
export function isCharacterArray(value: unknown): value is Character[] {
  return z.array(z.object({ name: z.string() })).safeParse(value).success;
}
