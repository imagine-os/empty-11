# Character schema

The single typed shape every Claude character is declared in (PAP-103, ADR
[0020](../adr/0020-character-schema.md)). Roster YAML files (PAP-104, PAP-284), `.claude/agents`
definitions (PAP-287), MCP allowlists and permission bundles (PAP-106), budgets (PAP-111), memory
locations (PAP-109) and Linear routing (PAP-96, PAP-91) are all generated from it. Everything in the
agents project and the orchestrator reads this schema and nothing else.

| What | Where |
| -- | -- |
| Zod 4 source of truth | `packages/agents/src/schema/character.ts` (`CharacterSchema`, `RosterSchema`) |
| Scope registry | `packages/agents/src/schema/scopes.ts` (`SCOPES`) |
| Known tools | `packages/agents/src/schema/tools.ts` (`KNOWN_TOOLS`, `lastVerified`) |
| Model ids, efforts, permission modes | `packages/agents/src/schema/models.ts` |
| MCP catalog stub (PAP-210 replaces it) | `packages/agents/src/schema/mcp-catalog.stub.json` |
| Validator | `packages/agents/src/schema/validate.ts` (`validateRoster`) |
| Inheritance | `packages/agents/src/schema/inherit.ts` (`resolveInheritance`) |
| Generated JSON Schema (never hand-edited) | `packages/agents/schema/character.schema.json`, `roster.schema.json` |
| Golden fixtures (nine leads, 28 subs) | `packages/agents/fixtures/valid/roster.yaml`, `characters/*.yaml`, resolved `roster.json` |
| Invalid fixtures, one per error code | `packages/agents/fixtures/invalid/*.yaml` (`# expect: <CODE>` header) |
| Import path | `@paperos/agents/schema` (also re-exported from `@paperos/agents`) |

## Commands

All scripts run under Node 22 with type stripping; no build step.

| Command | Does | Exit |
| -- | -- | -- |
| `pnpm --filter @paperos/agents validate [dir\|file ...]` | Validate roster directories (`roster.yaml` + `characters/*.yaml`) or single files; default `fixtures/valid`. `--json`, `--quiet`. | 0 ok, 1 errors, 2 usage |
| `pnpm --filter @paperos/agents gen:schemas [--check]` | Regenerate the JSON Schemas; `--check` fails on drift (the Vitest suite does the same). | 0 / 1 |
| `pnpm --filter @paperos/agents gen:fixtures [--check]` | Resolve the golden roster with inheritance into `fixtures/valid/roster.json`. | 0 / 1 |
| `pnpm --filter @paperos/agents convert:plan [--check]` | Dry-run conversion of plan.json `agents[]` (copy in `fixtures/source/plan-agents.json`) into 37 skeletons; `--check` compares them with the golden fixtures. | 0 / 1 |

A root alias `pnpm agents validate` needs a root `package.json` script and is a PAP-13 follow-up; the
spec's `pnpm agents validate` means the `--filter` form until then.

## Fields

Every character file is one strict object: an unknown key is an error, so adding a field is a schema
change (see *Versioning*). Kebab ids match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`.

| Field | Type | Required | Purpose | Example |
| -- | -- | -- | -- | -- |
| `schemaVersion` | `1` | yes | Shape version; a breaking change bumps it and ships a migration note. | `1` |
| `name` | kebab id | yes | Stable id, unique across the roster; file name, memory file name, `PAPEROS_CHARACTER`. | `page-spec-writer` |
| `displayName` | string 2..64 | yes | What the plan and the org chart call it. | `Page Spec Writer` |
| `role` | string 4..200 | yes | Role title. | `Platform Engineer` |
| `kind` | `lead` \| `sub` | yes | Leads report to `justin` or another lead; subs are spawned by their `parent` with a narrower bundle. | `sub` |
| `reportsTo` | kebab id \| `justin` | yes | Org chart edge. Must resolve; the graph must be acyclic. A sub reports to its parent. | `atlas` |
| `parent` | kebab id | subs only | The lead that spawns this sub. Must be a lead. | `quill` |
| `description` | string 20..600 | yes | When to delegate to this character. Drives Claude Code sub-agent delegation, so it starts with "Use for" / "Use to" and carries trigger phrases. | `Use to interview, draft and validate page.spec.yaml ...` |
| `model` | model id | no | Default model. Defaults through parent and roster to `claude-fable-5-1`. Unknown to the PAP-98 price table: warning `MODEL_UNKNOWN`. **A default only**: the issue's `Model` label wins for the session (`resolveModel()`). | `claude-sonnet-5` |
| `fallbackModel` | model id | no | Overload fallback; participates in the overload chain, never in refusal handling. | `claude-opus-5` |
| `effort` | `low` \| `medium` \| `high` \| `max` | no | Reasoning-effort default; the issue's `Effort` label wins. `xhigh` in the sheets is an accepted alias normalised to `high` on parse. | `xhigh` |
| `permissionMode` | `default` \| `acceptEdits` \| `plan` \| `dontAsk` | no | Claude Code permission mode the session starts in. Reviewers run `plan`. | `plan` |
| `maxParallelSessions` | int 1..16 | no | How many sessions of this character PAP-99 may run at once. Default 1. | `6` |
| `tools.allow[]` | tool entries | no | Built-in names (`Read`), built-ins with a permission-rule argument (`Bash(pnpm *)`, `WebFetch(domain:linear.app)`, `Write(docs/pm/**)`) and MCP tools (`mcp__linear`, `mcp__linear__create_issue`, `mcp__stripe__*`). | `Bash(git worktree *)` |
| `tools.deny[]` | tool entries | no | Deny wins over allow. Every lead carries the §4 deny mirror (`Bash(git push * main)`, `Bash(rm -rf *)`, `Write(ops/secrets/**)` ...). | `Write` |
| `mcpServers[]` | catalog ids | no | PAP-210 server ids. Every `mcp__<server>` in `tools.allow` must name a listed server. | `[linear, github]` |
| `access[]` | scopes | no | `resource:verb[:qualifier]` from the registry below. Unknown scopes fail. | `repo:write:packages/ui` |
| `plugins[]` | kebab ids | no | Claude Code plugin ids. | `[code-review, simplify]` |
| `skills[]` | kebab ids | no | Skill ids from `.claude/skills` (PAP-105). Unknown: warning `UNKNOWN_SKILL`. | `[review-pr, linear-update]` |
| `memory.path` | `docs/memory/**/*.md` | no | Memory file (PAP-109). Default `docs/memory/characters/<name>.md`. | `docs/memory/characters/forge.md` |
| `memory.maxTokens` | int | no | Token budget of that file. Default from roster (`character: 3000`). | `3000` |
| `budget.perSessionUsd` | number | resolved | Hard session cap (PAP-111). Resolution: own → parent → roster default; never unlimited (`BUDGET_MISSING`). | `60` |
| `budget.perDayUsd` | number | resolved | Daily cap. Leads: share × allowance. Subs draw from their lead's day. | `140` |
| `budget.maxTurns` | int | resolved | Turn cap. | `200` |
| `budget.dailySharePct` | 0..100 | leads | Share of the daily allowance; lead shares should sum to 100 (`BUDGET_SHARE_SUM`). Not inherited by subs. | `20` |
| `escalation[]` | `{ when, action, to? }` | no | `action`: `escalate` (to `to`), `needs-justin` (PAP-94 card through Atlas), `proceed` (record the default and continue), `stop` (wip commit and end). | `{ when: "a contract another project consumes must change", action: escalate, to: atlas }` |
| `denyList` | path | no | The destructive-action deny list every bundle loads. Default `ops/security/agent-deny.yaml` (threat model §4). | |
| `linearLabel` | `Character/<Lead>` | leads | Label the orchestrator routes on (PAP-91, PAP-96). Unique (`DUP_LABEL`); subs carry none. | `Character/Forge` |
| `subCharacters[]` | kebab ids | leads | The lead's subs; must equal the subs whose `parent` is this lead (`SUB_LIST_MISMATCH`). | `[tauri-smith, schema-wright, ops-runner]` |

### Roster document

`roster.yaml` carries what is shared: `schemaVersion`, `dailyAllowanceUsd` (about 700), and
`defaults.lead` / `defaults.sub` (`model`, `fallbackModel`, `effort`, `permissionMode`, `budget`,
`memoryMaxTokens { global, project, character }`, `denyList`). Characters may live inline under
`characters:` or one per file under `characters/`. Without `defaults`, every character must carry a
complete budget.

### Inheritance (`resolveInheritance`)

Per field: the character's own value, then (subs) the parent's resolved value, then
`defaults[kind]`. Budgets resolve field by field, so a sub may override only `maxTurns`. **Tools,
MCP servers and access are not inherited**: an omitted list means none, which is the least-privilege
default PAP-106 builds bundles from; a sub may hold only what its lead holds.

## Access-scope registry

`resource:verb[:qualifier]`, classes `read` | `write` | `admin` | `destructive`. The registry is the
normalised union of every access string in plan.json `agents[]` and the nine character sheets; the
normalisation table is in `scopes.ts`. A qualifier is checked per scope: fixed values
(`stripe:write:test`, `email:send:sandbox`) or a repository path (`repo:write:packages/ui`,
`repo:write:all`, `repo:write:.claude`). Negations in the plan (`no merge rights`, `no prod write`)
are dropped: the absence of a scope is the denial.

`destructive` scopes (`linear:delete`, `repo:force-push`) are registered only so the class rule is
testable; nobody in the golden roster holds one, and the validator refuses them on any character
that is not a lead reporting to `justin` (`DESTRUCTIVE_SCOPE`). Adding a scope is a one-line change to
`SCOPES` plus a fixture that uses it.

## Validation codes

`validateRoster(input)` returns `{ ok, errors, warnings, roster? }`; `roster` is the resolved roster
when the document parsed. Every finding has `code`, `severity`, `character?`, `path?`, `message`.

| Code | Severity | Rule |
| -- | -- | -- |
| `SCHEMA_INVALID` | error | Zod parse failure (unknown key, bad enum, malformed id, scope or tool name, sub without parent). Other rules do not run. |
| `DUP_NAME` | error | Same `name` twice. |
| `DUP_LABEL` | error | Two characters share `linearLabel`. |
| `LEAD_LABEL_MISSING` | error | A lead without `linearLabel`. |
| `UNKNOWN_REPORTS_TO` / `UNKNOWN_PARENT` | error | Reference to a name not in the roster. |
| `PARENT_NOT_LEAD` | error | A sub whose parent is a sub. |
| `REPORTS_TO_CYCLE` | error | Cycle in `reportsTo`; the message names it (`alpha -> beta -> alpha`). Self-report is a cycle of length one. |
| `SUB_LIST_MISMATCH` | error | `subCharacters` disagrees with the subs whose `parent` is the lead. |
| `UNKNOWN_SCOPE` | error | Scope not in the registry or qualifier not allowed. |
| `DESTRUCTIVE_SCOPE` | error | Destructive-class scope on anyone but a lead reporting to justin. |
| `SUB_SCOPE_NOT_IN_LEAD` | error | Sub holds a scope its lead does not cover. |
| `UNKNOWN_TOOL` | error | Not a built-in, not a valid rule argument, not `mcp__server[__tool]`. |
| `SUB_TOOL_NOT_IN_LEAD` | error | Sub allows a tool its lead does not; names both. |
| `UNKNOWN_MCP_SERVER` | error | Server id not in the catalog, or an `mcp__` tool names a server the character does not list. |
| `SUB_MCP_NOT_IN_LEAD` | error | Sub uses a server its lead does not. |
| `BUDGET_MISSING` | error | A budget field resolves to nothing; never unlimited. |
| `MODEL_UNKNOWN` | warning | `model` / `fallbackModel` not in the PAP-98 price table. |
| `MCP_CATALOG_STUB` | warning | Checked against the stub catalog; clears when PAP-210 lands. |
| `TOOLS_STALE` | warning | `KNOWN_TOOLS.lastVerified` older than 30 days. |
| `UNKNOWN_SKILL` | warning | Skill id not in the known list (PAP-105 `skills.json`). |
| `BUDGET_SHARE_SUM` | warning | Lead `dailySharePct` values do not sum to 100. |

## Editor completion

Every fixture starts with `# yaml-language-server: $schema=../../../schema/character.schema.json`
(the roster file points at `roster.schema.json`). The Red Hat YAML extension reads that modeline, so
completion on `permissionMode` lists the four modes and an unknown key is underlined without any
workspace settings. `.vscode/settings.json` is gitignored in this repo (only `extensions.json` is
tracked), which is why the wiring is a modeline rather than a `yaml.schemas` entry; PAP-284 adds the
modeline to `packages/agents/characters/*.yaml` the same way.

## Versioning

`schemaVersion` is `1`. Adding an optional field is non-breaking and needs no bump but does need
`gen:schemas` and a changelog line. Renaming or removing a field, changing an enum, or making a
field required bumps `schemaVersion`, adds a parser branch for the previous version, and ships a
migration note in the changelog fragment and the ADR that supersedes 0020.

## Golden fixtures

`fixtures/valid/characters/*.yaml` encode the nine lead sheets in `docs/characters/` of the plan
repo (Atlas, Forge, Iris, Quill, Sentinel, Nova, Ledger, Beacon, Scout) and their 28 subs, keeping
the sheets' `xhigh` spelling. Daily shares 8 / 20 / 8 / 10 / 30 / 12 / 4 / 3 / 5 sum to 100 of a
$700 allowance; per-session cap 60 (the S issue cap), sub sessions 15 USD / 80 turns. Sentinel's
four reviewers run `plan` with `Write` and `Edit` denied. Leads hold the union of their subs' tools,
scopes and servers, because a sub's bundle is a subset of its lead's (PAP-106). PAP-284 turns these
fixtures into the live roster under `packages/agents/characters/`.
