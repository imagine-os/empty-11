/**
 * Zod schema for the MCP server catalogue (`.claude/mcp/catalog.json`), PAP-210, ADR 0021.
 *
 * The catalogue is hand-written and this schema is the only thing that decides whether it is
 * well formed. Two rules are load-bearing and are enforced here rather than by review:
 *
 * 1. A tool without a scope class is a schema error, never a default. A missing class would
 *    silently read as "harmless" and that is exactly the mistake the deny list exists to stop.
 * 2. A credential never appears as a value. Auth is declared as broker placeholders
 *    (`broker:<service>/<credential>`) which the egress proxy swaps per host
 *    (Security & Threat Model section 5). The shape of a placeholder is checked here; the
 *    absence of anything secret-shaped anywhere else is checked in `validate.ts`.
 */
import { z } from 'zod';

/** The nine lead characters. PAP-103's roster supersedes this list when it lands. */
export const LEAD_CHARACTERS = [
  'atlas',
  'forge',
  'iris',
  'quill',
  'sentinel',
  'nova',
  'ledger',
  'beacon',
  'scout',
] as const;

export type LeadCharacter = (typeof LEAD_CHARACTERS)[number];

/** Only Atlas may hold a `destructive` tool, and even then it routes through PAP-94. */
export const DESTRUCTIVE_HOLDER: LeadCharacter = 'atlas';

export const brokerPlaceholderPattern = /^broker:[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
export const characterIdPattern = /^[a-z][a-z0-9-]*$/;
export const serverIdPattern = /^[a-z][a-z0-9-]*$/;
export const toolNamePattern = /^[a-z][a-z0-9_-]*$/;

export const ScopeClassSchema = z.enum(['read', 'write', 'destructive']);
export type ScopeClass = z.infer<typeof ScopeClassSchema>;

export const CharacterIdSchema = z
  .string()
  .regex(characterIdPattern, 'character id must be kebab-case');

export const BrokerPlaceholderSchema = z
  .string()
  .regex(brokerPlaceholderPattern, 'auth must be a broker placeholder, e.g. broker:linear/api-key');

export const ToolSchema = z.object({
  name: z.string().regex(toolNamePattern, 'tool name must be snake or kebab case'),
  /** Required. A tool with no scope class fails the schema — see the header. */
  scope: ScopeClassSchema,
  /** `docs` means the name was read from the vendor's documentation; `inferred` means it was not. */
  source: z.enum(['docs', 'inferred']),
});
export type McpTool = z.infer<typeof ToolSchema>;

export const RubricScoreSchema = z.union([z.literal('na'), z.number().int().min(0).max(4)]);
export type RubricScore = z.infer<typeof RubricScoreSchema>;

export const CriterionSchema = z.object({
  score: RubricScoreSchema,
  evidence: z.string().min(1),
});

export const RUBRIC_CRITERIA = ['license', 'maintenance', 'bundle', 'a11y', 'ts', 'agent'] as const;
export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number];

export const ScoresSchema = z.object({
  license: CriterionSchema,
  maintenance: CriterionSchema,
  bundle: CriterionSchema,
  a11y: CriterionSchema,
  ts: CriterionSchema,
  agent: CriterionSchema,
});

export const ExtraSchema = z.object({
  id: z.string().min(1),
  score: RubricScoreSchema,
  evidence: z.string().min(1),
});

export const ScorecardSchema = z.object({
  scores: ScoresSchema,
  extras: z.array(ExtraSchema),
  total: z.number().min(0).max(100),
  verdict: z.enum(['adopt', 'trial', 'reject']),
});
export type Scorecard = z.infer<typeof ScorecardSchema>;

export const AuthSchema = z.object({
  mode: z.enum(['oauth', 'bearer', 'api-key', 'none']),
  brokerPlaceholders: z.array(BrokerPlaceholderSchema),
  /** Can an unattended session bring this up without a human at a browser? */
  headless: z.boolean(),
  notes: z.string().min(1),
});

export const ServerSchema = z.object({
  id: z.string().regex(serverIdPattern),
  name: z.string().min(1),
  kind: z.enum(['remote', 'stdio', 'connector']),
  transport: z.enum(['http', 'sse', 'stdio']),
  url: z.string().url().nullable(),
  readOnlyUrl: z.string().url().nullable(),
  package: z.string().nullable(),
  version: z.string().nullable(),
  auth: AuthSchema,
  /** The highest scope the server can reach at all, before per-character narrowing. */
  scopeClass: ScopeClassSchema,
  toolsComplete: z.boolean(),
  tools: z.array(ToolSchema).min(1),
  destructiveTools: z.array(z.string().regex(toolNamePattern)),
  destructiveNote: z.string().min(1),
  owners: z.array(CharacterIdSchema).min(1),
  writeCharacters: z.array(CharacterIdSchema),
  allowedCharacters: z.array(CharacterIdSchema),
  sandbox: z.object({ available: z.boolean(), how: z.string().min(1) }),
  vendorRateLimit: z.string().min(1),
  budgetPerSession: z.number().int().min(0),
  docsUrl: z.string().url(),
  healthCheck: z.string().min(1),
  aliases: z.array(z.string()),
  prefer: z.string().nullable(),
  preferNote: z.string().min(1).optional(),
  status: z.enum(['adopted', 'candidate', 'needs-account', 'denied']),
  statusNote: z.string().min(1).optional(),
  verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rubric: ScorecardSchema,
});
export type McpServer = z.infer<typeof ServerSchema>;

export const DeniedSchema = z.object({
  id: z.string().min(1),
  package: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.string().min(1),
  supersededBy: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const CatalogSchema = z.object({
  catalogVersion: z.number().int().positive(),
  issue: z.string(),
  adr: z.string(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().min(1),
  characters: z.array(CharacterIdSchema).min(1),
  rubric: z.object({
    source: z.string().min(1),
    baseWeights: z.record(z.string(), z.number().positive()),
    domainExtras: z.record(
      z.string(),
      z.object({
        weight: z.number().positive(),
        what: z.string().min(1),
        anchors: z.record(z.string(), z.string()),
      }),
    ),
    gatesNotApplicable: z.array(z.string()),
    gatesNotApplicableReason: z.string().min(1),
    thresholds: z.object({ adopt: z.number(), trial: z.number() }),
  }),
  denied: z.array(DeniedSchema),
  servers: z.array(ServerSchema).min(1),
});
export type McpCatalog = z.infer<typeof CatalogSchema>;

/** The tool-name grammar Claude Code uses: `mcp__<server>__<tool>`. */
export function qualifiedToolName(serverId: string, toolName: string): string {
  return `mcp__${serverId}__${toolName}`;
}

export const qualifiedToolNamePattern = /^mcp__[a-z][a-z0-9-]*__[a-z][a-z0-9_-]*$/;
