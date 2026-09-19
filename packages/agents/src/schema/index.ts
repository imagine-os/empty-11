/**
 * `@paperos/agents/schema` — the character schema (PAP-103, ADR 0020).
 *
 * Provides `CharacterSchema`, `RosterSchema`, their types, `validateRoster()`,
 * `resolveInheritance()`, the scope registry `SCOPES`, the known tools list `KNOWN_TOOLS`, and the
 * JSON Schema generators. Consumers: PAP-104/PAP-284 (YAML files), PAP-106 (bundles), PAP-111
 * (budgets), PAP-113 (`agents.roster`), PAP-96 (routing), PAP-91 (labels).
 */

export type {
  AccessScope,
  BudgetSpec,
  Character,
  CharacterInput,
  EscalationRule,
  MemorySpec,
  Roster,
  RosterDefaults,
  RosterInput,
  ToolsSpec,
} from './character.ts';
export {
  AccessScopeSchema,
  BudgetPatchSchema,
  BudgetSchema,
  CharacterKind,
  CharacterSchema,
  EffortSchema,
  EscalationAction,
  EscalationRuleSchema,
  HUMAN_PRINCIPAL,
  KebabId,
  LinearLabel,
  MemorySchema,
  ModelId,
  PermissionModeSchema,
  RosterDefaultsSchema,
  RosterSchema,
  SCHEMA_VERSION,
  ToolEntry,
  ToolsSchema,
} from './character.ts';
export type { ResolvedCharacter, ResolvedRoster } from './inherit.ts';
export { resolveInheritance } from './inherit.ts';
export { characterJsonSchema, rosterJsonSchema, stringifySchema } from './json-schema.ts';
export type { RosterFiles } from './load.ts';
export { assembleRoster, loadRosterDir, readRosterDir, validateRosterFiles } from './load.ts';
export type { McpCatalogRef } from './mcp-catalog.ts';
export {
  loadMcpCatalog,
  MCP_CATALOG_STUB,
  MCP_CATALOG_STUB_PATH,
  McpCatalogRefSchema,
} from './mcp-catalog.ts';
export type { Effort, EffortInput, PermissionMode, PriceTableModel } from './models.ts';
export {
  DEFAULT_MODEL,
  EFFORT_INPUTS,
  EFFORTS,
  MODEL_ID_PATTERN,
  normaliseEffort,
  PERMISSION_MODES,
  PRICE_TABLE_MODELS,
} from './models.ts';
export type { QualifierRule, ResolvedScope, ScopeClass, ScopeDefinition } from './scopes.ts';
export {
  isKnownScope,
  resolveScope,
  SCOPE_CLASSES,
  SCOPE_IDS,
  SCOPE_PATTERN,
  SCOPES,
  scopeCovers,
} from './scopes.ts';
export type { KnownSkill } from './skills.ts';
export { KNOWN_SKILLS } from './skills.ts';
export type { BuiltinTool, ParsedTool } from './tools.ts';
export {
  ARGUMENT_TOOLS,
  BUILTIN_TOOLS,
  daysSince,
  isKnownTool,
  KNOWN_TOOLS,
  MCP_TOOL_PATTERN,
  parseTool,
  TOOL_RULE_PATTERN,
  toolCovers,
} from './tools.ts';
export type {
  ErrorCode,
  Finding,
  FindingCode,
  ValidateOptions,
  ValidationResult,
  WarningCode,
} from './validate.ts';
export { ERROR_CODES, isCharacterArray, validateRoster, WARNING_CODES } from './validate.ts';
