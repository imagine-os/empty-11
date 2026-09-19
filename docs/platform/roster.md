# Roster

The live PaperOS roster (PAP-284): nine leads and 28 subs as validated YAML, one file per
character, plus the roster defaults. It is the structured half of the roster; the prompt prose is
PAP-285 (leads) and PAP-286 (subs), the `.claude/agents` rendering is PAP-287. Schema, validator and
codes: [`character-schema.md`](character-schema.md) (PAP-103, ADR 0020).

| What | Where |
| -- | -- |
| Roster defaults, allowance | `packages/agents/roster.yaml` |
| One character per file | `packages/agents/characters/<name>.yaml` (37) |
| Converter and merge | `packages/agents/scripts/plan-to-roster.ts`, logic in `packages/agents/src/roster/convert.ts` |
| Policy (defaults, shares, read-mostly list) | `packages/agents/src/roster/policy.ts` |
| Org tree and plan diff | `packages/agents/scripts/tree.ts`, `packages/agents/src/roster/tree.ts` |
| Live roster loader | `packages/agents/src/roster/live.ts` (`validateLiveRoster()`, `readLiveRosterFiles()`) |
| Converter snapshot | `packages/agents/fixtures/plan-to-roster.snapshot.yaml` |
| Import path | `@paperos/agents/roster` (also re-exported from `@paperos/agents`) |

## Where each field comes from

plan.json `agents[]` (copy: `packages/agents/fixtures/source/plan-agents.json`) owns the org chart:
`name` (kebab of the plan name), `displayName`, `kind`, `reportsTo`, `parent`, `linearLabel`
(`Character/<Lead>`, leads only), `subCharacters` (plan order), and for leads the normalised `access`
scopes and `plugins`. The character sheets in the plan repo (`docs/characters/<lead>.md`) supplied
the hand-completed rest: `role`, `description` (trigger phrases, refined by PAP-286), `tools`,
`mcpServers`, `skills`, sheet-only scopes such as `linear:issue-create:backlog`, `memory`,
`maxParallelSessions` and the escalation prose. `plan-to-roster --merge` rewrites the plan-owned
fields and keeps everything else; `--check` reports drift between the two.

## Defaults (round-4 amendment)

`roster.yaml` holds the last fallback. A character's own value wins over its parent's resolved
value, which wins over these defaults (`resolveInheritance`); the issue's `Model` / `Effort` labels
win over all of them for a session (`resolveModel`). Prompts never name a model.

| Kind | Model | Fallback | Effort | Mode | Session | Turns | Memory |
| -- | -- | -- | -- | -- | -- | -- | -- |
| lead | `claude-opus-5` | `claude-sonnet-5` | `high` | `acceptEdits` | 40 USD | 200 | 3000 tokens |
| sub | `claude-sonnet-5` | `claude-haiku-4-5` | `medium` | `acceptEdits` | 15 USD | 80 | 1500 tokens |

Leads carry no `model` or `effort` of their own: they inherit the roster. Three groups of subs
deviate, pinned in their files:

* **Sentinel's reviewers** (Code Reviewer, Security Auditor, Visual Inspector, Edge Case Hunter):
  `claude-opus-5` / `high` / `plan`, `Write` and `Edit` denied. `resolveModel` drops a review to
  Sonnet 5 / high when the builder was Sonnet.
* **Read-mostly subs** (Library Evaluator, Prompt Logger, Changelog Scribe, Token Keeper, Motion and
  Input Stylist, CRM Builder, Template Packager): `claude-sonnet-5` / `medium`, fallback
  `claude-haiku-4-5`.
* **Everyone else** inherits its lead: builder subs run what their lead runs.

Scout and its subs run `plan` (research first); Sentinel the lead runs `acceptEdits` because it
also builds the gates under `packages/quality/**`.

## Budgets

`dailyAllowanceUsd: 700` (PAP-111). Lead shares of the day, percent, summing to 100 (tested):
Sentinel 30, Forge 20, Nova 12, Quill 10, Atlas 8, Iris 8, Scout 5, Ledger 4, Beacon 3. Each lead's
`perDayUsd` is its share of the allowance; subs carry no share and draw from their lead's day
(`perDayUsd` inherited). Session caps: lead 40 USD / 200 turns, sub 15 USD / 80 turns. A lead
added without a share resolves to the research-sized day (5 percent) until Atlas reweights.

## Escalation

Every lead carries the shared four: contract, cycle or file-collision situations escalate to
Atlas; irreversible external actions, reserve spend, architecture reversals and legal, tax or PCI
matters file a Needs Justin card; anything a spec, ADR or rubric already decides proceeds on the
default; 100 percent of the cap stops the session. Atlas swaps the first rule for its own cycle
rule (break the cycle before the next dispatch, record the fix). Every sub escalates anything
outside its lane to its lead and stops at its cap.

## Commands

| Command | Does | Exit |
| -- | -- | -- |
| `pnpm --filter @paperos/agents validate` | No argument: validates the live roster, then `fixtures/valid`. | 0 ok, 1 errors, 2 usage |
| `pnpm --filter @paperos/agents tree [--check] [--plain] [--plan <file>] [<dir>]` | Prints the org tree (model / effort / mode, budget, label per node) and diffs the structure against plan.json; `--check` exits 1 on a difference or a validation error. | 0 / 1 / 2 |
| `pnpm --filter @paperos/agents plan-to-roster [--plan <file>] [--out <dir>] [--merge] [--check] [--force] [--dry-run]` | Converts plan.json `agents[]` to `roster.yaml` + `characters/*.yaml`. Never overwrites without `--merge` (plan-owned fields only, hand edits kept) or `--force`. `--check` names the drift and writes nothing; orphans (files the plan no longer names) are reported, never deleted. Validates before writing. | 0 / 1 / 2 |

The root alias `pnpm agents <cmd>` is a PAP-13 follow-up; until it lands, the `--filter` form is
the command.

## Adding or changing a character

1. Change plan.json `agents[]` (structure) and run `plan-to-roster --merge`; a new sub gets a
   skeleton with the policy defaults and its lead's read-class scopes, never more. Hand-complete
   tools, servers, skills and description in the new file.
2. Or edit the YAML directly for anything the plan does not own.
3. `pnpm --filter @paperos/agents validate`, then `tree --check`. Both run in `pnpm check` through
   the Vitest suite (`src/roster/*.test.ts`), which also asserts the shares sum, label uniqueness,
   the inheritance groups above and the converter snapshot.

## Consumers

PAP-285 and PAP-286 write prompts against these fields; PAP-287 renders `.claude/agents/*.md` and
`dist/roster.json`; PAP-106 builds permission bundles from `tools`, `mcpServers`, `permissionMode`;
PAP-111 enforces `budget`; PAP-113 serves the resolved roster as `agents.roster`.
