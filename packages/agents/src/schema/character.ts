/**
 * `Character` and `Roster` schemas (PAP-103, ADR 0020).
 *
 * One typed shape every Claude character is declared in. Roster YAML files, `.claude/agents`
 * definitions (PAP-287), MCP allowlists and permission bundles (PAP-106), budgets (PAP-111),
 * memory locations (PAP-109) and Linear routing (PAP-96, PAP-91) are all generated from it.
 *
 * Zod 4, strict objects: an unknown key is an error, so a new field is always a schema change
 * (bump `schemaVersion` with a migration note; see docs/platform/character-schema.md).
 */
import { z } from 'zod';
import { EFFORT_INPUTS, MODEL_ID_PATTERN, normaliseEffort, PERMISSION_MODES } from './models.ts';
import { SCOPE_PATTERN } from './scopes.ts';

export const SCHEMA_VERSION = 1 as const;

/** kebab-case id: `atlas`, `page-spec-writer`. */
export const KebabId = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    'kebab-case id: lowercase letters, digits and single hyphens',
  )
  .min(2)
  .max(48)
  .meta({ description: 'kebab-case identifier, unique across the roster' });

/** The only human. Characters that report to nobody in the roster report to `justin`. */
export const HUMAN_PRINCIPAL = 'justin' as const;

export const CharacterKind = z.enum(['lead', 'sub']).meta({
  description:
    '`lead` reports to justin or another lead; `sub` is spawned by its `parent` lead with a narrower bundle',
});

export const ModelId = z
  .string()
  .regex(MODEL_ID_PATTERN, 'model id, e.g. claude-sonnet-5')
  .meta({ description: 'Model id from the PAP-98 price table; unknown ids warn' });

export const EffortSchema = z
  .enum(EFFORT_INPUTS)
  .transform(normaliseEffort)
  .meta({ description: 'Reasoning effort default. `xhigh` is an accepted alias for `high`.' });

export const PermissionModeSchema = z.enum(PERMISSION_MODES).meta({
  description: 'Claude Code permission mode the session starts in',
});

/** A tool entry: built-in, built-in with rule argument, or `mcp__<server>[__<tool>]`. */
export const ToolEntry = z
  .string()
  .regex(
    /^(?:[A-Z][A-Za-z]*(?:\(.+\))?|mcp__[a-z][a-z0-9-]*(?:__(?:[A-Za-z][A-Za-z0-9_-]*|\*))?)$/,
    'tool name or mcp__server__tool',
  )
  .meta({
    description: 'Built-in tool (`Bash`, `Bash(pnpm *)`) or MCP tool (`mcp__linear__create_issue`)',
  });

export const ToolsSchema = z
  .strictObject({
    allow: z.array(ToolEntry).default([]),
    deny: z.array(ToolEntry).default([]),
  })
  .meta({ description: 'Tool allow and deny lists; deny wins. Subs must stay within their lead.' });

export const AccessScopeSchema = z
  .string()
  .regex(SCOPE_PATTERN, 'resource:verb[:qualifier]')
  .meta({ description: 'Access scope from the registry (`packages/agents/src/schema/scopes.ts`)' });

export const MemorySchema = z
  .strictObject({
    path: z.string().regex(/^docs\/memory\/.+\.md$/, 'docs/memory/**/*.md'),
    maxTokens: z.number().int().positive().max(20_000),
  })
  .meta({ description: 'Character memory file (PAP-109) and its token budget' });

export const BudgetSchema = z
  .strictObject({
    perSessionUsd: z.number().positive(),
    perDayUsd: z.number().positive(),
    maxTurns: z.number().int().positive(),
    dailySharePct: z.number().min(0).max(100).optional(),
  })
  .meta({ description: 'Hard caps enforced by PAP-111; never unlimited' });

/** Partial budget as written in a character file; resolution fills the rest from parent and roster. */
export const BudgetPatchSchema = BudgetSchema.partial();

export const EscalationAction = z.enum(['escalate', 'needs-justin', 'proceed', 'stop']).meta({
  description:
    '`escalate` to the character in `to`; `needs-justin` files a PAP-94 card through Atlas; `proceed` records the default and continues; `stop` ends the session',
});

export const EscalationRuleSchema = z
  .strictObject({
    when: z.string().min(8).max(400),
    action: EscalationAction,
    to: KebabId.optional(),
  })
  .refine((r) => r.action !== 'escalate' || r.to !== undefined, {
    message: '`to` is required when action is `escalate`',
    path: ['to'],
  })
  .meta({ description: 'One escalation rule: situation and what the session does' });

export const LinearLabel = z
  .string()
  .regex(/^Character\/[A-Z][A-Za-z]+$/, 'Character/<Lead>')
  .meta({ description: 'Linear label the orchestrator routes on (leads only)' });

export const CharacterSchema = z
  .strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    name: KebabId,
    displayName: z.string().min(2).max(64),
    role: z.string().min(4).max(200).meta({ description: 'Role title, e.g. "Platform Engineer"' }),
    kind: CharacterKind,
    reportsTo: z.union([z.literal(HUMAN_PRINCIPAL), KebabId]).meta({
      description: 'Character name this one reports to, or `justin`',
    }),
    parent: KebabId.optional().meta({
      description: 'Lead that spawns this sub (required for `sub`)',
    }),
    description: z.string().min(20).max(600).meta({
      description: 'When to delegate to this character; drives Claude Code sub-agent delegation',
    }),
    model: ModelId.optional(),
    fallbackModel: ModelId.optional().meta({
      description: 'Overload fallback (never used for refusals); must exist in the price table',
    }),
    effort: EffortSchema.optional(),
    permissionMode: PermissionModeSchema.optional(),
    maxParallelSessions: z.number().int().min(1).max(16).optional().meta({
      description: 'How many sessions of this character may run at once (PAP-99)',
    }),
    tools: ToolsSchema.optional(),
    mcpServers: z.array(KebabId).default([]).meta({ description: 'MCP catalog ids (PAP-210)' }),
    access: z.array(AccessScopeSchema).default([]),
    plugins: z.array(KebabId).default([]).meta({ description: 'Claude Code plugin ids' }),
    skills: z
      .array(KebabId)
      .default([])
      .meta({ description: 'Skill ids from `.claude/skills` (PAP-105)' }),
    memory: MemorySchema.optional(),
    budget: BudgetPatchSchema.optional(),
    escalation: z.array(EscalationRuleSchema).default([]),
    denyList: z.string().default('ops/security/agent-deny.yaml').meta({
      description: 'Path of the destructive-action deny list every bundle loads (threat model §4)',
    }),
    linearLabel: LinearLabel.optional(),
    subCharacters: z
      .array(KebabId)
      .optional()
      .meta({ description: "Names of this lead's subs (leads only)" }),
  })
  .superRefine((c, ctx) => {
    if (c.kind === 'sub' && c.parent === undefined) {
      ctx.addIssue({ code: 'custom', path: ['parent'], message: 'a sub needs `parent`' });
    }
    if (c.kind === 'lead' && c.parent !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['parent'], message: 'a lead has no `parent`' });
    }
    if (c.kind === 'sub' && c.parent !== undefined && c.reportsTo !== c.parent) {
      ctx.addIssue({ code: 'custom', path: ['reportsTo'], message: 'a sub reports to its parent' });
    }
    if (c.kind === 'sub' && c.subCharacters !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['subCharacters'],
        message: 'only a lead lists subCharacters',
      });
    }
    if (c.kind === 'sub' && c.linearLabel !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['linearLabel'],
        message: 'only a lead carries a Linear label',
      });
    }
  })
  .meta({
    id: 'Character',
    title: 'PaperOS character',
    description:
      'One Claude character (lead or sub) as declared in packages/agents/characters/*.yaml',
  });

export const RosterDefaultsSchema = z
  .strictObject({
    model: ModelId,
    fallbackModel: ModelId,
    effort: EffortSchema,
    permissionMode: PermissionModeSchema,
    budget: BudgetSchema,
    memoryMaxTokens: z.strictObject({
      global: z.number().int().positive(),
      project: z.number().int().positive(),
      character: z.number().int().positive(),
    }),
    denyList: z.string().default('ops/security/agent-deny.yaml'),
  })
  .meta({ description: 'Roster-wide defaults; the last fallback before a value would be missing' });

export const RosterSchema = z
  .strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    dailyAllowanceUsd: z
      .number()
      .positive()
      .optional()
      .meta({ description: 'Daily credit allowance the lead shares divide (about 700 USD)' }),
    defaults: z
      .strictObject({
        lead: RosterDefaultsSchema,
        sub: RosterDefaultsSchema,
      })
      .optional()
      .meta({
        description:
          'Roster-wide defaults per kind; without them every character must carry a full budget',
      }),
    characters: z.array(CharacterSchema).min(1),
  })
  .meta({
    id: 'Roster',
    title: 'PaperOS roster',
    description: 'Roster defaults plus every character',
  });

export type Character = z.output<typeof CharacterSchema>;
export type CharacterInput = z.input<typeof CharacterSchema>;
export type Roster = z.output<typeof RosterSchema>;
export type RosterInput = z.input<typeof RosterSchema>;
export type RosterDefaults = z.output<typeof RosterDefaultsSchema>;
export type AccessScope = z.output<typeof AccessScopeSchema>;
export type EscalationRule = z.output<typeof EscalationRuleSchema>;
export type BudgetSpec = z.output<typeof BudgetSchema>;
export type MemorySpec = z.output<typeof MemorySchema>;
export type ToolsSpec = z.output<typeof ToolsSchema>;
