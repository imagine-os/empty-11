<!-- GENERATED from packages/contracts/quality/src/rubrics/spec-conformance.json by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run `pnpm --filter @paperos/contract-quality build:docs`. -->

# Spec conformance rubric (`RUB-SPEC-*`, v1)

Applied by: `spec-conformance`. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).

## Purpose

Does the page or module do what its page spec, the component registry and the org rules say, with every declared state, event, action and access rule real? The spec-conformance reviewer (PAP-244) embeds this rubric and resolves specs from changed routes and the PR body.

## Scope

Pages, routes, modules and their specs under `specs/**`; `registry.json` (PAP-74), `rules.json` (PAP-76), the access adapter output (PAP-59), the actions registry and the message catalog (org standards).

## Examples by severity

- **S0**
  - The spec's Access section says `finance.write` and the page lets `viewer` role submit: access-rule violation.
- **S1**
  - The spec declares `empty`, `loading`, `error` and the page renders only `loaded`.
  - A declared `invoice.sent` event is never emitted; downstream automations stay silent.
  - The PR has no Linear issue link, so the spec cannot be resolved.
- **S2**
  - A component id in the page is not in `registry.json` but is visually identical to the registered one.
  - An action is declared in the registry with a permission looser than the spec's Access section (no runtime consequence yet).

## Checklist

Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.

| ID | Item | Test | Typical | How to verify | False positives |
|---|---|---|---|---|---|
| `RUB-SPEC-01` | Spec exists and is linked | Can I find a changed route, page or module in the diff with no page spec under `specs/**`, or a PR body with no Linear issue link that resolves to one? | S1 | Map every changed route file to its spec (PAP-244 resolution); check the PR body `Linear:` field (PAP-49); `pnpm spec validate` passes on the spec. | Pure refactors with no behaviour change, labelled as such in the PR body; library packages without pages. |
| `RUB-SPEC-02` | Components match the registry | Can I find a rendered component that is not in `registry.json`, is hand-rolled where a registered one exists, or uses a registered id with props the registry does not allow? | S2 | Diff the component ids used by the page against `registry.json` (PAP-74); hand-rolled tables, forms or menus are S1 because the org standard bans hand-rolled UI in pages. | Layout primitives (`div` wrappers with tokens only) and Storybook-only fixtures. |
| `RUB-SPEC-03` | Access rules implemented | Can I act as a role the spec's Access section excludes and still see the entry point, call the procedure or complete the flow? | S0 | Compare the spec's Access table with the PAP-59 adapter output and the `authorize()` calls; run the role switcher through every role for the page; a hidden button with a live procedure is still S0. | None for a mismatch; a stricter implementation than the spec is S2 with a spec fix suggested. |
| `RUB-SPEC-04` | All declared states rendered | Can I force each state the spec declares (empty, loading, error, offline, partial, permission-denied, not-wired-yet) and find one that is missing, generic, or identical to another? | S1 | List the spec's States section; for each, find the branch in the component and a story or test that renders it; the dev-mode 'not wired yet' toast and tooltip count as the placeholder state. | States the spec marks `n/a` for that page. |
| `RUB-SPEC-05` | Events wired end to end | Can I complete the user action and find the declared domain event never emitted, emitted with the wrong payload version, or emitted outside the outbox transaction? | S1 | Match the spec's Events section to `defineTopic()` names; find the emit inside the transaction (ADR 0013); a test asserts the event on the bus. | Events the spec lists as `later` with an issue link. |
| `RUB-SPEC-06` | Spec edge cases tested | Can I find an edge case in the spec's Edge cases section with no test, story or oracle that exercises it? | S1 | Walk the Edge cases list; each maps to a named test (`it('edge: ...')`), a Playwright scenario or a Gate 4 oracle; untested cases listed in the PR body are still S1. | Edge cases that require infrastructure not yet available, with a Linear issue link and a `todo` test. |
| `RUB-SPEC-07` | Org rules respected | Can I find a rule in `rules.json` (PAP-76) the page breaks: hover-only or drag-only interaction, target under 44 px, missing focus order, hard-coded UI string, missing responsive breakpoint, missing 'not wired yet' marker? | S1 | Run the rules linter where it exists; otherwise check each rule in the file against the diff and cite the rule id. | Rules `rules.json` marks as `advisory`; missing `rules.json` (skip and record `n/a`). |
| `RUB-SPEC-08` | Actions registry declared | Can I find an interactive control, command or route action on the page that is missing from the actions registry (id, intent phrase, permission), or a registry entry whose permission differs from the Access section? | S1 | Compare the page's registry export with its rendered controls and the spec; the registry is the WebMCP and voice vocabulary, so a missing action is an S1 accessibility gap for remote and voice users. | Purely presentational elements; controls inside a registered component that declares its own actions. |
| `RUB-SPEC-09` | Message catalog and language toggle | Can I switch the UI to Spanish and find a hard-coded English string, a concatenated sentence, a date or number formatted without the locale, or a missing catalog key? | S1 | Every user-visible string goes through the catalog (PAP-27); keys exist in `en` and at least a placeholder in `es`; pseudo-locale run (PAP-688) where available. Missing Spanish translations are S3 (Spanish fill is a pass, never a blocker). | Developer-only strings in dev mode panels and logs. |
| `RUB-SPEC-10` | Module boundary and manifest | Can I find an import of another module's implementation package, table, component or env var, a dependency not declared in `module.ts`, or a contract shape change without a version bump and ADR? | S1 | Dependency lint R7 to R11 (PAP-439) output; manifest `requires` versus actual imports; contract version and changelog on any shape change (ADR 0014, PAP-130). | Imports of `@paperos/core/*` and contract packages. |

## What this rubric does not cover

- Whether the code is correct when it matches the spec (correctness rubric).
- Whether the spec itself is well written (docs-and-changelog rubric).
- Pixel-level rendering (visual rubric) and assistive technology (accessibility rubric).
