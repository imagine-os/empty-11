# .claude/agents (stub)

One file per character: routing rules, tools, access, refusal rules. Lands with PAP-103.

Each character also has `<character>/mcp.json`: the MCP servers that character gets, at the
endpoint their scope allows (PAP-210). They are checked against
[`../mcp/catalog.json`](../mcp/catalog.json) by `packages/agents/src/mcp/`; PAP-106 turns them
into generated bundles with `settings.json` and `hooks.json` beside them.
