---
id: "0016"
title: "View model: one strict ViewSpec for every view kind"
status: Accepted
date: 2026-09-19
deciders: ["Quill", "Nova", "Sentinel"]
issue: PAP-161
supersedes: []
supersededBy: null
tags: ["schema", "tables", "contract"]
reviewDate: null
---

# 0016. View model: one strict ViewSpec for every view kind

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-161](https://linear.app/paperos/issue/PAP-161)
* Deciders: Quill (spec), Nova (Zod model), Sentinel (review)

## Context

Ten view kinds (grid, kanban, calendar, timeline, gantt, gallery, list, form, map, chart), a
query compiler (PAP-163), dashboards (PAP-173), saved and public views (PAP-172), the page spec's
inline views (PAP-119), PM boards (PAP-102), finance reports (PAP-183) and CRM views (PAP-189) all
need to describe "which rows, which columns, in what order, grouped and summarised how, visible to
whom". Airtable, Notion and ClickUp each answer that with a different, partly closed model. If
every PaperOS consumer wrote its own, the compiler would need ten inputs and the spec builder could
not emit a view without knowing the renderer.

Interface & Data Contracts §1 fixes Zod 4 as the schema language with generated JSON Schema, and
§2 row View fixes the outline: strict Zod `ViewSpec`, `dataset_ref jsonb` as `entity:key` or
`custom:id`, ten kinds, `visibility personal|shared|public`, `spec.filter` a `FilterTree` from
`@paperos/core/filter` (PAP-279). Module-system §2.3 makes `registerDataset()` the port other
modules call. Three providers this model consumes are in flight on 2026-09-19 with nothing on
`main` yet: `FilterTree` (PAP-279), `Money`/`EntityRef`/`Uuid` (PAP-302) and `AudienceId`
(PAP-55). The plan removed the blocking relations on purpose: this issue must land before any view
code is written, so it cannot wait for them.

The repository standards apply: UUIDv7 ids and `updated_at` on every record, no module imports
another module's implementation, nothing hover-only or drag-only in what the model describes, and
English + Spanish (`FieldDef.name`, `description` and view `name` are user data; the model carries
no UI copy).

## Decision

We will ship one strict Zod 4 schema, `viewSpecSchema`, in `packages/views/src/model/`, as a
discriminated union on `kind` whose ten members share one base and each carry a named
kind-specific `options` schema; consumers import the TypeScript types and the generated JSON
Schema, and `@paperos/contract-tables` (PAP-483) re-exports them across the module boundary.

Specifics:

* **Shape.** `ViewSpec = { id (UUIDv7), version: 3, kind, datasetRef, name, description?, fields[],
  filter?, sorts[] (max 5), groups[] (max 3, expandMulti), aggregations[], rowHeight, options,
  search?, visibility, ownerUserId, permissions { canEditRecords, canEditView }, sharing?, locked,
  formats?, colorBy? }`. Every object is `.strict()`. `filter` absent means no filter. A `public`
  view must carry `sharing`. Duplicate `fields[].fieldId` are rejected.
* **Data source.** `DatasetRef = { kind: 'entity', key } | { kind: 'custom', datasetId }`, string
  form `entity:<slug>` / `custom:<uuidv7>`. Entities register through `registerDataset({ key, table,
  fields, defaultSort, rls })` on the `DatasetRegistryPort`; custom datasets keep `FieldDef[]` in
  `field` and rows in `record.data jsonb` (max 500 fields, 100 KB per row).
* **Fields.** `FieldDef = { id, key, name, type, options, required, unique, hidden, computed,
  description?, group?, defaultValue?, permissions? }`. `FieldType` is a closed enum of 31 names:
  the 17 PAP-164 types, `longText`, `percent`, `geo`, `button`, the five PAP-616 system fields and
  the five PAP-627 value types, reserved now because adding an enum value later is a breaking
  change for consumers that switch on it. Per-type `options` are validated by the type's
  `defineFieldType()` (PAP-164), not here. Derived types require `computed: true`.
* **Versioning.** `viewSpecSchema` accepts the current `version` only. `migrateViewSpec()` applies
  an ordered step list (v1 → v2 → v3) on read, never on write; `parseViewSpec()` is migrate then
  parse. A shape change is a new step and a version bump, plus this ADR's successor.
* **Soft dependencies.** `filter` is `z.unknown()` with `FilterTree = unknown` until PAP-279 lands
  (`// TODO(PAP-279)` at the definition, `it.todo` for the strict filter test); `AudienceId`,
  `Uuid`, `IsoDateTime`, `Money` (wire) and `EntityRef` are minimal aliases in
  `src/model/shims.ts` that validate the wire form the owning spec fixes. Swapping each alias for
  the import is the owner's only follow-up.
* **JSON Schema** is generated (`pnpm --filter @paperos/views gen:schemas`) into
  `packages/views/schema/` with `$id https://paperos.dev/schema/view/3`, committed, and
  drift-tested. Refinements that JSON Schema cannot express are listed as "Zod only" in the docs.
* **Golden fixtures.** Ten specs (one per kind) over two datasets (`tasks` custom, `memberships`
  entity) under `packages/views/fixtures/`, the conformance suite's input (PAP-486).
* **Tables** `dataset`, `field`, `record`, `view` (columns in `docs/platform/view-model.md`) land
  as a second commit once PAP-33/PAP-34 provide `packages/db` and the RLS helpers; the model does
  not depend on them.

## Consequences

**Positive.** One type for every renderer, the compiler, the spec builder and the API. Kind
narrowing is free (`ViewSpecOf<'kanban'>['options'].stackByFieldId`). A saved view survives a
deleted field (`findOrphanedFieldIds` flags, the compiler skips). Strictness turns typos into
validation errors instead of silent "no filter". Every downstream issue can start from a fixture.

**Negative.** Strictness means every new key is a schema change with a version step; the round-4
reservations (`formats`, `colorBy`, `defaultValue`, `permissions`, `logic`) exist to avoid a churn
of steps while those owners land. Three aliases must be swapped when PAP-279, PAP-302 and PAP-55
merge; until then the filter is unchecked. The `FieldType` enum names types that have no runtime
yet, so the field registry must report "not wired yet" for them in dev mode.

**Neutral.** `options` schemas are per kind but the base is shared, so a kind switch keeps
fields, filter, sorts and groups and only re-validates `options` (PAP-614). JSON Schema is
generated with `io: 'input'`: it describes what may be written, with defaults optional.

## Alternatives rejected

* **One loose `options: Record<string, unknown>` for every kind.** Simpler schema, but every
  renderer would validate its own options and the spec builder could not tell a kanban from a
  chart at the type level. Rejected for the discriminated union; the one fact that would change
  it is a kind whose options cannot be known statically, and none of the ten is.
* **Copying Airtable's view JSON.** Closest to what users know, but it has no permissions,
  sharing or dataset indirection and hides kind options behind renderer state. Airtable, Notion
  and ClickUp are the equivalence column in the docs, not the model.
* **Blocking on PAP-279 for a typed `filter`.** Correct in the long run and it is where the model
  ends up; rejected now because the plan (FIX-2, 2026-09-17) removed the relation so view code can
  start on 09-28, and `unknown` plus a visible `it.todo` costs one alias swap.
* **Hand-written JSON Schema.** Would drift from the Zod schema within a week of sixteen parallel
  sessions; contracts §1 bans it.
* **`version` accepted at any value with lazy migration inside `viewSpecSchema`.** Would let a
  writer persist an old shape. Migration on read only keeps the stored shape converging.

## Re-open criteria

- **Fact.** PAP-279 merges with a `FilterTree` whose serialised form the ten fixtures do not
  parse under (they were written to its documented `{ v, op, children }` / `{ field, operator,
  value }` shape); or PAP-164 needs a type name not in `FIELD_TYPES`.
- **Budget.** A view kind needs more than 3 groups or 5 sorts to reach parity with a benchmark
  product row in `packages/views/src/parity/checklist.json` (PAP-162).
- **Date.** None; not a library adoption.

## References

- Linear issue: PAP-161; consumers PAP-163, PAP-164, PAP-207, PAP-335, PAP-338, PAP-426, PAP-483,
  PAP-613, PAP-614, PAP-615, PAP-616, PAP-734, PAP-818, PAP-839
- Docs: `docs/platform/view-model.md`; schema `packages/views/schema/view.schema.json`
- Contracts: Interface & Data Contracts §1, §2 rows View and Record, §6 row View model;
  Module System §1.1 row tables, §2.3
- Parity audit: `docs/research/views-parity-checklist.md` (PAP-162)
