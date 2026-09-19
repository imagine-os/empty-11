# Views parity checklist: Airtable, Notion, ClickUp, Baserow, NocoDB

**Issue:** [PAP-162](https://linear.app/paperos/issue/PAP-162) - Research, Table & Views Engine.
**Audited:** 2026-09-19. Every row cites a public vendor document or a vendor source file with the access date.
**Machine-readable source of truth:** `packages/views/src/parity/checklist.json`.
**Generated artefacts:** `docs/research/views-parity-checklist.csv` (396 rows), `docs/research/views-parity-formula-functions.csv` (129 functions).

This is the coverage tracker the Table & Views Engine reports from. It answers one question per row:
*does the product ship this, and which PaperOS issue owns it?* It feeds the equivalence column of the
view model (PAP-161), the function inventory of the formula engine (PAP-171) and the trigger and action
lists of table automations (PAP-174). It cross-links, and does not duplicate, PAP-213 and PAP-214.

## How to run it

```sh
node packages/views/src/parity/parity-report.mjs            # validate + coverage (exit 1 on any error)
node packages/views/src/parity/parity-report.mjs --emit     # also regenerate both CSVs
node packages/views/src/parity/parity-report.mjs --selftest # rejection fixtures + coverage maths
```

The validator rejects an unknown product cell, an unknown status, a row with no source, a duplicate id,
a `paperos_issue` that is neither `gap` nor a known Linear identifier (checked against
`packages/views/src/parity/linear-ids.json`, 983 identifiers snapshotted from team PAP), a checklist
outside the 250-400 row band, fewer than 25 categories, fewer than 80 formula functions, and any
`tables` issue that no row references. Wire it into Gate 1 (PAP-78) as a docs check.

## Reading a cell

| Cell | Meaning |
|---|---|
| `yes` | Ships on the product's free or entry tier. |
| `paid` | Ships only on a paid tier, add-on or self-hosted premium bundle. Never recorded as `yes`. |
| `partial` | Ships in a narrower form than the row describes; the note says how. |
| `no` | Does not ship. |

Priorities: **P0** the Grid with sort, filter, group milestone; **P1** All view types and View sharing,
formulas, dashboards; **P2** v0.2 or declined. `paperos_status` is `planned`, `in_progress`, `done` or
`wontdo`; `wontdo` rows carry `gap` as their issue and are listed under Declined below.

## Coverage today

```
PaperOS views parity — 396 rows, 37 categories, 129 formula functions

Coverage per product (share of checklist rows the product ships)
product     yes    paid   partial no     ships%
airtable    227    41     23      105    73.5%
notion      237    3      28      128    67.7%
clickup     245    6      40      105    73.5%
baserow     213    38     47      98     75.3%
nocodb      217    0      76      103    74.0%

Coverage per category (rows / owned by a PAP issue / gap / wontdo)
accessibility-i18n               6  owned   6 (100.0%)  gap 0  wontdo 0
aggregations                    12  owned  12 (100.0%)  gap 0  wontdo 0
api-surfaces                    10  owned  10 (100.0%)  gap 0  wontdo 0
automations                     17  owned  17 (100.0%)  gap 0  wontdo 0
bulk-edit                        8  owned   8 (100.0%)  gap 0  wontdo 0
calendar-timeline-gantt         13  owned  13 (100.0%)  gap 0  wontdo 0
charts-dashboards               12  owned  12 (100.0%)  gap 0  wontdo 0
collaboration                    8  owned   7 (87.5%)  gap 1  wontdo 1
column-ops                      10  owned  10 (100.0%)  gap 0  wontdo 0
density-appearance               8  owned   8 (100.0%)  gap 0  wontdo 0
field-options                   12  owned  12 (100.0%)  gap 0  wontdo 0
field-types                     38  owned  35 (92.1%)  gap 3  wontdo 3
filter-structure                11  owned  11 (100.0%)  gap 0  wontdo 0
filters-choice-relation-user    13  owned  13 (100.0%)  gap 0  wontdo 0
filters-date                    14  owned  14 (100.0%)  gap 0  wontdo 0
filters-number                   8  owned   7 (87.5%)  gap 1  wontdo 1
filters-text                    11  owned  10 (90.9%)  gap 1  wontdo 1
forms                           11  owned  11 (100.0%)  gap 0  wontdo 0
formulas                        11  owned  11 (100.0%)  gap 0  wontdo 0
gallery-list                     6  owned   6 (100.0%)  gap 0  wontdo 0
grouping                         8  owned   8 (100.0%)  gap 0  wontdo 0
import-export                   10  owned  10 (100.0%)  gap 0  wontdo 0
inline-edit                      9  owned   9 (100.0%)  gap 0  wontdo 0
kanban                           9  owned   9 (100.0%)  gap 0  wontdo 0
keyboard                        10  owned  10 (100.0%)  gap 0  wontdo 0
lookups-rollups                 10  owned  10 (100.0%)  gap 0  wontdo 0
map                              6  owned   6 (100.0%)  gap 0  wontdo 0
mobile-offline                   6  owned   5 (83.3%)  gap 1  wontdo 1
performance-limits              10  owned  10 (100.0%)  gap 0  wontdo 0
permissions                     10  owned  10 (100.0%)  gap 0  wontdo 0
record-expansion                 8  owned   8 (100.0%)  gap 0  wontdo 0
record-history-trash             8  owned   8 (100.0%)  gap 0  wontdo 0
schema-editing                   8  owned   8 (100.0%)  gap 0  wontdo 0
search                           5  owned   5 (100.0%)  gap 0  wontdo 0
sharing                         13  owned  13 (100.0%)  gap 0  wontdo 0
sorting                          6  owned   6 (100.0%)  gap 0  wontdo 0
view-types                      21  owned  20 (95.2%)  gap 1  wontdo 1

PaperOS status: planned 387, in_progress 1, done 0, wontdo 8
Priority: P0 205, P1 169, P2 22
Rows owned by a PAP issue: 388/396 (98.0%); open gaps listed: 15
```

### Per product

| Product | yes | paid | partial | no | ships (yes+paid+partial) |
|---|---|---|---|---|---|
| Airtable | 227 | 41 | 23 | 105 | 73.5% |
| Notion | 237 | 3 | 28 | 128 | 67.7% |
| ClickUp | 245 | 6 | 40 | 105 | 73.5% |
| Baserow | 213 | 38 | 47 | 98 | 75.3% |
| NocoDB | 217 | 0 | 76 | 103 | 74.0% |

### Per category

| Category | Rows | P0 | P1 | P2 | What it covers |
|---|---|---|---|---|---|
| `view-types` | 21 | 17 | 0 | 4 | Which view kinds each product ships |
| `field-types` | 38 | 34 | 0 | 4 | Field / property / custom-field types |
| `field-options` | 12 | 11 | 0 | 1 | Per-field configuration beyond the type |
| `filters-text` | 11 | 10 | 0 | 1 | Filter operators for text-like fields |
| `filters-number` | 8 | 7 | 0 | 1 | Filter operators for numeric fields |
| `filters-date` | 14 | 14 | 0 | 0 | Filter operators for date and time fields |
| `filters-choice-relation-user` | 13 | 13 | 0 | 0 | Filter operators for select, relation, user and attachment fields |
| `filter-structure` | 11 | 11 | 0 | 0 | Filter tree shape, dynamic values and viewer filters |
| `sorting` | 6 | 6 | 0 | 0 | Sort configuration |
| `grouping` | 8 | 8 | 0 | 0 | Grouping and sub-grouping |
| `aggregations` | 12 | 12 | 0 | 0 | Summary / rollup functions in the view footer |
| `density-appearance` | 8 | 0 | 8 | 0 | Row height, colour and visual density |
| `column-ops` | 10 | 10 | 0 | 0 | Column-level operations in tabular views |
| `record-expansion` | 8 | 8 | 0 | 0 | Expanded record / record detail surface |
| `inline-edit` | 9 | 8 | 0 | 1 | Editing inside the grid |
| `bulk-edit` | 8 | 0 | 7 | 1 | Multi-record operations |
| `keyboard` | 10 | 10 | 0 | 0 | Keyboard, pointer, touch and pen input |
| `kanban` | 9 | 0 | 9 | 0 | Board / kanban view features |
| `calendar-timeline-gantt` | 13 | 0 | 13 | 0 | Time-based views |
| `gallery-list` | 6 | 0 | 6 | 0 | Card and list views |
| `forms` | 11 | 0 | 11 | 0 | Form view and public submission |
| `map` | 6 | 0 | 5 | 1 | Map view |
| `charts-dashboards` | 12 | 0 | 11 | 1 | Charts, dashboards and interfaces |
| `formulas` | 11 | 0 | 11 | 0 | Formula engine behaviour (function inventory is a separate CSV) |
| `lookups-rollups` | 10 | 0 | 8 | 2 | Relations, lookups, rollups and counts |
| `sharing` | 13 | 0 | 12 | 1 | Saved views, public links and embeds |
| `permissions` | 10 | 8 | 0 | 2 | Who may see and change what |
| `import-export` | 10 | 0 | 10 | 0 | Getting data in and out |
| `api-surfaces` | 10 | 0 | 10 | 0 | API, SDK, CLI, MCP and agent surfaces |
| `automations` | 17 | 0 | 17 | 0 | Triggers, actions and run logs |
| `record-history-trash` | 8 | 0 | 8 | 0 | History, undo, trash and restore |
| `schema-editing` | 8 | 8 | 0 | 0 | Creating and changing tables and fields in-app |
| `collaboration` | 8 | 0 | 7 | 1 | Comments, mentions, presence and multiplayer |
| `search` | 5 | 0 | 5 | 0 | Finding records and values |
| `mobile-offline` | 6 | 0 | 5 | 1 | Small screens, offline and sync |
| `accessibility-i18n` | 6 | 0 | 6 | 0 | Accessibility, localisation and large-screen legibility |
| `performance-limits` | 10 | 10 | 0 | 0 | Scale limits and performance budgets |

## Checklist by view kind

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Grid / table view | yes | yes | yes | yes | yes | P0 | PAP-341 | Airtable grid, Notion table, ClickUp Table, Baserow GridViewType, NocoDB GRID=3. |
| List view (dense rows, phone-first) | yes | yes | yes | no | yes | P0 | PAP-619 | ClickUp List is its default task view; NocoDB LIST=7. |
| Kanban / board view | yes | yes | yes | paid | yes | P0 | PAP-167 | Baserow KanbanViewType lives in baserow_premium. |
| Calendar view | yes | yes | yes | paid | yes | P0 | PAP-344 | Baserow CalendarViewType is premium; NocoDB CALENDAR=6. |
| Timeline view | yes | yes | yes | paid | yes | P0 | PAP-345 | Airtable timeline is a paid-plan view; Baserow TimelineViewType is premium. |
| Gantt view with dependencies | yes | no | yes | partial | yes | P0 | PAP-346 | Baserow timeline covers bars but not dependency arrows; NocoDB GANTT=9. |
| Gallery / card view | yes | yes | no | yes | yes | P0 | PAP-619 | ClickUp has no gallery; cards live on Board. |
| Form view | yes | yes | yes | yes | yes | P0 | PAP-620 | Baserow FormViewType; NocoDB FORM=1. |
| Map view | paid | no | yes | no | yes | P0 | PAP-622 | Airtable map is an extension on paid plans; NocoDB MAP=5. |
| Chart view | paid | yes | no | paid | no | P0 | PAP-621 | Notion ships a Chart layout; Airtable charts are extensions / interfaces. |
| Dashboard page composing many blocks | paid | partial | yes | paid | no | P0 | PAP-173 | Airtable Interface Designer; ClickUp Dashboards; Notion needs a page of linked views. Umbrella owns the feature; children own the slices. |
| Workload / capacity view | no | no | yes | no | no | P2 | PAP-634 | ClickUp Workload visualises team bandwidth. |
| Activity view (cross-record feed) | no | no | yes | no | no | P0 | PAP-333 | ClickUp Activity; PaperOS ships per-record timelines first. |
| Pivot / summary table | paid | no | no | no | no | P2 | PAP-635 | Airtable pivot is an extension; deferred to v0.2. |
| Mind map view | no | no | yes | no | no | P2 | `gap` | Declined for v0.1: ClickUp Mind Map has no data-table analogue in PaperOS. |
| Whiteboard view | no | no | yes | no | no | P0 | PAP-132 | ClickUp Whiteboards; owned by the canvas project, not the views engine. |
| Embed view (iframe of an external tool) | no | yes | yes | no | no | P0 | PAP-386 | ClickUp Embed; lands as a dashboard block kind behind an origin allowlist. |
| Hierarchy / tree rows inside a table view | no | partial | yes | no | no | P2 | PAP-633 | ClickUp subtasks in List; Notion sub-items. Deferred to v0.2. |
| One dataset, many saved views of different kinds | yes | yes | yes | yes | yes | P0 | PAP-623 | Airtable: a table can have multiple views and multiple view types. |
| Pluggable renderer registry for new view kinds | no | no | no | partial | partial | P0 | PAP-614 | Baserow and NocoDB register view types in code; no product exposes it to tenants. |
| Unsupported/unknown view kind survives a round trip | no | no | no | no | no | P0 | PAP-993 | PaperOS-only: persist unknown kinds with an upgrade hook. |

## Checklist by field type

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Single line text | yes | yes | yes | yes | yes | P0 | PAP-164 | Airtable Single line text, Baserow text, NocoDB SingleLineText. Umbrella owns the feature; children own the slices. |
| Long text / multi-line | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow long_text; NocoDB LongText. |
| Rich text (formatted body) | partial | yes | partial | partial | yes | P0 | PAP-627 | Airtable long text has rich-text toggle; NocoDB has Rich text. |
| Number | yes | yes | yes | yes | yes | P0 | PAP-338 | NocoDB splits Number and Decimal. |
| Currency | yes | partial | yes | partial | yes | P0 | PAP-995 | Notion formats a number as currency; Baserow via number options. Money type owns exponent. |
| Percent | yes | partial | no | partial | yes | P0 | PAP-338 | NocoDB Percent UIType. |
| Checkbox / boolean | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow boolean; NocoDB Checkbox. |
| Rating | yes | no | no | yes | yes | P0 | PAP-338 | Baserow RatingFieldType; NocoDB Rating. |
| URL | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow url; NocoDB URL. |
| Email | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow EmailField; NocoDB Email. |
| Phone number | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow PhoneNumberField; NocoDB PhoneNumber. |
| Date (no time) | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow date; NocoDB Date. |
| Date and time with timezone | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow date field carries timezone options; NocoDB DateTime. |
| Time of day (no date) | no | no | no | no | yes | P0 | PAP-627 | NocoDB Time UIType; Airtable folds it into date formatting. |
| Duration | yes | no | no | yes | yes | P0 | PAP-627 | Airtable Duration; Baserow DurationFieldType; NocoDB Duration. |
| Single select | yes | yes | yes | yes | yes | P0 | PAP-339 | Baserow SingleSelectField; NocoDB SingleSelect. |
| Multiple select | yes | yes | yes | yes | yes | P0 | PAP-339 | ClickUp labels; Baserow MultipleSelectField. |
| Status field with todo/doing/done groups | no | yes | yes | no | no | P0 | PAP-339 | Notion Status property; select options gain a group in PaperOS. |
| User / collaborator (single and multiple) | yes | yes | yes | yes | yes | P0 | PAP-339 | Airtable User; Baserow MultipleCollaboratorsField; NocoDB User and Collaborator. |
| Attachment / file | yes | yes | yes | yes | yes | P0 | PAP-339 | Notion File; Baserow FileField; NocoDB Attachment. |
| Link to another record (relation) | yes | yes | yes | yes | yes | P0 | PAP-340 | Baserow LinkRowField; NocoDB Links and LinkToAnotherRecord. |
| Lookup of a linked record's field | yes | yes | no | yes | yes | P0 | PAP-340 | Baserow LookupField; NocoDB Lookup. |
| Rollup (aggregate over linked records) | yes | yes | no | yes | yes | P0 | PAP-340 | Baserow RollupField; NocoDB Rollup. |
| Formula | yes | yes | yes | yes | yes | P0 | PAP-382 | Baserow FormulaField; NocoDB Formula. |
| Autonumber | yes | partial | no | yes | yes | P0 | PAP-616 | Notion ID property; Baserow AutonumberField; NocoDB AutoNumber. |
| Created time | yes | yes | yes | yes | yes | P0 | PAP-616 | Baserow created_on; NocoDB CreatedTime. |
| Last modified time | yes | yes | yes | yes | yes | P0 | PAP-616 | Baserow last_modified; NocoDB LastModifiedTime. |
| Created by | yes | yes | yes | yes | yes | P0 | PAP-616 | Baserow created_by; NocoDB CreatedBy. |
| Last modified by | yes | yes | no | yes | yes | P0 | PAP-616 | Baserow last_modified_by; NocoDB LastModifiedBy. |
| Button field triggering an action | yes | yes | no | yes | yes | P0 | PAP-389 | Notion Button property; Baserow ButtonField; NocoDB Button. |
| Barcode field | yes | no | no | no | yes | P2 | `gap` | Declined for v0.1: Airtable Barcode and NocoDB Barcode; no PaperOS demand yet. |
| QR code field | no | no | no | no | yes | P2 | `gap` | Declined for v0.1: NocoDB QrCode only. |
| Geo / location point | no | yes | yes | no | yes | P0 | PAP-622 | Notion Place; ClickUp location; NocoDB GeoData and Geometry. |
| JSON field | no | no | no | no | yes | P0 | PAP-627 | NocoDB JSON UIType. |
| Progress / percent-complete field | no | no | yes | no | no | P0 | PAP-627 | ClickUp automatic_progress and manual_progress. |
| UUID field | no | no | no | yes | yes | P0 | PAP-616 | Baserow UUIDField; NocoDB UUID. |
| Password field | no | no | no | yes | no | P2 | `gap` | Declined for v0.1: Baserow PasswordField; credentials do not belong in a dataset. |
| AI / agent-computed field | paid | paid | paid | paid | no | P2 | PAP-637 | Baserow premium AI field; Notion AI autofill. Deferred to v0.2. |

## Field configuration beyond the type

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Field description / help text | yes | yes | yes | yes | yes | P0 | PAP-161 | FieldDef.description reserved in the view model. |
| Required field | no | no | yes | partial | yes | P0 | PAP-338 | Baserow field value constraints; NocoDB not-null. |
| Unique constraint | no | yes | no | yes | yes | P0 | PAP-338 | Baserow field value constraints include uniqueness. |
| Min / max / pattern validation | no | no | no | partial | partial | P0 | PAP-338 | Round-4 amendment adds per-type validation options. |
| Default value (static) | no | yes | yes | yes | yes | P0 | PAP-628 | Notion property defaults in templates. |
| Default value (dynamic token, e.g. today) | no | yes | partial | no | no | P0 | PAP-628 | PaperOS uses dynamic tokens shared with the filter grammar. |
| Select option colours | yes | yes | yes | yes | yes | P0 | PAP-339 | Drives row colouring and kanban column colour. |
| Number formatting (precision, separators, suffix) | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow number options. |
| Date format and timezone per field | yes | yes | yes | yes | yes | P0 | PAP-338 | Baserow documents working with timezones per field. |
| Field grouping in the record panel | no | no | partial | no | no | P0 | PAP-161 | FieldDef.group reserved; ClickUp groups custom fields on the task panel. |
| Field indexes for large tables | no | no | no | yes | yes | P0 | PAP-337 | Baserow field indexes doc. |
| Per-field read/write permission | no | no | partial | paid | no | P2 | PAP-638 | Baserow enterprise field-level roles. Deferred to v0.2. |

## Filters

Filter operators are split by the type they apply to, because the view model contributes operators
per field type through the PAP-279 grammar rather than one flat list.

### Text

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| is / equal | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow equal. |
| is not / not equal | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow not_equal. |
| contains | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow contains. |
| does not contain | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow contains_not. |
| contains word (whole word match) | no | no | no | yes | no | P0 | PAP-335 | Baserow contains_word / doesnt_contain_word. |
| starts with | no | yes | yes | yes | yes | P0 | PAP-335 | Baserow starts_with. |
| ends with | no | yes | yes | yes | yes | P0 | PAP-335 | Baserow ships ends_with alongside starts_with in the same registry. |
| length is lower than | no | no | no | yes | no | P0 | PAP-335 | Baserow length_is_lower_than. |
| is empty | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow empty. |
| is not empty | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow not_empty. |
| regular expression match | no | no | no | no | no | P2 | `gap` | Declined for v0.1: reachable through a formula field plus a boolean filter. |

### Number

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| equals | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow equal on number fields. |
| not equals | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow not_equal. |
| greater than | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow higher_than. |
| greater than or equal | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow higher_than_or_equal. |
| less than | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow lower_than. |
| less than or equal | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow lower_than_or_equal. |
| is even and whole | no | no | no | yes | no | P2 | `gap` | Declined for v0.1: Baserow is_even_and_whole is a novelty operator. |
| between (inclusive range) | no | no | no | partial | partial | P0 | PAP-335 | Expressed as two conditions in most products; PaperOS ships one operator. |

### Date and time

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| is on date | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_is / date_equal. |
| is before | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_is_before. |
| is on or before | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_is_on_or_before. |
| is after | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_is_after. |
| is on or after | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_is_on_or_after. |
| is within (range) | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_is_within. |
| is today | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_equals_today. |
| is before today / after today | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_before_today and date_after_today. |
| this week / month / year | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_equals_week / _month / _year. |
| in the next N days/weeks/months | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_within_days / _weeks / _months. |
| N days/months/years ago | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow date_equals_days_ago / _months_ago / _years_ago. |
| day of month equals | no | no | no | yes | no | P0 | PAP-335 | Baserow date_equals_day_of_month. |
| relative date anchored to another field | no | yes | partial | no | no | P0 | PAP-617 | Notion allows comparing a date against a formula; PaperOS uses dynamic values. |
| timezone-aware evaluation of relative dates | yes | yes | yes | yes | partial | P0 | PAP-335 | Baserow stores a timezone on date filters. |

### Choice, relation, user and attachment

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| single select is / is not | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow single_select_equal / single_select_not_equal. |
| single select is any of / none of | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow single_select_is_any_of / is_none_of. |
| multi select has / has not | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow multiple_select_has / has_not. |
| multi select has all of | yes | yes | partial | partial | partial | P0 | PAP-335 | Airtable 'has all of'. |
| relation has linked record | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow link_row_has / link_row_has_not. |
| relation contains text of linked primary | no | no | no | yes | partial | P0 | PAP-335 | Baserow link_row_contains / link_row_not_contains. |
| user is / is not | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow user_is / user_is_not. |
| collaborator field has / has not | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow multiple_collaborators_has / has_not. |
| checkbox is true / false | yes | yes | yes | yes | yes | P0 | PAP-335 | Baserow boolean. |
| attachment filename contains | yes | no | no | yes | no | P0 | PAP-335 | Baserow filename_contains. |
| attachment has file type (image/document) | yes | no | no | yes | no | P0 | PAP-335 | Baserow has_file_type. |
| attachment count lower than | no | no | no | yes | no | P0 | PAP-335 | Baserow files_lower_than. |
| filter on a lookup or rollup value | yes | yes | no | yes | yes | P0 | PAP-340 | Round-4 amendment: filter linked records before projection. |

### Filter tree shape

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Multiple conditions with AND | yes | yes | yes | yes | yes | P0 | PAP-279 | Universal. |
| Multiple conditions with OR | yes | yes | yes | yes | yes | P0 | PAP-166 | Universal. Umbrella owns the feature; children own the slices. |
| Nested condition groups | yes | yes | yes | yes | yes | P0 | PAP-617 | Notion advanced filters nest up to three layers; Baserow advanced row filter. |
| Nesting depth limit stated | no | yes | no | no | no | P0 | PAP-279 | Notion states three layers; PaperOS caps at depth 6 and rejects deeper trees. |
| Dynamic value: current user | yes | yes | yes | yes | partial | P0 | PAP-617 | Baserow user_is accepts the acting user. |
| Dynamic value: another field in the same record | no | yes | no | partial | no | P0 | PAP-617 | Notion compares two properties in advanced filters. |
| Quick filter chips above the view | no | no | yes | no | no | P0 | PAP-617 | ClickUp filter bar; PaperOS ships chips plus the sentence renderer. |
| Plain-language rendering of the filter | no | no | no | no | no | P0 | PAP-617 | PaperOS-only: the sentence renderer feeds the voice vocabulary. |
| Viewer-only temporary filters (not saved) | yes | yes | yes | yes | partial | P0 | PAP-618 | Airtable personal filters; PaperOS holds them in the URL. |
| Filter reusable by automations and segments | partial | no | partial | no | no | P0 | PAP-617 | One FilterTree shared by views, automations and audiences. |
| Filter referencing a deleted field degrades safely | no | no | no | no | no | P0 | PAP-161 | PaperOS flags the condition orphaned and skips it at compile. |

## Sorting

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Sort ascending / descending | yes | yes | yes | yes | yes | P0 | PAP-618 | Universal. |
| Multi-level sort with explicit order | yes | yes | yes | yes | yes | P0 | PAP-618 | Notion supports multiple sorts with customisable order. |
| Type-aware sort (text alphabetical, select custom order) | yes | yes | yes | yes | yes | P0 | PAP-335 | Notion documents per-type sort logic. |
| Manual drag ordering (fractional index) | yes | yes | yes | yes | yes | P0 | PAP-341 | NocoDB Order system column. |
| Sort by a lookup or rollup | yes | yes | no | yes | yes | P0 | PAP-336 | Requires the computed value in SQL. |
| Stable pagination under a sort (keyset cursor) | no | no | no | partial | partial | P0 | PAP-163 | Products use offset paging; PaperOS signs keyset cursors. Umbrella owns the feature; children own the slices. |

## Grouping

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Group rows by a field | yes | yes | yes | yes | yes | P0 | PAP-343 | Baserow group rows by field; NocoDB toolbar Groups. |
| Second and third grouping level | yes | yes | yes | yes | yes | P0 | PAP-343 | Notion sub-group is one extra level; PaperOS allows three. |
| Collapse and expand groups | yes | yes | yes | yes | yes | P0 | PAP-343 | Notion hide/show groups. |
| Hide empty groups | yes | yes | yes | yes | partial | P0 | PAP-343 | Notion documents hiding empty groups. |
| Manual or automatic ordering of groups | yes | yes | yes | yes | partial | P0 | PAP-343 | Notion allows manual or automatic group sorting. |
| Per-group aggregate row | yes | yes | yes | yes | yes | P0 | PAP-336 | Group footers in every grid product. |
| Group by multi-select with one row per value | no | no | no | no | no | P0 | PAP-336 | PaperOS expandMulti option; products group by the whole set. |
| Group by a date rollup (day/week/month) | yes | yes | yes | partial | partial | P0 | PAP-336 | Needed by charts; compiled as a date_trunc group key. |

## Aggregations

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Count of records | yes | yes | yes | yes | yes | P0 | PAP-336 | Baserow field summaries. |
| Count empty / filled | yes | yes | yes | yes | yes | P0 | PAP-336 | Baserow field summaries include empty and filled counts. |
| Count unique | yes | yes | partial | yes | partial | P0 | PAP-336 | Baserow unique count summary. |
| Sum | yes | yes | yes | yes | yes | P0 | PAP-336 | Numeric footer aggregate. |
| Average | yes | yes | yes | yes | yes | P0 | PAP-336 | Numeric footer aggregate. |
| Min / Max | yes | yes | yes | yes | yes | P0 | PAP-336 | Numeric and date footer aggregate. |
| Median | yes | yes | no | yes | partial | P0 | PAP-336 | Airtable and Baserow summaries. |
| Standard deviation / variance | yes | no | no | yes | no | P0 | PAP-336 | Airtable summary bar. |
| Range (max minus min) | yes | no | no | yes | no | P0 | PAP-336 | Airtable range summary. |
| Earliest / latest date | yes | yes | yes | yes | yes | P0 | PAP-336 | Date aggregates for timeline headers. |
| Checked / unchecked percentage | yes | yes | yes | yes | partial | P0 | PAP-336 | Checkbox aggregates. |
| Custom aggregate registered by a module | no | no | no | partial | no | P0 | PAP-631 | PaperOS extension guide documents registering an aggregate. |

## Density and appearance

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Row height presets | yes | yes | no | yes | yes | P1 | PAP-341 | NocoDB toolbar Row Height; Baserow enlarge rows. |
| Field (column) width persisted per view | yes | yes | yes | yes | yes | P1 | PAP-343 | NocoDB toolbar Field width. |
| Row colouring by a rule | paid | no | yes | paid | yes | P1 | PAP-626 | Baserow row coloring is premium; NocoDB Row Colors in the toolbar. |
| Conditional cell formatting | paid | no | yes | paid | partial | P1 | PAP-626 | Airtable colouring on interfaces; ClickUp has cell colouring. |
| Progress bar rendering inside a cell | no | no | yes | no | partial | P1 | PAP-626 | ClickUp progress fields render as bars. |
| Cover image on cards | yes | yes | no | yes | yes | P1 | PAP-619 | Gallery and kanban card covers. |
| Density mode shared with the design system | no | no | no | no | no | P1 | PAP-66 | PaperOS density tokens serve phone to 4K TV. |
| 10-foot legible large-screen mode | no | no | no | no | no | P1 | PAP-66 | PaperOS-only requirement (org standard). |

## Column operations

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Show / hide fields per view | yes | yes | yes | yes | yes | P0 | PAP-618 | NocoDB toolbar Field visibility. |
| Reorder fields per view | yes | yes | yes | yes | yes | P0 | PAP-343 | NocoDB toolbar Field order. |
| Resize columns | yes | yes | yes | yes | yes | P0 | PAP-343 | NocoDB toolbar Field width. |
| Freeze / pin leading columns | yes | no | yes | yes | yes | P0 | PAP-343 | Grid frozen region with a scroll shadow. |
| Insert a field left / right of a column | yes | yes | yes | yes | yes | P0 | PAP-332 | Header context menu. |
| Duplicate a field with or without data | yes | yes | no | yes | yes | P0 | PAP-332 | Airtable duplicates values optionally. |
| Delete a field (soft, restorable) | yes | yes | yes | yes | partial | P0 | PAP-334 | Baserow delete and recover data. |
| Change a field's type in place | yes | yes | partial | yes | yes | P0 | PAP-340 | With the lossiness report in PaperOS. |
| Column header tooltip from the field description | yes | yes | yes | yes | partial | P0 | PAP-161 | FieldDef.description renders as a tooltip. |
| Context menu reachable from the keyboard | partial | partial | partial | partial | partial | P0 | PAP-150 | PaperOS routes context menus through the command registry. |

## Record expansion

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Expand a record into a modal | yes | yes | yes | yes | yes | P0 | PAP-333 | Baserow enlarge rows. |
| Side panel instead of a modal | no | yes | yes | no | yes | P0 | PAP-343 | RecordPanel in PaperOS. |
| Comments thread on the record | yes | yes | yes | yes | yes | P0 | PAP-131 | Baserow comments and mentions. |
| Activity timeline on the record | yes | yes | yes | yes | yes | P0 | PAP-333 | Baserow row change history. |
| Attachments tab with previews | yes | yes | yes | yes | yes | P0 | PAP-333 | Lightbox preview from the design system. |
| Linked records section with inline create | yes | yes | yes | yes | yes | P0 | PAP-340 | Round-4 amendment: allowCreate on the relation picker. |
| Field history per field with undo | yes | yes | partial | yes | partial | P0 | PAP-333 | Baserow row change history; PaperOS adds per-field undo. |
| Record template applied on create | no | yes | yes | no | no | P0 | PAP-628 | Notion and ClickUp templates; deferred to a PaperOS P2. |

## Inline editing

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Per-type cell editor (date picker, select menu, user picker) | yes | yes | yes | yes | yes | P0 | PAP-339 | Editor registry per field type. |
| Optimistic commit with rollback on error | partial | partial | partial | partial | partial | P0 | PAP-342 | PaperOS states the contract explicitly. |
| Copy / paste a TSV range | yes | yes | yes | yes | yes | P0 | PAP-342 | Baserow paste data into cells. |
| Fill handle (drag to fill down/across) | yes | no | no | yes | yes | P0 | PAP-630 | Airtable fill handle with series detection. |
| Undo / redo of edits | yes | yes | yes | yes | yes | P0 | PAP-342 | Registered in the shared undo manager. |
| Validation error shown in the cell | partial | partial | partial | yes | yes | P0 | PAP-338 | Baserow field value constraints surface inline. |
| Read-only cells for computed fields | yes | yes | yes | yes | yes | P0 | PAP-340 | NocoDB marks virtual columns read-only. |
| Edits blocked by permission show why | partial | partial | partial | yes | partial | P2 | PAP-638 | PaperOS surfaces the can() reason. |
| Unwired control shows a 'not wired yet' hint | no | no | no | no | no | P0 | PAP-614 | PaperOS org standard: tooltip plus toast, always visible in dev mode. |

## Bulk operations

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Select a range of rows | yes | yes | yes | yes | yes | P1 | PAP-341 | Shift-click and drag selection. |
| Select all matching the current filter | yes | yes | yes | yes | yes | P1 | PAP-334 | Select-all across pages. |
| Bulk edit one field across the selection | no | yes | yes | partial | yes | P1 | PAP-334 | Notion and ClickUp bulk edit; Airtable needs paste. |
| Bulk delete | yes | yes | yes | yes | yes | P1 | PAP-334 | Server batching in PaperOS. |
| Bulk move to another table / list | no | yes | yes | no | no | P1 | PAP-334 | ClickUp moves tasks between lists. |
| Undo toast after a bulk operation | partial | yes | yes | partial | partial | P1 | PAP-334 | PaperOS shows an undo toast with a restore link. |
| Bulk operations recorded as one audit entry | no | no | no | yes | no | P1 | PAP-38 | Baserow audit logs; PaperOS records a reason per batch. |
| Find duplicate records and merge them | paid | no | no | no | no | P2 | PAP-632 | Airtable Dedupe extension; deferred to v0.2 in PaperOS. |

## Keyboard, pointer, touch, pen, remote and voice

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Arrow-key cell navigation | yes | yes | yes | yes | yes | P0 | PAP-341 | Grid keyboard model. |
| Enter to edit, Escape to cancel | yes | yes | yes | yes | yes | P0 | PAP-341 | Grid keyboard model. |
| Shift-arrow range extension | yes | yes | yes | yes | yes | P0 | PAP-341 | Selection model. |
| Command palette for view actions | yes | yes | yes | no | partial | P0 | PAP-291 | PaperOS binds every action id to the palette and the voice vocabulary. |
| Visible focus ring on every interactive element | partial | partial | partial | partial | partial | P0 | PAP-152 | Org standard; no vendor guarantees it across views. |
| 44 px minimum touch targets | partial | partial | partial | partial | partial | P0 | PAP-66 | Org standard for touch and pen. |
| Touch range selection without a hover state | partial | partial | partial | partial | partial | P0 | PAP-341 | Round-4 amendment covers touch ranges and RTL. |
| Pen / stylus input treated as a first-class pointer | no | no | no | no | no | P0 | PAP-150 | Org standard; pointer events normalised by the input module. |
| TV remote / gamepad d-pad navigation | no | no | no | no | no | P0 | PAP-150 | Org standard: designed for, not first pass. |
| Voice control over view actions | partial | partial | partial | no | no | P0 | PAP-291 | Every action declares an intent phrase in the actions registry. |

## Kanban

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Stack columns by a single select | yes | yes | yes | paid | yes | P1 | PAP-167 | Baserow kanban is premium. |
| Stack by a user field | yes | yes | yes | paid | yes | P1 | PAP-167 | Assignee boards. |
| Drag a card between columns | yes | yes | yes | paid | yes | P1 | PAP-167 | Writes the stack field. |
| Reorder cards inside a column | yes | yes | yes | paid | yes | P1 | PAP-167 | Fractional index. |
| Swimlanes (a second grouping axis) | no | partial | yes | no | no | P1 | PAP-167 | ClickUp board swimlanes. |
| WIP limit per column | no | no | yes | no | no | P1 | PAP-167 | ClickUp board WIP limits. |
| Card field selection (which fields show) | yes | yes | yes | paid | yes | P1 | PAP-167 | Card face configuration. |
| Per-column aggregate in the header | no | no | yes | no | partial | P1 | PAP-336 | ClickUp shows sums per column. |
| Keyboard-only card move | no | no | partial | no | no | P1 | PAP-167 | Org standard: nothing drag-only. |

## Calendar, timeline and Gantt

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Month grid | yes | yes | yes | paid | yes | P1 | PAP-344 | Baserow calendar is premium. |
| Week and day views | yes | no | yes | partial | yes | P1 | PAP-168 | Notion calendar adds week; ClickUp has day. Umbrella owns the feature; children own the slices. |
| Agenda / list of upcoming | yes | yes | yes | no | partial | P1 | PAP-344 | Phone-friendly agenda mode. |
| Start and end date fields (ranges) | yes | yes | yes | paid | yes | P1 | PAP-344 | Date range spanning cells. |
| Drag an event to change its date | yes | yes | yes | paid | yes | P1 | PAP-344 | Writes the date field. |
| Resize an event to change duration | yes | yes | yes | paid | yes | P1 | PAP-345 | Bar edit in timeline and calendar. |
| Timeline lanes grouped by a field | yes | yes | yes | paid | yes | P1 | PAP-345 | Lane per group value. |
| Timeline zoom levels (day to year) | yes | yes | yes | paid | yes | P1 | PAP-345 | Two-axis virtualised canvas. |
| Dependency arrows between bars | no | no | yes | no | yes | P1 | PAP-346 | ClickUp Gantt; NocoDB Gantt. |
| Critical path highlighting | no | no | yes | no | no | P1 | PAP-346 | ClickUp Gantt critical path. |
| Working days / non-working shading | no | no | yes | no | partial | P1 | PAP-346 | Calendar of working days. |
| Date dependency rules (shift linked dates) | no | no | yes | paid | no | P1 | PAP-346 | Baserow date dependency doc. |
| ICS feed of a calendar view | yes | yes | yes | no | no | P1 | PAP-625 | Subscribe from an external calendar. |

## Gallery and list

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Card grid with a cover field | yes | yes | no | yes | yes | P1 | PAP-619 | Baserow GalleryViewType. |
| Choose which fields appear on the card | yes | yes | no | yes | yes | P1 | PAP-619 | Card face configuration. |
| Virtualised card rows for large datasets | no | no | no | partial | partial | P1 | PAP-619 | PaperOS virtualises rows of cards. |
| Dense list view tuned for phones | no | yes | yes | no | yes | P1 | PAP-169 | NocoDB LIST view type. Umbrella owns the feature; children own the slices. |
| Swipe actions on a list row | no | no | yes | no | no | P1 | PAP-619 | Mobile apps only in the vendors. |
| Attachment-first files view | no | no | no | no | no | P1 | PAP-619 | Gallery over an attachment cover covers the need. |

## Forms

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Form view generated from fields | yes | yes | yes | yes | yes | P1 | PAP-620 | Baserow FormViewType; NocoDB FORM. |
| Public submission URL | yes | yes | yes | yes | yes | P1 | PAP-620 | Anonymous submit. |
| Embeddable form | yes | yes | yes | yes | yes | P1 | PAP-624 | iframe embed with CSP. |
| Conditional fields (show when) | paid | no | yes | paid | yes | P1 | PAP-620 | Airtable conditional form logic is a paid feature. |
| Prefilled values from the URL | yes | yes | yes | yes | yes | P1 | PAP-620 | Query-parameter prefill. |
| Email notification on submission | yes | yes | yes | yes | yes | P1 | PAP-388 | Automation trigger 'when a form is submitted'. |
| Spam protection (captcha / honeypot) | yes | partial | yes | yes | partial | P1 | PAP-620 | PaperOS uses a honeypot plus Turnstile plus rate limits. |
| Rate limiting on public submit | partial | partial | partial | partial | partial | P1 | PAP-620 | Explicit budget in PaperOS. |
| Save a draft and resume | no | no | no | no | no | P1 | PAP-620 | PaperOS keeps a local draft per form token. |
| Multi-page / survey mode | no | yes | yes | paid | partial | P1 | PAP-620 | Baserow premium survey mode. |
| Edit an existing record through a form link | no | no | no | yes | yes | P1 | PAP-620 | Baserow FormViewEditRowField. |

## Map

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Plot records from a geo field | paid | yes | yes | no | yes | P1 | PAP-622 | NocoDB MAP view; Notion Place property. |
| Marker clustering | paid | no | yes | no | yes | P1 | PAP-622 | Cluster at low zoom. |
| Filter by the visible map bounds | paid | no | yes | no | partial | P1 | PAP-622 | Bounds pushed into the view filter. |
| Rectangle / lasso select on the map | no | no | no | no | no | P1 | PAP-622 | PaperOS adds rectangle select. |
| Geocode an address into coordinates | paid | yes | yes | no | no | P2 | PAP-640 | Deferred: provider adapter with caching. |
| Self-hostable map tiles | no | no | no | no | partial | P1 | PAP-170 | MapLibre GL keeps the tile provider swappable. Umbrella owns the feature; children own the slices. |

## Charts and dashboards

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Bar chart from a grouped view | paid | yes | yes | paid | no | P1 | PAP-621 | Notion Chart layout. |
| Stacked bar | paid | yes | yes | paid | no | P1 | PAP-621 | Second group as the series. |
| Line chart | paid | yes | yes | paid | no | P1 | PAP-621 | Date group on the x axis. |
| Area chart | paid | no | yes | paid | no | P1 | PAP-621 | Variant of the line series. |
| Pie / donut | paid | yes | yes | paid | no | P1 | PAP-621 | Single group. |
| Number / KPI tile | paid | yes | yes | paid | no | P1 | PAP-621 | One aggregate, big type. |
| Scatter, histogram, funnel, gauge, heatmap | paid | no | partial | no | no | P2 | PAP-636 | Deferred to v0.2. |
| Dashboard with drag-arranged blocks | paid | no | yes | paid | no | P1 | PAP-385 | Breakpoint layouts in PaperOS. |
| Cross-filtering between blocks | paid | no | partial | no | no | P1 | PAP-386 | Filter bus across the page. |
| Permission-aware tiles (hide what you cannot see) | paid | yes | yes | paid | partial | P1 | PAP-387 | Tiles degrade instead of erroring. |
| Chart clicking filters the underlying view | paid | no | yes | no | no | P1 | PAP-621 | onFilter emission. |
| Table fallback when a chart cannot render | no | no | no | no | no | P1 | PAP-621 | Accessibility requirement in PaperOS. |

## Formula engine

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Formula field with a typed expression language | yes | yes | yes | yes | yes | P1 | PAP-171 | See formula-functions CSV for the inventory. Umbrella owns the feature; children own the slices. |
| Static type checking before save | no | yes | no | yes | partial | P1 | PAP-382 | Baserow rejects invalid formulas at save. |
| Editor with autocomplete and inline docs | yes | yes | partial | yes | yes | P1 | PAP-383 | Notion's editor shows a reference panel. |
| Reference another field by name | yes | yes | yes | yes | yes | P1 | PAP-382 | Name or id binding. |
| Reference a rollup or lookup inside a formula | yes | yes | no | yes | yes | P1 | PAP-383 | Dependency graph must order them. |
| Ternary and boolean operators | yes | yes | yes | yes | yes | P1 | PAP-382 | Notion documents ?: and && || !. |
| List / array functions over linked records | partial | yes | no | yes | partial | P1 | PAP-383 | Notion map/filter/some/every. |
| Let bindings / local variables | no | yes | no | no | no | P1 | PAP-382 | Notion let and lets. |
| Server-side evaluation compiled to SQL | no | no | no | yes | yes | P1 | PAP-384 | Baserow and NocoDB push formulas into the database. |
| Cache plus background recompute for unsupported functions | no | no | no | partial | no | P1 | PAP-384 | formula_cache fallback job. |
| Formula snapshot survives an engine upgrade | no | no | no | no | no | P1 | PAP-993 | PaperOS persists the snapshot with an upgrade hook. |

The function inventory PAP-171 implements against is `docs/research/views-parity-formula-functions.csv`
(129 functions, 49 tagged P0 for the first release).

| Category | Functions | In Airtable | In Notion |
|---|---|---|---|
| array | 17 | 5 | 17 |
| binding | 2 | 0 | 2 |
| date | 31 | 26 | 23 |
| logic | 15 | 11 | 12 |
| number | 29 | 22 | 27 |
| record | 6 | 3 | 3 |
| regex | 3 | 3 | 3 |
| text | 26 | 15 | 24 |

## Relations, lookups and rollups

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Link records across tables | yes | yes | yes | yes | yes | P1 | PAP-340 | Baserow LinkRowField. |
| Two-way (symmetric) relation | yes | yes | yes | yes | yes | P1 | PAP-340 | Reverse field created automatically. |
| Create a linked record from the picker | yes | yes | yes | yes | yes | P1 | PAP-340 | Round-4 amendment: allowCreate. |
| Filter which records the picker offers | yes | yes | yes | partial | partial | P1 | PAP-340 | Scoped picker using a FilterTree. |
| Lookup of a field on the linked record | yes | yes | no | yes | yes | P1 | PAP-340 | Baserow LookupField. |
| Rollup with an aggregate function | yes | yes | no | yes | yes | P1 | PAP-340 | Baserow RollupField. |
| Conditional rollup (filter linked records first) | yes | no | no | partial | no | P1 | PAP-340 | Airtable conditional rollups; round-4 amendment adds filter. |
| Count field over a relation | yes | partial | no | yes | yes | P1 | PAP-340 | Baserow CountField. |
| Self-referencing relation (parent / child) | yes | yes | yes | yes | yes | P2 | PAP-633 | Drives the deferred tree grid. |
| Rollup along a hierarchy | no | partial | yes | no | no | P2 | PAP-633 | Deferred with the tree grid. |

## Saved views and sharing

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Save a view configuration for everyone | yes | yes | yes | yes | yes | P1 | PAP-172 | Collaborative views in Airtable, Baserow and NocoDB. Umbrella owns the feature; children own the slices. |
| Personal view only its owner can change | paid | yes | yes | yes | yes | P1 | PAP-623 | Airtable personal views need a paid plan; Baserow personal views doc. |
| Lock a view against configuration changes | paid | no | yes | yes | yes | P1 | PAP-623 | Airtable locked views are paid; NocoDB locked views. |
| Favourite / pin a view | paid | yes | yes | yes | yes | P1 | PAP-623 | Airtable favourites need a paid plan. |
| Organise views into sections or folders | paid | no | yes | no | yes | P1 | PAP-623 | Airtable view sections (paid); NocoDB view folders. |
| Per-audience default view | no | no | partial | no | no | P1 | PAP-623 | PaperOS picks a default per audience. |
| Public read-only link to a view | yes | yes | yes | yes | yes | P1 | PAP-624 | Baserow share view publicly. |
| Password-protected public link | paid | paid | paid | yes | yes | P1 | PAP-624 | Baserow and NocoDB support a password on shared views. |
| Expiring public link | paid | no | paid | partial | partial | P1 | PAP-624 | PaperOS sets expiry on the share token. |
| Embed a view in another site | yes | yes | yes | yes | yes | P1 | PAP-624 | iframe embed route. |
| Hide specific fields from a shared view | yes | yes | yes | yes | yes | P1 | PAP-624 | allowed_fields projection server-side. |
| Allow edits through a public link | no | no | no | partial | yes | P1 | PAP-624 | NocoDB editable shared views; PaperOS keeps this behind a flag. |
| Email or post a view export on a schedule | paid | no | yes | no | no | P2 | PAP-639 | ClickUp scheduled dashboard emails; deferred to v0.2. |

## Permissions

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Per-table permissions | paid | no | yes | paid | yes | P2 | PAP-638 | Baserow enterprise role-based permissions. |
| Per-view permissions | paid | no | yes | paid | partial | P0 | PAP-623 | canEditView on the ViewSpec. |
| Per-field permissions | paid | no | partial | paid | no | P2 | PAP-638 | Deferred to v0.2 in PaperOS. |
| Per-record (row) permissions | paid | no | yes | paid | no | P0 | PAP-34 | PaperOS uses RLS from day one. |
| Row-level security enforced in the database | no | no | no | no | partial | P0 | PAP-34 | Tenant isolation harness in PaperOS. |
| Audience-based visibility rules | no | no | partial | no | no | P0 | PAP-55 | PaperOS audience model drives defaults and shares. |
| Audit log of who changed what | paid | paid | paid | paid | partial | P0 | PAP-38 | Baserow audit logs are enterprise. |
| Reason recorded with a privileged change | no | no | no | no | no | P0 | PAP-613 | PaperOS requires an audit reason on records.* writes. |
| View permissions can only narrow, never widen | no | no | no | no | no | P0 | PAP-161 | Stated invariant in the view model. |
| Resource grants shared with identity | no | no | no | no | no | P0 | PAP-994 | View sharing consumes the identity module's grants. |

## Import and export

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Import CSV into a new table | yes | yes | yes | yes | yes | P1 | PAP-200 | Column mapping on import. |
| Import from another vendor (Airtable, Notion) | yes | yes | yes | yes | yes | P1 | PAP-199 | Migration connectors. |
| Scheduled re-sync of an external source | paid | yes | yes | no | yes | P1 | PAP-417 | Airtable Sync; suggested to the migration project. |
| Export the current view as CSV | yes | yes | yes | yes | yes | P1 | PAP-625 | Baserow export a view. |
| Export as XLSX | paid | no | yes | paid | yes | P1 | PAP-625 | Baserow premium export formats. |
| Export as JSON | no | no | no | paid | yes | P1 | PAP-625 | NocoDB and Baserow premium. |
| Export honours filters, sorts and hidden fields | yes | yes | yes | yes | yes | P1 | PAP-625 | Export runs the same compiled query. |
| Streamed export as a background job | no | no | partial | partial | partial | P1 | PAP-625 | Large exports run as jobs with a download link. |
| Whole-workspace archive / backup | paid | yes | paid | yes | yes | P1 | PAP-205 | Baserow database snapshots. |
| Printable view route | yes | yes | yes | partial | partial | P1 | PAP-625 | /print/v/:id in PaperOS. |

## API, MCP and CLI surfaces

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| REST API for records | yes | yes | yes | yes | yes | P1 | PAP-269 | All five publish one. |
| Query a view through the API (filters applied) | yes | yes | yes | yes | yes | P1 | PAP-337 | views.query procedure. |
| Create / update / archive records through the API | yes | yes | yes | yes | yes | P1 | PAP-613 | records.* procedures with idempotency. |
| Schema (metadata) API | yes | yes | yes | yes | yes | P1 | PAP-332 | Fields and views as data. |
| Webhooks on record change | yes | yes | yes | yes | yes | P1 | PAP-388 | Baserow webhooks. |
| Inbound webhook as an automation trigger | yes | yes | yes | partial | partial | P1 | PAP-388 | Airtable 'when a webhook is received'. |
| MCP server exposing views to agents | partial | partial | partial | no | no | P1 | PAP-291 | Recorded in docs/reference/surfaces.md. |
| WebMCP actions registry on the page | no | no | no | no | no | P1 | PAP-291 | Org standard: every page declares its actions. |
| CLI for views and records | no | no | no | partial | partial | P1 | PAP-222 | Included in the surfaces doc. |
| Idempotency keys on writes | no | no | no | no | no | P1 | PAP-613 | Required for retries and offline replay. |

## Automations

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Trigger: when a record is created | yes | yes | yes | yes | yes | P1 | PAP-388 | Airtable 'When a record is created'. |
| Trigger: when a record is updated | yes | yes | yes | yes | yes | P1 | PAP-388 | Airtable 'When a record is updated'. |
| Trigger: when a record matches a condition | yes | yes | yes | partial | partial | P1 | PAP-388 | Airtable 'When a record matches conditions'. |
| Trigger: when a record enters a view | yes | no | no | no | no | P1 | PAP-388 | Airtable 'When a record enters a view'. |
| Trigger: when a form is submitted | yes | yes | yes | yes | partial | P1 | PAP-388 | Airtable 'When a form is submitted'. |
| Trigger: at a scheduled time | yes | no | yes | partial | partial | P1 | PAP-388 | Airtable scheduled trigger. |
| Trigger: when a webhook is received | yes | no | yes | yes | yes | P1 | PAP-388 | Airtable inbound webhook trigger. |
| Action: create a record | yes | yes | yes | yes | yes | P1 | PAP-389 | Airtable 'Create record'. |
| Action: update a record | yes | yes | yes | yes | yes | P1 | PAP-389 | Airtable 'Update record'. |
| Action: find records and loop | yes | no | partial | no | no | P1 | PAP-389 | Airtable 'Find records'. |
| Action: send an email | yes | no | yes | yes | partial | P1 | PAP-389 | Airtable 'Send an email'. |
| Action: outbound webhook / connector call | yes | yes | yes | yes | yes | P1 | PAP-389 | connector.call with scope classes. |
| Action: run a script | paid | no | no | no | partial | P1 | PAP-389 | Airtable 'Run a script'; PaperOS uses agent.run instead. |
| Action: delay / wait | no | no | yes | no | no | P1 | PAP-389 | Delay step in the catalogue. |
| Conditional branch inside a run | yes | yes | yes | no | no | P1 | PAP-389 | Branch step with FilterTree conditions. |
| Run log with inputs, outputs and replay | yes | yes | yes | yes | partial | P1 | PAP-390 | Airtable run history. |
| Loop guard and run quotas | yes | yes | yes | partial | partial | P1 | PAP-174 | Airtable caps runs per month and 25 actions per automation. Umbrella owns the feature; children own the slices. |

## Record history and trash

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Per-record change history | yes | yes | yes | yes | yes | P1 | PAP-333 | Baserow row change history. |
| Per-field change history | yes | yes | partial | yes | partial | P1 | PAP-333 | Cell-level history. |
| Restore a previous field value | yes | yes | no | yes | partial | P1 | PAP-333 | Undo from history. |
| Snapshot / restore a whole base | paid | yes | paid | yes | partial | P1 | PAP-205 | Baserow database snapshots. |
| Trash with restore | yes | yes | yes | yes | yes | P1 | PAP-334 | Baserow delete and recover data. |
| Restore a deleted field with its data | yes | no | no | yes | partial | P1 | PAP-334 | Soft-deleted columns. |
| Undo toast immediately after a destructive action | yes | yes | yes | partial | partial | P1 | PAP-334 | Shortest path back. |
| History entries carry the actor and the reason | partial | partial | partial | yes | partial | P1 | PAP-38 | Audit reason required in PaperOS. |

## Schema editing

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Create a table in-app | yes | yes | yes | yes | yes | P0 | PAP-332 | Schema editor. |
| Create a field in-app | yes | yes | yes | yes | yes | P0 | PAP-332 | Baserow create fields. |
| Delete a table with restore | yes | yes | yes | yes | yes | P0 | PAP-334 | Trash covers tables. |
| Convert a field type with a backfill job | yes | yes | partial | yes | yes | P0 | PAP-340 | Background backfill in PaperOS. |
| Warn before a lossy conversion | partial | partial | no | partial | partial | P0 | PAP-340 | Explicit lossiness report in PaperOS. |
| Schema defined in code as well as in the UI | no | no | no | no | partial | P0 | PAP-991 | defineEntity() registers code-owned datasets. |
| Field and table limits documented | yes | yes | yes | yes | yes | P0 | PAP-161 | PaperOS caps 500 fields and 100 KB per row. |
| Schema change emits a domain event | no | no | no | yes | partial | P0 | PAP-555 | Baserow webhooks cover some schema events. |

## Collaboration

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Comments on a record | yes | yes | yes | yes | yes | P1 | PAP-131 | Baserow comments and mentions. |
| Comment on a specific cell | no | no | no | no | no | P2 | `gap` | Declined for v0.1: needs a cell anchor grammar in the collab module. |
| Live updates without a refresh | yes | yes | yes | yes | yes | P1 | PAP-336 | Electric shapes in PaperOS. |
| Presence: who is viewing this view | yes | yes | yes | partial | partial | P1 | PAP-141 | Avatar stack on the view header. |
| Cell-level presence / cursors | yes | no | no | no | no | P1 | PAP-143 | Suggested to the realtime project. |
| Concurrent edit conflict handling | yes | yes | yes | partial | partial | P1 | PAP-992 | ConflictBoundary mounted by grid and record pages. |
| In-product annotation and bug filing by testers | no | no | no | no | no | P1 | PAP-79 | Org standard: annotate the product itself. |
| Share a deep link to a specific record and field | yes | yes | yes | partial | partial | P1 | PAP-333 | Deep link with focus. |

## Search

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Search within the current view | yes | yes | yes | yes | yes | P1 | PAP-618 | SearchBox in the toolbar. |
| Highlight matches in the grid | yes | yes | yes | yes | yes | P1 | PAP-629 | Match navigation. |
| Jump between matches | yes | no | yes | yes | partial | P1 | PAP-629 | Next / previous match. |
| Find and replace within a view | yes | no | no | no | no | P1 | PAP-629 | Airtable ships find and replace. |
| Cross-dataset global search | yes | yes | yes | yes | yes | P1 | PAP-207 | Owned by the search project. |

## Mobile and offline

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| Usable grid at 360 px width | partial | partial | partial | partial | partial | P1 | PAP-165 | Org standard: 360 to 3840 px. Umbrella owns the feature; children own the slices. |
| Native mobile app | yes | yes | yes | no | no | P2 | `gap` | Declined for v0.1: PaperOS ships responsive web first. |
| Offline read of a cached view | yes | yes | yes | no | no | P1 | PAP-272 | Local-first sync layer. |
| Offline edits queued and replayed | yes | partial | partial | no | no | P1 | PAP-272 | Requires idempotency keys. |
| Conflict resolution UX after reconnect | partial | partial | partial | no | no | P1 | PAP-992 | ConflictBoundary. |
| uuidv7 ids and updated_at on every row | no | no | no | partial | partial | P1 | PAP-161 | Multiplayer-ready data from day one. |

## Accessibility and localisation

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| role=grid semantics with row/column announcements | partial | partial | partial | partial | partial | P1 | PAP-152 | No vendor documents full grid semantics. |
| Keyboard reachable for every action | partial | partial | partial | partial | partial | P1 | PAP-152 | Org standard: nothing hover-only or drag-only. |
| Screen-reader announcement on filter and sort change | no | no | no | no | no | P1 | PAP-152 | Live region on the toolbar. |
| Colour is never the only signal | partial | partial | partial | partial | partial | P1 | PAP-626 | Conditional formatting adds an icon or label. |
| UI language toggle (English / Spanish) | yes | yes | yes | yes | yes | P1 | PAP-64 | Org standard: no hard-coded UI strings. |
| RTL layout for grids | partial | yes | partial | partial | partial | P1 | PAP-341 | Round-4 amendment covers RTL frozen columns. |

## Performance, limits and module hygiene

| Feature | Airtable | Notion | ClickUp | Baserow | NocoDB | Priority | PaperOS issue | Notes |
|---|---|---|---|---|---|---|---|---|
| 100k rows in one view without pagination stalls | partial | partial | partial | yes | yes | P0 | PAP-337 | PaperOS benches 100k rows. |
| Server-side pagination for large views | yes | yes | yes | yes | yes | P0 | PAP-335 | Keyset cursors in PaperOS. |
| p95 latency budget published for view queries | no | no | no | no | no | P0 | PAP-242 | Added to the performance budgets. |
| Indexes created for filtered and sorted fields | no | no | no | yes | yes | P0 | PAP-337 | Baserow field indexes. |
| Conformance suite a swapped implementation must pass | no | no | no | no | no | P0 | PAP-486 | Module system requirement. |
| Contract package other modules import | no | no | no | no | no | P0 | PAP-483 | @paperos/contract-tables v0.1. |
| Module registered behind a registry with a feature flag | no | no | no | no | no | P0 | PAP-489 | Swap playbook. |
| Demo route per view kind with a deterministic seed | no | no | no | no | no | P0 | PAP-615 | Cold-session onboarding. |
| Written extension guide for adding a kind or type | no | no | no | partial | partial | P0 | PAP-631 | Baserow and NocoDB have developer docs. |
| Parity tracking kept current as a checked artefact | no | no | no | no | no | P0 | PAP-162 | This checklist, validated in CI. |

## Declined for v0.1 (`wontdo`)

Each of these is a real feature in at least one product. They are declined for v0.1, not forgotten;
the checklist keeps the row so the decision stays visible. **An ADR recording these declines is owed
(GAP-15) - until it lands, this section is the record.**

| Feature | Seen in | Why declined for v0.1 |
|---|---|---|
| Mind map view | ClickUp | ClickUp Mind Map has no data-table analogue in PaperOS. |
| Barcode field | Airtable, NocoDB | Airtable Barcode and NocoDB Barcode; no PaperOS demand yet. |
| QR code field | NocoDB | NocoDB QrCode only. |
| Password field | Baserow | Baserow PasswordField; credentials do not belong in a dataset. |
| regular expression match | - | reachable through a formula field plus a boolean filter. |
| is even and whole | Baserow | Baserow is_even_and_whole is a novelty operator. |
| Comment on a specific cell | - | needs a cell anchor grammar in the collab module. |
| Native mobile app | Airtable, Notion, ClickUp | PaperOS ships responsive web first. |

## Gaps and proposed work

Fifteen gaps, each with a one-line acceptance criterion. Thirteen already have an owner in Linear;
two are unowned and need an issue.

| # | Feature | Owner | Acceptance criterion |
|---|---|---|---|
| GAP-01 | Records CRUD for custom datasets | PAP-613 | records.list|get|create|update|archive|restore exist behind the contract, validate against FieldDef, accept an idempotency key and require an audit reason; grid, forms and bulk actions all write through them. |
| GAP-02 | View renderer registry and ViewHost | PAP-614 | registerViewKind(kind, renderer) plus one <ViewHost spec /> renders every kind; an unknown kind renders a placeholder with a 'not wired yet' toast instead of throwing. |
| GAP-03 | Demo routes and deterministic seed | PAP-615 | /demo/<kind> exists for all eleven kinds over a seeded 100k-row dataset; a cold session can open any view without fixtures of its own. |
| GAP-04 | System fields | PAP-616 | autonumber, createdTime, lastModifiedTime, createdBy, lastModifiedBy are read-only computed field types present in Airtable, Baserow and NocoDB. |
| GAP-05 | Per-view export (CSV, XLSX, JSON, ICS) | PAP-625 | Any view exports honouring filters, sorts and visible fields; calendar views publish an ICS feed; large exports stream as a job. |
| GAP-06 | Conditional formatting | PAP-626 | Row and cell colour rules built from FilterTree conditions render in grid, kanban, calendar and gallery, and never rely on colour alone. |
| GAP-07 | Extra field types (richText, duration, time, progress, json) | PAP-627 | Each type has a cell, an editor, a cast and a documented conversion; matches Notion rich text, ClickUp progress and NocoDB JSON. |
| GAP-08 | Record templates and field defaults | PAP-628 | FieldDef.defaultValue with dynamic tokens and per-dataset record templates from the New record menu. |
| GAP-09 | Grid find and replace | PAP-629 | Search inside the current view, navigate matches, replace per type with a preview and a batched write. |
| GAP-10 | Grid fill handle | PAP-630 | Drag to fill down or across with copy, numeric series and date pattern detection, undoable as one entry. |
| GAP-11 | Cell-level comment anchors | **unowned** | Collab extends the anchor grammar with cell:<datasetRef>:<recordId>:<fieldId> and the grid renders an indicator; no tables issue owns it today. |
| GAP-12 | Cell-level presence in grids and boards | PAP-143 | Realtime projects awareness onto grid cells and kanban cards, not only pages and record streams. |
| GAP-13 | Voice and remote input for view actions | PAP-150 | Every view action carries an intent phrase and is reachable from a d-pad and from voice, per the org input standard. |
| GAP-14 | p95 budgets for views.query, views.groups and records.update | PAP-242 | The release-candidate smoke keeps the 100k-row numbers honest as field types and formulas land. |
| GAP-15 | ADR for declined parity features | **unowned** | One ADR records barcode, QR, password field, regex filter, is_even_and_whole, mind map, native mobile app and cell comments as wontdo for v0.1, with the reason and the revisit trigger. |

## Sources

Every row's `source` column resolves to one of these. The CSV writes the full URL and the access date
into the cell, so a row stays checkable when this table moves.

| Key | Source | URL | Accessed |
|---|---|---|---|
| `AT-AUTO` | Airtable Support - Automations overview | <https://support.airtable.com/docs/automations-overview> | 2026-09-19 |
| `AT-FIELDS` | Airtable Support - Supported field types in Airtable overview | <https://support.airtable.com/docs/supported-field-types-in-airtable-overview> | 2026-09-19 |
| `AT-FORMULA` | Airtable Support - Formula field reference | <https://support.airtable.com/docs/formula-field-reference> | 2026-09-19 |
| `AT-VIEWS` | Airtable Support - Getting started with Airtable views | <https://support.airtable.com/docs/getting-started-with-airtable-views> | 2026-09-19 |
| `BA-DOCS` | Baserow user documentation index | <https://baserow.io/user-docs> | 2026-09-19 |
| `BA-FIELDMODELS` | Baserow source - database/fields/models.py | <https://gitlab.com/baserow/baserow/-/raw/develop/backend/src/baserow/contrib/database/fields/models.py> | 2026-09-19 |
| `BA-FIELDTYPES` | Baserow source - database/fields/field_types.py | <https://gitlab.com/baserow/baserow/-/raw/develop/backend/src/baserow/contrib/database/fields/field_types.py> | 2026-09-19 |
| `BA-FILTERS` | Baserow source - database/views/view_filters.py | <https://gitlab.com/baserow/baserow/-/raw/develop/backend/src/baserow/contrib/database/views/view_filters.py> | 2026-09-19 |
| `BA-PREMIUMVIEWS` | Baserow source - baserow_premium/views/view_types.py | <https://gitlab.com/baserow/baserow/-/raw/develop/premium/backend/src/baserow_premium/views/view_types.py> | 2026-09-19 |
| `BA-VIEWTYPES` | Baserow source - database/views/view_types.py | <https://gitlab.com/baserow/baserow/-/raw/develop/backend/src/baserow/contrib/database/views/view_types.py> | 2026-09-19 |
| `CU-FIELDS` | ClickUp Developer docs - Custom Fields types | <https://developer.clickup.com/docs/customfields> | 2026-09-19 |
| `CU-VIEWS` | ClickUp - Views feature page | <https://clickup.com/features/views> | 2026-09-19 |
| `NC-FIELDS` | NocoDB docs - Fields overview | <https://nocodb.com/docs/product-docs/fields/fields-overview> | 2026-09-19 |
| `NC-UITYPES` | NocoDB source - nocodb-sdk UITypes.ts | <https://raw.githubusercontent.com/nocodb/nocodb/develop/packages/nocodb-sdk/src/lib/UITypes.ts> | 2026-09-19 |
| `NC-VIEWS` | NocoDB docs - Views overview | <https://nocodb.com/docs/product-docs/views/views-overview> | 2026-09-19 |
| `NC-VIEWTYPES` | NocoDB source - nocodb-sdk globals.ts (ViewTypes) | <https://raw.githubusercontent.com/nocodb/nocodb/develop/packages/nocodb-sdk/src/lib/globals.ts> | 2026-09-19 |
| `NO-FORMULA` | Notion Help - Formula syntax and functions | <https://www.notion.com/help/formula-syntax> | 2026-09-19 |
| `NO-PROPS` | Notion Help - Database properties | <https://www.notion.com/help/database-properties> | 2026-09-19 |
| `NO-VIEWS` | Notion Help - Views, filters and sorts | <https://www.notion.com/help/views-filters-and-sorts> | 2026-09-19 |

## Method and limits

* Sources are public vendor documentation and, for Baserow and NocoDB, the enum definitions in their
  own repositories (view types, field types, filter operators). Where a vendor's page enumerates a
  list, the row follows the list; where it does not, the cell follows the vendor's general product
  documentation and the note says what the claim rests on.
* Paid-tier features are recorded as `paid`, never `yes`. Baserow's kanban, calendar and timeline live
  in `baserow_premium`; Airtable's personal views, locked views, favourites and view sections require a
  paid workspace.
* The same idea under different names is one row with the aliases in the note (for example Airtable
  "linked record", Baserow `link_row`, NocoDB `Links`).
* Vendor documentation changes. Every source carries its access date; re-run the audit before quoting
  a cell in an external document.
* Baserow's `field_types.py` truncated on fetch, so the Baserow field list is taken from
  `fields/models.py` (28 model classes) and cross-checked against the field type strings that did load.
* ClickUp's help centre refuses automated fetches (HTTP 403); ClickUp rows cite the public features
  page and the developer documentation instead.
