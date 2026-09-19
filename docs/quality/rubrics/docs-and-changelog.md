<!-- GENERATED from packages/contracts/quality/src/rubrics/docs-and-changelog.json by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run `pnpm --filter @paperos/contract-quality build:docs`. -->

# Docs and changelog rubric (`RUB-DOC-*`, v1)

Applied by: `docs-and-spec`. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).

## Purpose

A third of the PRs in this build are specs, docs, prompts, ADRs and memory. Are they true, verifiable, linked and current, so an outdated rule is never mistaken for a live one? The docs-and-spec reviewer (PAP-677) embeds this rubric; PAP-209's library rubric and PAP-130's ADR template are its references.

## Scope

`specs/**`, `docs/**` (including `docs/adr/**`, `docs/changelog/**`, `docs/memory/**`, `docs/reference/surfaces.md`), `.claude/**` prose, `packages/agents/prompts/**`, READMEs, generated documentation.

## Examples by severity

- **S0**
  - A runbook step deletes production data without the deny-list warning: following the doc as written is destructive.
- **S1**
  - An ADR without Alternatives rejected or Consequences.
  - A `must` in a spec with no check named beside it.
  - A dangling link to a spec that was renamed.
- **S2**
  - Style rule violations in a prompt (model names, unlinked limits).
  - A changelog fragment that does not cite its paths.

## Checklist

Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.

| ID | Item | Test | Typical | How to verify | False positives |
|---|---|---|---|---|---|
| `RUB-DOC-01` | Every must has a check | Can I find a `must`, `never`, `always` or `required` in a spec, ADR or rule that names no test, lint, gate or review step that verifies it? | S1 | For each normative sentence in the diff, find the check named beside it or in the Test plan; unverifiable rules are downgraded to guidance or get a Linear issue. | Rules whose check is the reviewer itself, when the rubric item is cited. |
| `RUB-DOC-02` | Links resolve | Can I find a relative link, anchor, issue identifier or file path in the diff that does not exist or points at a moved file? | S1 | Run the link checker on changed files; resolve every `PAP-<n>` against Linear and every path against the tree. | Links to artefacts created by the same PR's CI run, labelled as such. |
| `RUB-DOC-03` | ADR completeness | Does a new or changed ADR lack Status, Context, Decision, Consequences or Alternatives rejected, carry a number not in the pre-assigned list, or change a decision without superseding the old ADR? | S1 | Compare against `docs/adr/template.md` (PAP-209, PAP-130); a superseded ADR gets `Status: Superseded by 00nn`. | Draft ADRs explicitly marked `Status: Proposed` with the missing section listed as open. |
| `RUB-DOC-04` | Changelog fragment and paths | Does a PR that lands user- or developer-visible change lack `docs/changelog/unreleased/PAP-<n>.md`, or does the fragment omit what landed, the paths and the ADR? | S2 | Fragment exists, 2 to 6 lines, names the paths and the ADR number when one exists; `CHANGELOG.md` itself is not edited directly. | Pure test or fixture changes. |
| `RUB-DOC-05` | Spec declares states, access, events and edge cases | Can I find a page or app spec missing its States, Access, Events, Actions or Edge cases section, or declaring a component id not in the registry? | S1 | `pnpm spec validate` output cited; each section present and non-empty or explicitly `n/a` with a reason. | Library and infrastructure specs where the schema marks the section optional. |
| `RUB-DOC-06` | Memory and knowledge provenance | Can I find a memory entry, domain rule or knowledge-base fact with no date, source and owner, or a change that overwrites an old rule instead of marking it superseded? | S2 | Entries carry `since`, `source` and `owner`; superseded rules stay with `until` and a pointer (org standard: explicit change tracking so outdated rules are never mistaken for current ones). | Scratch notes under a clearly labelled `drafts/` path. |
| `RUB-DOC-07` | Generated files not hand-edited | Does the diff edit a generated file (`roster.json`, JSON Schemas, docs tables, compat matrix, rubric docs) directly instead of its source, or ship a source change without regenerating? | S2 | Regenerate and diff (`pnpm build:schemas`, `pnpm build:docs`, drift tests); the generated header names the source. | None; point at the generator. |
| `RUB-DOC-08` | Surfaces and abilities recorded | Does the PR add or change an MCP tool, CLI command, API route or WebMCP action without recording it in `docs/reference/surfaces.md` (and the actions registry for pages)? | S2 | Diff the exported tools, routes and commands against the surfaces doc section for the issue. | Internal helpers not reachable from any surface. |

## What this rubric does not cover

- Agent prompt safety and behaviour (agent-behaviour rubric).
- Spec validator errors (Gate 1, PAP-115) beyond citing them.
- Typos and grammar below S3: praise or ignore.
