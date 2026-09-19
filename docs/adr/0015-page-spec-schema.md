---
id: "0015"
title: "Page spec schema: one Zod 4 source for page.spec.yaml, JSON Schema generated"
status: Accepted
date: 2026-09-19
deciders: ["Quill", "Atlas", "Nova"]
issue: PAP-114
supersedes: []
supersededBy: null
tags: ["contract", "spec-builder", "schema"]
reviewDate: null
---

# 0015. Page spec schema: one Zod 4 source for `page.spec.yaml`, JSON Schema generated

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-114](https://linear.app/paperos/issue/PAP-114)
* Deciders: Quill (Page Spec Writer, author); Atlas (architecture) and Nova (codegen fit) review

## Context

Every PaperOS page is described before it is built. The validator (PAP-115), the section owners
(PAP-116 access, PAP-119 data, PAP-121 integrations), codegen (PAP-120, PAP-122, PAP-314..316), the
flow graph (PAP-123), the spec editor (PAP-124), the app shell's `useSpec` (PAP-16), the component
registry (PAP-74), the edge-case hunter (PAP-85) and the canvas loader (PAP-132) all read the same
file. Interface & Data Contracts §1 fixes the schema language (Zod 4; JSON Schema generated, never
hand-written) and §2 fixes the section list, `meta.id` = file name and the `status: ready` gate.
Three org standards must be encoded rather than documented: every page declares its actions (id,
intent phrase, permission) so the actions registry, WebMCP surface and voice controller read from
the spec; user-visible text is an EN/ES message key, never a literal; placeholders are marked so dev
mode can show them. Four round-4 issues (PAP-380, PAP-361, PAP-366, PAP-467) already write keys the
v1 unknown-key rule would reject. `FilterTree` (PAP-279) and the component registry (PAP-74) are in
flight in parallel; PAP-375 (spec i18n) and PAP-751 (versioning tooling) come later.

## Decision

We will define `page.spec.yaml` once, as `PageSpecSchema` in `@paperos/spec`
(`packages/spec/src/schema/page.ts`, Zod 4.6), and derive everything else from it:

* **Sections (v1).** `meta` (`id`, `title`, `route`, `surface`, `owner`, `status`, `specVersion: 1`,
  `tags`), `purpose`, `logic.actions`, `access`, `data`, `integrations`, `layout`, `components`,
  `states`, `events`, `edgeCases`. `route` and `surface` live under `meta` as the issue Spec says;
  Contracts §2 lists them beside the sections as a summary. `access`, `data` and `integrations` ship
  as **interim** shapes in their own files (`access.ts`, `data.ts`, `integrations.ts`) that PAP-116,
  PAP-119/311 and PAP-121 extend in place.
* **Actions are the registry.** `logic.actions.<id>` = `{ intent: MessageRef, permission, steps[],
  guard?, effects[], onError?, input, status }`. `pageActions(spec)` flattens them to
  `<pageId>.<actionId>` entries. Component `events`, `states.*.action`, `edgeCases[].action`,
  `access.actions` keys and action-sourced `events[].on` must resolve (`SPEC_ACTION_UNBOUND`).
* **No literal UI strings.** `MessageRef = MessageKey | { id: MessageKey, default?: string }`, where a
  key is `<specId>.<path>` (at least one dot, no spaces). A literal sentence fails with
  `SPEC_LITERAL_COPY` and a hint naming the derived key. This is stricter than the issue text
  ("plain until PAP-375"): the org standard forbids hard-coded UI strings from day one, and PAP-375's
  `{ id, default }` form is already accepted, so PAP-375 adds extraction, not a schema change.
* **Placeholders.** `status: wired | not-wired` on components and actions (default `wired`);
  `notWiredComponents(spec)` lists them; a `built` page with placeholders warns.
* **Reference grammars** are exported regexes with named `$defs`: `RouteRef` (TanStack `$param`,
  `:param` rejected), `ComponentRef` (`^(ui|app|print)\.[a-z][A-Za-z0-9]*$`, PAP-74), `MessageKey`,
  `PermissionRef` (`public` or dotted), `ActionRef`/`CamelId`, `KebabId`, `EventName` (`on<Event>`),
  `EventSource` (action id, `key.onEvent`, `page.load|leave`), `SlotName` (PAP-16's six plus
  `header`, `footer`).
* **Strictness.** Every object is strict. At the top level `x-*` keys pass through untouched; the six
  v1.1 keys (`flags`, `modules`, `comments`, `help`, `seo`, `budgets`) parse as `unknown` with
  `SPEC_RESERVED_KEY`; anything else is `SPEC_UNKNOWN_KEY` with a did-you-mean hint.
* **Gate.** `status: ready` requires `access`; `data` or `x-static: true`; three `edgeCases`;
  resolvable `events[].to` (checked against `knownRoutes` when supplied). Missing standard states
  and `built` pages with placeholders are warnings, not errors.
* **Generated artefacts.** `pnpm --filter @paperos/spec gen:schemas` writes
  `packages/spec/schema/page.spec.schema.json` (draft 2020-12, `$id`
  `https://imagine-os.github.io/paperos-template/schema/page.spec.v1.json`) and
  `docs/platform/page-spec.md` (every field, every issue code). A Vitest drift test fails the gate
  when either is stale. The first line of every spec is
  `# yaml-language-server: $schema=<relative path>/page.spec.schema.json`.
* **Parsing.** `parseSpec(yaml, { filename?, knownRoutes? })` normalises BOM and CRLF, resolves
  anchors and merge keys before validation, reports duplicate mapping keys with both lines, warns
  over 200 KB and returns `Result<PageSpec, SpecIssue[]>` where
  `SpecIssue = { code, severity, message, path, line?, col?, hint?, related? }`.
  `validatePageSpec(object)` is the same without positions.
* **Versioning.** `meta.specVersion: 1`; missing is read as 1 with a warning; anything else is
  `SPEC_UNSUPPORTED_VERSION`. `packages/spec/src/migrate/` holds the registry
  (`SPEC_VERSIONS`), the `Codemod` interface and `migrateSpec()` as an identity skeleton; tooling is
  PAP-751 (`docs/platform/page-spec-versioning.md`).
* **Dependencies.** `zod ^4.6.5` and `yaml ^2.9.1` are declared in `packages/spec/package.json` (not
  in the root catalog yet: follow-up for the root owner); `tsx` runs the generator. `FilterTree` is a
  local alias in `schema/filter.ts` mirroring PAP-279's shape with a `TODO(PAP-279)` naming the exact
  import to switch to (`import { filterTreeSchema, type FilterTree } from '@paperos/core/filter'`).

## Consequences

**Positive.** One file to change and one ADR per shape change (PAP-130). Editors get completion and
inline errors from the generated JSON Schema. Consumers import `PageSpec` and never re-declare the
shape. The actions registry, the voice vocabulary and the WebMCP surface exist the moment a page is
specified, in both languages. Placeholders are visible to dev mode by declaration.

**Negative.** Interim `access`, `data` and `integrations` shapes will change under PAP-116/119/121;
their fixtures will need updating (that is why they live in separate files). Requiring message keys
means every fixture carries `default` text or a key, which is more typing than a sentence. The local
`FilterTree` alias is a temporary duplicate until PAP-279 merges. Zod refinements are not in the JSON
Schema, so editors see fewer errors than the validator.

**Neutral.** JSON Schema formatting is Biome's, so the drift test compares structure, not bytes.
Position mapping walks the YAML AST rather than keeping a CST; anchors resolve to the anchor's
position, which is the position of the merged document.

## Alternatives rejected

* **JSON Schema as the source, Zod generated from it.** Loses TypeScript inference and refinements;
  Contracts §1 already decided the direction. Would change if a consumer outside TypeScript owned the
  schema.
* **`route` and `surface` as top-level sections.** Matches the §2 row literally but splits identity
  across two levels; the issue Spec and every consumer read `meta.route`. Would change only with a
  contract amendment.
* **Plain strings for copy until PAP-375.** Simpler fixtures, but every literal would need a codemod
  later and the org standard is explicit. Would change if the message catalog were abandoned.
* **Strict top level with no `x-*` escape.** Blocks PAP-380/361/366 today and every experiment
  tomorrow. Would change if extensions were moved to a dedicated `extensions:` map.
* **Position tracking via a separate CST walk (`yaml`'s `Parser` + `Composer`).** More precise for
  duplicate keys inside aliases, but doubles the parse work; the AST `range` is enough for every code
  we raise.
* **`fast-check` for the property test.** One more dependency for a seeded loop of 40 generated specs;
  revisit when the corpus generator (PAP-748) lands.

## Re-open criteria

- **Fact.** PAP-279 merges `@paperos/core/filter` (remove the alias); PAP-74's registry fixes a
  different `ComponentRef` grammar; PAP-375 needs a `MessageRef` shape other than `string | { id, default }`.
- **Budget.** A 300-spec validation run exceeds 2 s (PAP-115's budget) because of the AST position walk.
- **Advisory.** A Zod 4 or `yaml` 2 advisory with no patched version within 14 days.

## References

- Linear issue: PAP-114; consumers PAP-115, PAP-116, PAP-119, PAP-120, PAP-121, PAP-123, PAP-124, PAP-16, PAP-74, PAP-85, PAP-132
- Reference: `docs/platform/page-spec.md` (generated), `docs/platform/page-spec-versioning.md`
- Examples: `specs/pages/customer-invoices.spec.yaml`, `specs/pages/staff-settings.spec.yaml`
- Fixtures: `packages/spec/fixtures/valid/`, `packages/spec/fixtures/invalid/*.expected.json`
