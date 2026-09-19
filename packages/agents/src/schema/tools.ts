/**
 * Known tools list (PAP-103).
 *
 * `tools.allow[]` / `tools.deny[]` entries are one of:
 *   - a Claude Code built-in name (`Read`, `Bash`, ...);
 *   - a built-in with a permission-rule argument, `Bash(git worktree *)`, `WebFetch(domain:linear.app)`;
 *   - an MCP server or tool, `mcp__<server>` or `mcp__<server>__<tool>` (PAP-210 grammar), `*` allowed
 *     as the tool segment.
 *
 * `lastVerified` is the date the built-in list was checked against Claude Code; `pnpm agents validate`
 * warns with `TOOLS_STALE` when it is older than 30 days.
 */

export const BUILTIN_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'Bash',
  'Glob',
  'Grep',
  'LS',
  'WebFetch',
  'WebSearch',
  'Task',
  'TodoWrite',
  'Skill',
  'AskUserQuestion',
] as const;
export type BuiltinTool = (typeof BUILTIN_TOOLS)[number];

/** Built-ins that accept a permission-rule argument in parentheses. */
export const ARGUMENT_TOOLS = [
  'Bash',
  'WebFetch',
  'Read',
  'Write',
  'Edit',
  'Task',
  'Skill',
] as const;

export const KNOWN_TOOLS = {
  lastVerified: '2026-09-19',
  staleAfterDays: 30,
  builtins: BUILTIN_TOOLS,
  argumentTools: ARGUMENT_TOOLS,
} as const;

export const MCP_TOOL_PATTERN = /^mcp__([a-z][a-z0-9-]*)(?:__([A-Za-z][A-Za-z0-9_-]*|\*))?$/;
export const TOOL_RULE_PATTERN = /^([A-Z][A-Za-z]*)\((.+)\)$/;

export type ParsedTool =
  | { kind: 'builtin'; name: BuiltinTool; argument?: string }
  | { kind: 'mcp'; server: string; tool: string | undefined };

/** Parse one tools entry; `undefined` when it is not a known shape. */
export function parseTool(entry: string): ParsedTool | undefined {
  const mcp = MCP_TOOL_PATTERN.exec(entry);
  if (mcp) return { kind: 'mcp', server: mcp[1] as string, tool: mcp[2] };
  const ruled = TOOL_RULE_PATTERN.exec(entry);
  if (ruled) {
    const name = ruled[1] as string;
    if (!(ARGUMENT_TOOLS as readonly string[]).includes(name)) return undefined;
    return { kind: 'builtin', name: name as BuiltinTool, argument: ruled[2] as string };
  }
  if ((BUILTIN_TOOLS as readonly string[]).includes(entry))
    return { kind: 'builtin', name: entry as BuiltinTool };
  return undefined;
}

export function isKnownTool(entry: string): boolean {
  return parseTool(entry) !== undefined;
}

/**
 * Does a held tool entry cover a wanted one? `Bash` covers `Bash(pnpm *)`; `mcp__linear` covers
 * `mcp__linear__create_issue`; `Bash(pnpm *)` covers `Bash(pnpm test)`; exact matches always cover.
 */
export function toolCovers(held: string, wanted: string): boolean {
  if (held === wanted) return true;
  const h = parseTool(held);
  const w = parseTool(wanted);
  if (!h || !w || h.kind !== w.kind) return false;
  if (h.kind === 'mcp' && w.kind === 'mcp') {
    return h.server === w.server && (h.tool === undefined || h.tool === '*' || h.tool === w.tool);
  }
  if (h.kind === 'builtin' && w.kind === 'builtin') {
    if (h.name !== w.name) return false;
    if (h.argument === undefined) return true;
    if (w.argument === undefined) return false;
    return globCovers(h.argument, w.argument);
  }
  return false;
}

function globCovers(pattern: string, value: string): boolean {
  if (pattern === value) return true;
  if (!pattern.includes('*')) return false;
  const re = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
  return re.test(value);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function daysSince(isoDate: string, now: Date): number {
  const then = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.floor((now.getTime() - then) / 86_400_000);
}
