---
id: "0020"
title: "Character schema: one Zod shape for every agent character"
status: Accepted
date: 2026-09-19
deciders: ["Atlas"]
issue: PAP-103
supersedes: []
supersededBy: null
tags: ["agents", "schema", "security"]
reviewDate: null
---

# 0020. Character schema: one Zod shape for every agent character

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-103](https://linear.app/paperos/issue/PAP-103)
* Deciders: Atlas (Decomposer, decision), Sentinel (review), Quill (doc review)

## Context

Nine lead characters and 28 sub-characters run as parallel Claude Code sessions. Today each one is
described in prose (a character sheet) and in plan.json `agents[]`, and five downstream issues want
to *generate* from that description: roster YAML (PAP-104, PAP-284), `.claude/agents` definitions
(PAP-287), per-character MCP allowlists and permission bundles (PAP-106), budgets (PAP-111), memory
locations (PAP-109), plus Linear routing (PAP-96, PAP-91) and the org chart UI (PAP-113). Without one
typed shape each of them would parse prose, disagree about names, and the security rules that
depend on the roster (a sub never holds more than its lead; destructive scopes only at the top;
budgets never unlimited; threat model §4) would have no place to be enforced.

Constraints: the template monorepo is Zod 4, TypeScript 5.9 strict, Vitest 3, Node 22 with type
stripping, no build step between packages, and `packages/agents` is the home of `contract-agents`
(module table row *agents*). The MCP catalog (PAP-210) and the price table (PAP-98) do not exist yet
but the schema has to reference both. The character sheets spell effort `xhigh`; the round-4 rule is
`low | medium | high | max` with issue labels overriding character defaults.

## Decision

We will declare every character in one strict Zod 4 object, `CharacterSchema`, with a companion
`RosterSchema` for shared defaults, exported from `@paperos/agents/schema`
(`packages/agents/src/schema/`), and treat it as the only source of truth for characters.

* **Fields**: identity (`name`, `displayName`, `role`, `kind`, `description`), org chart
  (`reportsTo`, `parent`, `subCharacters`), defaults the issue labels override (`model`,
  `fallbackModel`, `effort`, `permissionMode`), capability (`tools.allow/deny`, `mcpServers`,
  `access`, `plugins`, `skills`), limits (`memory`, `budget`, `maxParallelSessions`), behaviour
  (`escalation[]`, `denyList`), routing (`linearLabel`) and `schemaVersion`.
* **Registries live next to the schema**: an access-scope registry (`resource:verb[:qualifier]`,
  classes read / write / admin / destructive), a known-tools list with `lastVerified`, the price-table
  model ids, and a stub MCP catalog that PAP-210 replaces. Unknown scopes, tools and servers are
  errors; unknown models and skills are warnings.
* **Validation beyond the schema** (`validateRoster`): acyclic `reportsTo`, resolving references,
  unique names and labels, sub ⊆ lead for tools, scopes and servers, destructive scopes only on a
  lead that reports to `justin`, budgets never unlimited. Stable codes; one invalid fixture per code.
* **Inheritance** (`resolveInheritance`): own → parent → roster default, field by field for budgets;
  tools, scopes and servers are never inherited (least privilege by default).
* **`xhigh` is an accepted alias** normalised to `high` on parse, so the nine sheets validate
  unchanged while the output type is the round-4 enum.
* **Generated artefacts are committed and drift-tested**: JSON Schema (`z.toJSONSchema`, draft
  2020-12, input side), the resolved golden `roster.json`, and the plan.json conversion check.
* **Strict objects**: an unknown key fails, so every new field is a visible schema change and
  `schemaVersion` guards breaking ones.

## Consequences

**Positive.** One import for every consumer; the security rules of the roster are tests, not
prose; the nine sheets became 37 validated files in this pass, which is PAP-284's starting point;
editors get completion from the JSON Schema through a modeline with no workspace settings.

**Negative.** Registries must be kept current: a new scope, tool or server is a code change plus a
fixture, and `KNOWN_TOOLS.lastVerified` nags every 30 days by design. The MCP catalog and price
table are stubs until PAP-210 and PAP-98 land, so two checks are warnings that should later be
errors. Two `zod` and `yaml` versions are literal in `packages/agents/package.json` because the
root catalog does not carry them (PAP-13 follow-up to promote them).

**Neutral.** Sub budgets are written explicitly (15 USD / 80 turns) rather than inherited, since
the spec's precedence puts the parent before the roster default; `dailySharePct` is lead-only.

## Alternatives rejected

* **JSON Schema as the source, TypeScript generated from it.** Loses the transform (`xhigh` →
  `high`), refinements and the typed registries; the repo standard is Zod-first.
* **Enforcing sub ⊆ lead at runtime only (PAP-106).** Runtime enforcement stays, but a roster that
  cannot be bundled should fail at validation time, before a session is spawned.
* **Free-form `access` strings, normalised by consumers.** That is today's plan.json; every consumer
  would normalise differently. The registry is small (36 ids) and reviewable.
* **One YAML per lead with subs nested inside.** Simpler files, but subs need their own bundles,
  memory files and labels, and PAP-284 already specifies one file per character.
* **Making `defaults` required in the roster.** It would make a standalone character file
  unvalidatable and hide `BUDGET_MISSING`; optional defaults keep "never unlimited" testable.

## Re-open criteria

- **Fact.** PAP-210's catalog or PAP-98's price table ships a shape this schema cannot reference by
  id; or Claude Code changes its permission-rule grammar (`Tool(argument)`), which the tool grammar
  mirrors.
- **Budget.** The roster grows past 64 characters or a second organisation needs its own roster
  defaults, at which point `RosterSchema` needs tenancy.
- **Date.** None; `schemaVersion` bumps are the review points.

## References

- Linear issue: PAP-103; consumers PAP-104, PAP-105, PAP-106, PAP-111, PAP-113, PAP-284, PAP-466
- Doc: `docs/platform/character-schema.md`
- Source: `packages/agents/src/schema/`, fixtures `packages/agents/fixtures/`
- Plan inputs: `docs/agent-roster.md` and `docs/characters/*.md` in the plan repo; Security and
  Threat Model §4 (deny list); Interface & Data Contracts §2 row *Agent principal*
