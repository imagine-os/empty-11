---
title: Export formats and API limits of import sources
issue: PAP-198
status: research
checkedOn: "2026-09-19"
sources:
  - airtable
  - notion
  - clickup
  - monday
  - hubspot
  - quickbooks-online
machineReadable: docs/migration/sources/index.json
consumers:
  - PAP-199
  - PAP-347
  - PAP-413
  - PAP-492
  - PAP-813
  - PAP-188
  - PAP-208
---

# Export formats and API limits of import sources

**Issue:** [PAP-198](https://linear.app/paperos/issue/PAP-198) — Catalog export formats and API limits of Airtable, Notion, ClickUp, Monday, HubSpot and QuickBooks.
**Checked on:** 2026-09-19. Every number below was read from the vendor's own documentation on that date; each claim carries the URL it came from. Anything the vendor does not state in public docs is marked **`unverified`** with the closest link, never guessed.

This is work package 1 of PAP-198: the reference every importer is designed against. `SourceConnector` (PAP-199) reads the machine-readable form of this page from [`docs/migration/sources/index.json`](../migration/sources/index.json) for its `capabilities.rateLimit` defaults; PAP-208 reads it for run-time estimates; PAP-413 reads the Monday and HubSpot sections for its CSV recipes; PAP-188 reads the HubSpot section for the CRM mapping.

## How to read this page

Each source has the same seven sections:

1. **Export formats** — what a human can download from the product UI, without any API credential. This is the fallback path when a plan or a token is missing.
2. **API and auth** — base URL, protocol, credential kinds, header shape, versioning.
3. **Rate limits** — the published numbers, the HTTP status on breach, and the headers we can read to self-throttle.
4. **Pagination** — cursor or offset, page size default and maximum, and whether a cursor is stable.
5. **Attachments** — how binary content is reached and how fast its URL rots. This decides whether the connector streams files during the run or defers them.
6. **Field-type mapping** — source type to the PAP-164 field type, with a lossy flag. `lossy` means the round trip loses information we cannot reconstruct.
7. **Known gaps** — what we could not verify, what needs a paid plan, and what the connector has to work around.

PAP-164 target types used throughout: `text`, `longText`, `number`, `currency`, `percent`, `date`, `checkbox`, `rating`, `url`, `email`, `phone`, `select`, `multiSelect`, `user`, `attachment`, `relation`, `lookup`, `rollup`, `formula`. Types outside PAP-164 are mapped to the nearest primitive and flagged.

## Summary

| Source | Protocol | Auth | Published rate limit | Page size | Incremental | Attachment URL life |
|---|---|---|---|---|---|---|
| Airtable | REST | PAT or OAuth 2.0 | 5 req/s per base; 50 req/s per token | 100 (max 100) | via filter on a modified-time field (`unverified` as a first-class API feature) | ~2 hours |
| Notion | REST | Internal integration token or OAuth 2.0 | 180 req/min (3/s); 600 req/min (10/s) Business/Enterprise | 100 (max 100) | yes, `last_edited_time` sort and filter | S3 links, short-lived (`unverified` exact TTL) |
| ClickUp | REST | Personal token (`pk_…`) or OAuth 2.0 | 100 req/min per token (Free/Unlimited/Business); 1,000 Business Plus; 10,000 Enterprise | 100 per page, `page` index | yes, `date_updated_gt` | not published (`unverified`) |
| Monday | GraphQL | Personal API token or OAuth 2.0 | complexity budget 10M points/min (PAT); 1,000–25,000 calls/day by plan; 1,000–5,000 queries/min | cursor, 500 items max per page | partial, via `updated_at` column | `public_url` / `url` on assets |
| HubSpot | REST | Private-app static token or OAuth 2.0 | 100–250 req/10 s by tier; 250k–1M req/day | 100 default, 200 max on search | yes, `hs_lastmodifieddate` | files API URLs |
| QuickBooks Online | REST | OAuth 2.0 only | 500 req/min per realmId; 10 concurrent per realmId | `MAXRESULTS` max 1000 | yes, CDC endpoint, 30-day look-back | n/a (attachments via Attachable) |

Throughput implications are in [Throughput](#throughput-at-documented-limits) at the end.

---

## Airtable

### Export formats

* **CSV per view.** Any grid view downloads as a single CSV ([Download a view to CSV](https://support.airtable.com/docs/download-a-view-to-csv), checked 2026-09-19). The CSV carries the view's visible fields in the view's order, so hidden fields and the grouping structure are lost.
* Attachment cells are written into the CSV as filename plus URL, not as files: "attachment fields will be included in the CSV file as a filename and URL", and the files themselves must be fetched separately ([Attachment fields in Airtable](https://support.airtable.com/articles/9139007724-attachment-fields-in-airtable), checked 2026-09-19). Those CSV URLs expire on the same short clock as API URLs (below).
* There is no first-party bulk attachment download in the UI; the documented routes are the Scripting extension or a marketplace extension, which means **the UI export path alone cannot migrate files**. Our importer must use the API for anything with attachments.

### API and auth

* Web API, REST, base `https://api.airtable.com/v0`.
* Two credential kinds: a **personal access token** (PAT), scoped per workspace/base with scopes such as `data.records:read|write` and `schema.bases:read|write`, or an **OAuth 2.0** integration for multi-tenant use. Both are sent as `Authorization: Bearer <token>`.
* Schema is read separately from data: `GET /v0/meta/bases/{baseId}/tables` returns tables, fields and views, which is what the connector's `discover()` step needs.

### Rate limits

> "5 requests per second per base" and "50 requests per second for all traffic using personal access tokens from a given user or service account." On breach the API returns "a 429 status code and will need to wait 30 seconds before subsequent requests will succeed."
> — [Airtable Web API: Rate limits](https://airtable.com/developers/web/api/rate-limits), checked 2026-09-19.

Two things follow for the connector. First, the per-base limit is the binding one for a single-base import, so the scheduler is a per-base token bucket at 5/s, not a global one. Second, the 30-second penalty is unusually long: an optimistic retry storm costs half a minute of throughput per mistake, so we back off *before* 429 rather than after it. No `X-RateLimit-*` headers are documented, so throttling is open-loop — we count our own requests.

### Pagination

`GET /v0/{baseId}/{tableIdOrName}` takes `pageSize` (**default 100, maximum 100**), `maxRecords` (a total cap across pages, after which pagination stops) and `offset`; the response carries `offset` when another page exists ([List records](https://airtable.com/developers/web/api/list-records), checked 2026-09-19). Offset validity/expiry is **`unverified`** — Airtable's docs do not state a TTL, so the connector treats an offset as usable only within the current run and restarts a table from the beginning if a run is resumed after a long gap.

`cellFormat` is `json` (default, typed per field) or `string` (the user-facing rendering). **Import always uses `json`**: `string` collapses currency, date and select values into locale-formatted text and is lossy by construction. `returnFieldsByFieldId: true` keys cells by field id rather than name, which is what an idempotent re-sync needs — field names are renameable, field ids are not.

### Attachments

The attachment cell value is an array of objects with `id`, `type`, `filename`, `height`, `size`, `url`, `width` and `thumbnails`. The critical constraint:

> "URLs returned will expire 2 hours after being returned from our API. If you want to persist the attachments, we recommend downloading them instead of saving the URL."
> — [Airtable field model](https://airtable.com/developers/web/api/field-model), checked 2026-09-19.

The support article phrases the same window as valid "at least 2 hours after receiving them", with the caveat that Airtable may change it ([Airtable attachment URL behavior](https://support.airtable.com/articles/9671148410-airtable-attachment-url-behavior), checked 2026-09-19).

**Connector consequence:** attachments are fetched inside the same page's processing window, never queued for a later phase. A two-hour TTL means a resumable import must re-read the record page to get fresh URLs rather than replaying stored ones — so the resume checkpoint stores the record offset, not the file URL.

### Field-type mapping

Source types from the [field model](https://airtable.com/developers/web/api/field-model) (checked 2026-09-19).

| Airtable type | PAP-164 type | Lossy | Note |
|---|---|---|---|
| `singleLineText` | `text` | no | |
| `multilineText` | `longText` | no | |
| `richText` | `longText` | **yes** | Airtable rich text is Markdown-ish; formatting survives only as text unless the target renders Markdown |
| `email` | `email` | no | |
| `url` | `url` | no | |
| `phoneNumber` | `phone` | no | parsed with `libphonenumber-js` per PAP-164 |
| `number` | `number` | no | precision option maps to field options |
| `percent` | `percent` | no | |
| `currency` | `currency` | no | must be read as minor units into `Money` (`{ amountMinor, currency }`), never a float — contracts §1 |
| `duration` | `number` | **yes** | stored as seconds; the display format (`h:mm:ss`) has no PAP-164 equivalent |
| `rating` | `rating` | no | max maps to `rating` max |
| `checkbox` | `checkbox` | no | |
| `date` / `dateTime` | `date` | no | `includeTime` distinguishes them |
| `createdTime` / `lastModifiedTime` | `date` | **yes** | computed at source; imported as a plain date column, no longer auto-maintained |
| `singleSelect` | `select` | no | option `{ id, name, color }` preserved |
| `multipleSelects` | `multiSelect` | no | |
| `singleCollaborator` / `multipleCollaborators` | `user` | **yes** | needs PeopleMatching; unmatched collaborators become placeholders |
| `createdBy` / `lastModifiedBy` | `user` | **yes** | computed at source |
| `multipleAttachments` | `attachment` | no | files streamed within the 2 h window |
| `multipleRecordLinks` | `relation` | no | requires both tables in the same run to resolve |
| `multipleLookupValues` | `lookup` | no | |
| `rollup` | `rollup` | **yes** | the rollup *function* is recorded, but re-evaluation depends on PAP-171 supporting it |
| `formula` | `formula` | **yes** | formula text is Airtable dialect; PAP-171 compatibility decides whether it re-evaluates or is frozen as a value |
| `autoNumber` | `number` | **yes** | sequence is not transferable; imported as a static number |
| `barcode` | `text` | **yes** | `{ type, text }` object flattened to its text |
| `button` | — | **yes** | no PAP-164 target (`button` is explicitly out of PAP-164, it belongs to PAP-174); dropped with a mapping warning |
| `aiText` | `longText` | **yes** | generated value imported as static text |
| `externalSyncSource` | `select` | **yes** | the sync linkage itself cannot be imported |
| `count` | `rollup` | **yes** | count of linked records; re-derived if the relation imported cleanly |

### Known gaps

* **Attachment API needs a paid plan.** Programmatic attachment access is a Team-and-above capability; on Free the practical path is the UI CSV plus manual files. This is the cost driver in NJ-13 item 1. Fallback: UI-export fixtures, attachments marked `skipped: no-plan`.
* **No rate-limit headers.** Self-throttling is open-loop; we cannot discover a tightened limit at runtime.
* **Offset TTL `unverified`** ([List records](https://airtable.com/developers/web/api/list-records)).
* **No published incremental-sync primitive.** The workable pattern is a `lastModifiedTime` field plus `filterByFormula`, which requires the base to *have* such a field. Whether Airtable offers a first-class changed-since endpoint is **`unverified`**; treat incremental as "conditional" in `index.json`.

---

## Notion

### Export formats

From [Export your content](https://www.notion.com/help/export-your-content) (checked 2026-09-19):

* **Markdown & CSV** — "Any non-database Notion page can be exported as a Markdown file. Full page databases will be exports as a CSV file, with Markdown files for each subpage."
* **HTML** — pages and databases as a zip.
* **PDF** — per page; multi-page ("Include subpages") PDF export is a Business/Enterprise feature.
* "Create folders for subpages" nests the zip; the docs warn Windows users to turn it off when paths exceed 260 characters — worth replicating as a warning in our own export UI (PAP-421).
* Form views cannot be exported; export the Table view instead.
* **Workspace-level export** is Enterprise-admin only: "Exports can take up to 30 hours to process, depending on the size of the workspace," and download links expire after seven days.

The 30-hour processing time and 7-day link TTL mean the UI export path is not something an interactive import wizard can drive. For Notion the API is the primary path and the zip is the fallback.

### API and auth

* REST, base `https://api.notion.com/v1`.
* Auth is an **internal integration token** (one workspace, granted per page) or **OAuth 2.0** for public integrations. `Authorization: Bearer <token>`.
* **Every request must carry a version header.** `Notion-Version: 2026-03-11` is current ([API reference: pagination and versioning](https://developers.notion.com/reference/intro), checked 2026-09-19). Pin this in the connector and treat a version bump as a contract change.
* Official SDK `@notionhq/client` 4.x.

### Rate limits

> Business/Enterprise: "600 requests per minute (an average of 10 per second)". Other plans: "180 requests per minute (an average of 3 per second)". Breach returns HTTP 429 with error code `rate_limited` and a `Retry-After` header in integer seconds.
> — [Notion: Request limits](https://developers.notion.com/reference/request-limits), checked 2026-09-19.

Notion is the one source in this catalogue that tells us exactly how long to wait, so its connector is closed-loop: honour `Retry-After` and no fixed backoff table is needed.

Size limits from the same page, which the *export* side (PAP-422 round trip) must respect as much as the import side: 1000 block elements and 500 KB per payload; rich text 2000 characters; equations 1000; block and rich-text arrays 100 elements; URLs 2000 characters; emails and phone numbers 200; multi-select 100 options; relations 100 related pages per request; people arrays 100. Notion is explicit that these bound a single request, not total capacity — a relation can hold far more than 100 pages, we just add them 100 at a time.

### Pagination

`page_size` **default 100, maximum 100**; `start_cursor` takes the previous response's `next_cursor`; `has_more` says whether to continue. GET endpoints take these in the query string, POST endpoints in the body ([API reference](https://developers.notion.com/reference/intro), checked 2026-09-19).

Block content is itself paginated and recursive: a page is a tree of blocks, each of which may have children. Importing one Notion page is *n* requests, not one, and the 3/s floor on non-Enterprise plans is what actually sets our Notion throughput.

### Attachments

Files and images live as `file` blocks and `files` property values. Notion-hosted files come back as S3 URLs that are signed and short-lived; the exact TTL is **`unverified`** in public docs ([Notion file object](https://developers.notion.com/reference/file-object)). Externally hosted files (`external` type) carry a stable URL we may keep. Treat every `file`-type URL as expiring and download inside the page's processing window, exactly as for Airtable.

### Field-type mapping

Database property types from [Property object](https://developers.notion.com/reference/property-object) (checked 2026-09-19). Notion requires exactly one `title` property per data source.

| Notion property | PAP-164 type | Lossy | Note |
|---|---|---|---|
| `title` | `text` | no | the record's primary field |
| `rich_text` | `longText` | **yes** | annotations (bold, colour, inline links) flatten unless stored as Markdown |
| `number` | `number` | no | `format: dollar` etc. should map to `currency` when the format is a currency |
| `select` | `select` | no | |
| `multi_select` | `multiSelect` | no | |
| `status` | `select` | **yes** | the group structure (To-do / In progress / Complete) has no PAP-164 equivalent; use StateMapping |
| `date` | `date` | **yes** when a range | Notion dates may be ranges (`start` + `end`); PAP-164 `date` is a point, so ranges need two columns |
| `people` | `user` | **yes** | PeopleMatching; unmatched become placeholders |
| `files` | `attachment` | no | `external` files keep their URL; `file` files must be downloaded |
| `checkbox` | `checkbox` | no | |
| `url` | `url` | no | |
| `email` | `email` | no | |
| `phone_number` | `phone` | no | |
| `formula` | `formula` | **yes** | read-only at source; Notion formula dialect ≠ PAP-171 |
| `relation` | `relation` | no | the related database must be shared with the integration or the property reads empty |
| `rollup` | `rollup` | **yes** | read-only at source |
| `unique_id` | `text` | **yes** | prefix + number; sequence not transferable |
| `created_time` / `last_edited_time` | `date` | **yes** | read-only at source |
| `created_by` / `last_edited_by` | `user` | **yes** | read-only at source |
| `place` | — | **yes** | "place page property values are not fully supported via the API. Reading a place property returns `null`" — unrecoverable, report as a gap in the run |
| `verification` | `select` | **yes** | wiki verification state |
| `button` | — | **yes** | no PAP-164 target; dropped with a warning |

Page **content** (blocks) is a separate mapping problem owned by PAP-418/PAP-419 (Notion blocks to MDX); it is out of scope here.

### Known gaps

* **`place` reads as `null`** — data loss we cannot work around; the run report must name it.
* **Not-shared pages are invisible.** An integration only sees what has been explicitly shared with it. `discover()` must report "no access" per page rather than silently returning a short list — this is exactly the drift the PAP-813 health workflow watches for.
* **Archived pages.** Notion exposes `archived`/`in_trash` on pages. Decision for the importer: import archived pages as archived records rather than skipping them, so a round trip is faithful. Recorded here as the default; PAP-419 may override.
* **File URL TTL `unverified`.**
* **3 req/s floor** on non-Enterprise plans is the throughput ceiling for the whole Notion path.

---

## ClickUp

### Export formats

ClickUp exports a List/Table view to CSV or Excel from the view's menu, and offers a workspace-level export on higher plans. Precise per-plan availability and row caps are **`unverified`** against a stable public doc URL as of 2026-09-19; the API path is the supported one for import, and we do not rely on the UI export except for fixtures.

### API and auth

* REST v2, base `https://api.clickup.com/api/v2`.
* Two credential kinds ([Authentication](https://developer.clickup.com/docs/authentication), checked 2026-09-19):
  * **Personal API token**, prefix `pk_`, sent as `Authorization: {personal_token}` — **no `Bearer` prefix**. ClickUp states these "never expire".
  * **OAuth 2.0** authorization-code flow (`https://app.clickup.com/api` → `https://api.clickup.com/api/v2/oauth/token`), access token sent as `Authorization: Bearer {access_token}`. The docs say the access token "currently does not expire" but explicitly add "This is subject to change", and no refresh-token mechanism is described.

The missing-`Bearer` asymmetry is a real footgun: the same connector code must branch on credential kind. That branch is worth a unit test in the conformance suite (PAP-492 / the round-4 conformance harness).

> **Design note.** "Does not expire, subject to change" is not a guarantee we can build on. The shared connections layer (`r4/migration/source-oauth-connections-and-token-refresh`) should still model a ClickUp token as refreshable-in-principle so the day ClickUp adds expiry is a config change, not a rewrite.

### Rate limits

Per [Rate limits](https://developer.clickup.com/docs/rate-limits) (checked 2026-09-19), per token, per minute:

| Workspace plan | Requests/minute/token |
|---|---|
| Free Forever | 100 |
| Unlimited | 100 |
| Business | 100 |
| Business Plus | 1,000 |
| Enterprise / Enterprise Plus | 10,000 |

Breach returns HTTP 429. Unlike Airtable, ClickUp returns usable headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (Unix timestamp). The connector reads `X-RateLimit-Remaining` and paces itself, which means a Free workspace (100/min ≈ 1.67/s) is handled correctly without hard-coding the plan.

100 requests/minute is the tightest limit in this catalogue. A ClickUp import of any size is minutes-to-hours, and the progress UI must say so up front rather than appearing to hang.

### Pagination

Task listing is **page-index** based, not cursor based: `GET /list/{list_id}/task?page=0`, 100 tasks per page, and the response's `last_page` boolean signals the end. Page-index pagination over a mutating dataset can skip or duplicate rows if tasks are created during the run; the importer's external-id mapping (PAP-201) is what makes that safe, and the run report should note the count drift rather than claim exactness.

Incremental: `date_updated_gt` (Unix ms) filters to tasks changed since a cursor, which is the supported re-sync primitive. `include_closed=true` and `subtasks=true` are both off by default — forgetting either silently under-imports, so both belong in the connector's defaults with a dry-run line item.

### Attachments

Task attachments are returned on the task object with URLs. The URL lifetime is not published (**`unverified`**); assume signed and short-lived and download during the task page's window. Attachment *upload* is `multipart/form-data` on `POST /task/{task_id}/attachment`, relevant to the round-trip connector, not to import.

### Field-type mapping

Built-in task fields plus custom fields.

| ClickUp field | PAP-164 type | Lossy | Note |
|---|---|---|---|
| `name` | `text` | no | |
| `description` / `text_content` | `longText` | **yes** | ClickUp markup → Markdown conversion is owned by `r4/migration/clickup-connector-and-markup-mapping` |
| `status` | `select` | **yes** | status *type* (open/custom/closed) and per-list status sets need StateMapping |
| `priority` | `select` | no | urgent/high/normal/low |
| `assignees` / `watchers` | `user` | **yes** | PeopleMatching |
| `due_date` / `start_date` / `date_created` / `date_updated` / `date_closed` | `date` | no | Unix ms; `*_time` booleans say whether the time part is meaningful |
| `time_estimate` / `time_spent` | `number` | **yes** | milliseconds; no duration type in PAP-164 |
| `tags` | `multiSelect` | no | tag colours preserved as option colours |
| `parent` / `linked_tasks` / `dependencies` | `relation` | **yes** | dependency *kind* (waiting on / blocking) has no relation attribute in PAP-164 |
| `custom_field: text / short_text` | `text` | no | |
| `custom_field: number` | `number` | no | |
| `custom_field: currency` | `currency` | no | minor units into `Money` |
| `custom_field: date` | `date` | no | |
| `custom_field: drop_down` | `select` | no | |
| `custom_field: labels` | `multiSelect` | no | |
| `custom_field: checkbox` | `checkbox` | no | |
| `custom_field: url` | `url` | no | |
| `custom_field: email` | `email` | no | |
| `custom_field: phone` | `phone` | no | |
| `custom_field: rating` / `emoji` | `rating` | no | |
| `custom_field: users` | `user` | **yes** | PeopleMatching |
| `custom_field: attachment` | `attachment` | no | |
| `custom_field: list_relationship` | `relation` | no | |
| `custom_field: formula` | `formula` | **yes** | ClickUp dialect |
| `custom_field: progress (auto/manual)` | `percent` | **yes** | the auto-derivation rule is lost |
| `custom_field: location` | `text` | **yes** | no `geo` type in PAP-164 (it belongs to PAP-170); stored as formatted address plus lat/long text |
| `custom_field: automatic_progress` | `percent` | **yes** | |

### Known gaps

* **100 req/min on Free/Unlimited/Business** is the binding constraint for most real workspaces.
* **Some endpoints need a paid plan** (custom-field write, certain view endpoints). Record the plan in the run report and degrade rather than fail.
* **Page-index pagination** over live data; mitigated by external-id mapping, never eliminated.
* **Attachment URL TTL `unverified`.**
* **`include_closed` and `subtasks` default to false** — the single most likely cause of a "the import missed half my tasks" bug report.
* **UI export specifics `unverified`.**

---

## Monday

Monday's importer path is **CSV recipes, not a connector** (PAP-413). The API section below exists so that the recipe author knows what the alternative would have cost, and so a later connector does not have to redo the research.

### Export formats

Board export to Excel from the board menu; account-level exports on higher plans. Exact per-plan availability and caps are **`unverified`** against a stable public doc URL as of 2026-09-19. The CSV/Excel recipe in PAP-413 is written against a board export, so its column contract must be pinned by a committed fixture rather than by documentation.

### API and auth

* **GraphQL only**, single endpoint `https://api.monday.com/v2` ([Authentication](https://developer.monday.com/api-reference/docs/authentication), checked 2026-09-19).
* Auth is a **personal V2 API token** sent bare in the header — `Authorization: xxxxxxxx`, no `Bearer` — and the token "mirror[s] your monday.com UI permissions across boards, columns, items, and accounts." OAuth exists for apps but is not covered on that page.
* **Versioned by header.** `API-Version: 2026-07` is current; `2026-10` is the release candidate and `2026-04` is in maintenance. New RCs ship "every three months at the start of each quarter at 12:00 AM UTC"; a version is "stable for **at least six months**", with at least six months' deprecation notice ([API versioning](https://developer.monday.com/api-reference/docs/api-versioning), checked 2026-09-19).

The quarterly cadence is the part that matters to us: a Monday connector has a standing maintenance cost of one version bump every three to six months. That is a genuine argument for the CSV-recipe decision in PAP-413, and it belongs in the decision record.

### Rate limits

From [Rate limits](https://developer.monday.com/api-reference/docs/rate-limits) (checked 2026-09-19). Monday meters four independent things, and a connector can trip any of them:

| Meter | Limit | Error |
|---|---|---|
| Complexity budget | 10M points/min (personal token; 1M for trial/NGO/free); 5M/min per app token, read and write counted separately; 5M cap on any single query | `ComplexityException` |
| Daily calls | 1,000 Free/Standard/Basic; 10,000 Pro; 25,000 Enterprise — reset at midnight UTC | `DAILY_LIMIT_EXCEEDED` |
| Concurrency | 40 other tiers; 100 Pro; 250 Enterprise | `Concurrency limit exceeded` |
| Queries/minute | 1,000 other tiers; 2,500 Pro; 5,000 Enterprise | `Minute limit rate exceeded` |
| Per IP | "5,000 requests per 10 seconds" | `IP_RATE_LIMIT_EXCEEDED` |

**The daily call limit is the one that kills imports.** 1,000 calls/day on Free/Standard/Basic, against cursor pages of 500 items, caps a day's import at roughly 500k items *if every call is a perfect full page* and far less in practice once schema and column queries are counted. A mid-size board import on a Standard plan can consume a meaningful share of the account's daily API budget — which is a second, independent reason the CSV path is right for v0.1.

### Pagination

Cursor-based: `items_page(limit: 500, cursor: "…")` returns `cursor` for the next page, `null` at the end; 500 is the maximum page size. Because monday charges by complexity, deep nesting (board → items → column values → linked boards in one query) can breach the 5M single-query cap; the working pattern is shallow queries, more of them, which then runs into the daily call limit. That tension is the defining characteristic of the monday API.

### Attachments

Assets (`assets` on an item, file columns) expose `public_url` and `url`. TTL is **`unverified`**.

### Field-type mapping

Column types from [Column types reference](https://developer.monday.com/api-reference/reference/column-types-reference) (checked 2026-09-19). The API supports read and write on 26 column types; six are read-only; two are not reachable through `column_values` at all.

| Monday column | PAP-164 type | Lossy | Note |
|---|---|---|---|
| Name | `text` | no | the item's primary field |
| Text | `text` | no | |
| Long text | `longText` | no | |
| Numbers | `number` | no | |
| Status | `select` | **yes** | label index + colour; StateMapping |
| Dropdown | `multiSelect` | no | |
| Date | `date` | no | |
| Timeline | `date` | **yes** | a from/to range; needs two PAP-164 date columns |
| Week | `date` | **yes** | week granularity |
| Hour | `text` | **yes** | time-of-day only; no PAP-164 time type |
| People | `user` | **yes** | PeopleMatching; Person and Team columns are deprecated in favour of People |
| Email | `email` | no | |
| Phone | `phone` | no | |
| Link | `url` | **yes** | `{ url, text }`; the label text needs a second column |
| Checkbox | `checkbox` | no | |
| Rating | `rating` | no | |
| Tags | `multiSelect` | no | tags are account-global in monday, per-field in PaperOS |
| Files | `attachment` | no | |
| Connect boards | `relation` | no | |
| Dependency | `relation` | **yes** | dependency kind lost |
| Subitems | `relation` | **yes** | subitems are a separate board in monday; imported as a parent relation |
| Country | `select` | no | |
| Location | `text` | **yes** | no `geo` type in PAP-164 |
| World clock | `text` | **yes** | timezone name |
| Color picker | `text` | **yes** | hex value |
| Vote | `number` | **yes** | vote count; voter identities lost |
| monday doc | `longText` | **yes** | doc blocks flatten; see PAP-419-style block mapping if ever connectorised |
| Button | — | **yes** | no PAP-164 target |
| Formula | `formula` | **yes** | **read-only at source**; monday dialect |
| Mirror | `lookup` | **yes** | **read-only at source** |
| Progress tracking | `percent` | **yes** | **read-only at source**; derived |
| Item ID | `text` | **yes** | **read-only at source**; keep as the external id, not as a user column |
| Creation log / Last updated | `date` + `user` | **yes** | **read-only at source**; two PAP-164 columns |
| Auto number | `number` | **yes** | **not accessible through `column_values`** — "computed at render time"; recoverable only from a UI export |
| Time tracking | `number` | **yes** | read-only, limited API support; seconds |
| Integration | — | **yes** | "Managed by integrations; values cannot be set directly" |

**Auto number is the case that justifies the CSV recipe**: a column visible in the UI and in an Excel export simply is not in the API. Any board that keys on auto number can only be migrated through the export file.

### Known gaps

* **Daily call limit** (1,000 on the common plans) is a hard ceiling on connector-based import.
* **Auto number is API-invisible**; CSV export is the only route.
* **Quarterly API versions** carry standing maintenance cost.
* Export UI specifics and asset URL TTL **`unverified`**.

---

## HubSpot

Like Monday, HubSpot's v0.1 path is **CSV recipes** (PAP-413), with the CRM mapping consumed by PAP-188. The API is well documented enough that a connector is a later, low-risk addition.

### Export formats

CRM object lists export from the UI to CSV, XLS or XLSX and arrive by email as a download link. Exact row caps per tier are **`unverified`** against a stable public doc URL as of 2026-09-19; the recipe pins its column contract to a committed fixture.

### API and auth

* REST, base `https://api.hubapi.com`, CRM v3.
* Two credential kinds ([Intro to auth](https://developers.hubspot.com/docs/guides/apps/authentication/intro-to-auth), checked 2026-09-19): a **static access token** from a private app (single account) or **OAuth 2.0** (required for any app distributed to more than one account or listed in the marketplace). Both use `Authorization: Bearer {token}`. Scopes are declared in the app's configuration.
* Developer API keys are a separate credential for a handful of app-management endpoints, not for CRM data.

### Rate limits

From [API usage guidelines](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines) (checked 2026-09-19):

| Tier | Burst (per 10 s, per app) | Daily (per account) |
|---|---|---|
| Free & Starter | 100 | 250,000 |
| Professional | 190 | 625,000 |
| Enterprise | 190 | 1,000,000 |
| With API-limit-increase add-on | 250 | 1,000,000 (max two increases purchasable) |

Publicly distributed OAuth apps are capped at **110 requests every 10 seconds** per installing account, and the add-on does not apply to them. For private apps the burst limit is per app; the **daily limit is shared across every app in the account** — so an import competing with the customer's own integrations can exhaust a shared budget, and the run report must surface daily-remaining rather than just success/failure.

Headers are rich and closed-loop: `X-HubSpot-RateLimit-Daily`, `X-HubSpot-RateLimit-Daily-Remaining`, `X-HubSpot-RateLimit-Interval-Milliseconds`, `X-HubSpot-RateLimit-Max`, `X-HubSpot-RateLimit-Remaining`. A 429 body says whether the `DAILY` or the interval limit was breached; the daily counter resets at midnight in the account's timezone.

**CRM Search API** is metered separately and much harder: **5 requests per second**, a maximum of **200 objects per page**, and a hard cap of **10,000 total results per query** — paging past 10,000 returns a 400 ([Search the CRM](https://developers.hubspot.com/docs/api-reference/latest/crm/search-the-crm), [CRM Search API rate limit increase](https://developers.hubspot.com/changelog/crm-search-api-rate-limit-increase), checked 2026-09-19).

> The 10,000-result cap is the single most important HubSpot fact for us. Any tenant with more than 10,000 contacts **cannot** be imported by searching; the connector must use the plain list endpoints with `after` cursors, or shard a search by a monotonic field (`hs_lastmodifieddate` windows) and stitch the windows. Design PAP-199's HubSpot capability with `search` marked as a filter mechanism, never as the enumeration mechanism.

### Pagination

List endpoints: `limit` (default 100) plus an opaque `after` cursor returned in `paging.next.after`. Search: `limit` up to 200, `after` cursor, 10,000-result ceiling. Incremental sync uses `hs_lastmodifieddate` as the filter and sort key.

### Attachments

Files live in the Files API and on engagement (note/email) attachments, referenced by file id and fetched by a signed URL. TTL **`unverified`**.

### Field-type mapping

HubSpot properties carry both a `type` and a `fieldType`; the pair decides the mapping.

| HubSpot property type / fieldType | PAP-164 type | Lossy | Note |
|---|---|---|---|
| `string` / `text` | `text` | no | |
| `string` / `textarea` | `longText` | no | |
| `string` / `html` | `longText` | **yes** | HTML flattened unless stored as Markdown |
| `number` / `number` | `number` | no | |
| `number` (currency property, e.g. `amount`) | `currency` | no | portal currency; multi-currency deals also carry `deal_currency_code` — read both or the amount is ambiguous |
| `number` / `calculation_*` | `formula` | **yes** | HubSpot calculated properties are read-only and use their own syntax |
| `bool` / `booleancheckbox` | `checkbox` | no | |
| `enumeration` / `select` / `radio` | `select` | no | internal value ≠ label; keep the internal value as the option id |
| `enumeration` / `checkbox` (multi) | `multiSelect` | no | values are `;`-separated on the wire |
| `date` | `date` | no | midnight UTC; HubSpot rejects non-midnight values on `date` properties |
| `datetime` | `date` | no | epoch ms |
| `string` / `phonenumber` | `phone` | no | |
| `string` (email properties) | `email` | no | |
| `string` (url properties) | `url` | no | |
| `enumeration` / owner (`hubspot_owner_id`) | `user` | **yes** | owner ids need PeopleMatching against HubSpot owners, which are not portal users one-to-one |
| Associations (contact↔company↔deal↔ticket) | `relation` | **yes** | association *labels* and cardinality rules have no PAP-164 equivalent; carried as relation metadata or dropped |
| Pipelines and stages (`dealstage`) | `select` | **yes** | pipeline membership is a second dimension; StateMapping plus a pipeline column |
| Engagements (notes, emails, calls, meetings, tasks) | — | **yes** | not properties at all; they map to CRM activity records, owned by PAP-188 |
| File / attachment properties | `attachment` | no | via the Files API |
| Score properties (`hubspotscore`) | `number` | **yes** | the scoring rules do not transfer |
| Calculated rollups | `rollup` | **yes** | read-only at source |

### Known gaps

* **10,000-result search ceiling** — the defining constraint; see above.
* **Daily limit is account-wide**, shared with the customer's other integrations.
* **Public OAuth apps get 110/10 s** and cannot buy their way up.
* Export row caps and file-URL TTL **`unverified`**.
* Engagement history is a separate model from properties and is not covered by a property-level mapping.

---

## QuickBooks Online

### Export formats

QuickBooks Online exports reports and lists to CSV/Excel (and PDF for reports) from the UI, and the desktop line supports IIF. None of these are a faithful accounting export: a CSV of a report is a rendering, not a ledger. Specific per-report export options are **`unverified`** against a stable public doc URL as of 2026-09-19. **The API is the only defensible import path for QuickBooks**, because opening balances and a trial balance that ties (PAP-425) cannot be reconstructed from report CSVs.

### API and auth

* REST, base `https://quickbooks.api.intuit.com/v3/company/{realmId}` (sandbox: `https://sandbox-quickbooks.api.intuit.com`).
* **OAuth 2.0 only** — there is no token or key alternative. Access tokens are short-lived and refresh tokens rotate; the connector must persist the rotated refresh token on every exchange or it loses the connection. SDK `intuit-oauth` for the flow.
* The `realmId` (company id) is part of the path, not a header: a "connection" in our model is (tokens + realmId), not just tokens.
* Minor versions: the API takes a `minorversion` query parameter and Intuit ships minor versions on a monthly cadence ([Minor versions](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/minor-versions)). Pin one and bump it deliberately.

### Rate limits

* **500 requests per minute per realmId**, batch requests included.
* **10 concurrent requests per realmId**; exceeding it returns `HTTP/1.1 429 Too Many Requests`.
* — [API call limits and throttling](https://help.developer.intuit.com/s/article/API-call-limits-and-throttling) and [QuickBooks Online API best practices](https://help.developer.intuit.com/s/article/QuickBooks-Online-API-Best-Practices), checked 2026-09-19. These pages are JavaScript-rendered and could not be captured verbatim by our fetcher on 2026-09-19; the numbers above were read from Intuit's own indexed documentation text and are consistent across the developer hub and the help centre, but they are marked **verify-on-first-live-run** rather than quoted.

Per-realm limits mean concurrency is per customer company: importing two companies in parallel is fine, importing one company with 20 workers is not. The connector's pool is keyed by realmId with a hard cap of 10.

### Pagination

Queries use a SQL-like language: `SELECT * FROM Invoice STARTPOSITION 1 MAXRESULTS 1000`. `MAXRESULTS` **maxes out at 1000**; `STARTPOSITION` is 1-based ([Query operations and syntax](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries), checked 2026-09-19). The default when `MAXRESULTS` is omitted is **`unverified`** — always pass it explicitly. Because `STARTPOSITION` is an offset over a live ledger, always add a stable `ORDER BY Id` so pages do not shuffle.

**Incremental** is first class: `GET /v3/company/{realmId}/cdc?entities=<list>&changedSince=<dateTime>` returns everything changed since a timestamp, with a **look-back window of up to 30 days** (Intuit recommends shorter) and a **maximum of 1000 objects per CDC response**. CDC is supported for all objects except `JournalCode`, `TimeActivity`, `TaxAgency`, `TaxCode` and `TaxRate` ([Change data capture](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/change-data-capture), checked 2026-09-19).

The 30-day ceiling sets our re-sync policy: **a QuickBooks connection that has not synced for 30 days must do a full re-read**, and the scheduler (`r4/migration/scheduled-resync-and-sync-status`) should warn well before that.

### Attachments

Binary attachments are `Attachable` objects with an upload/download endpoint; they are not inline on transactions. Download URL behaviour is **`unverified`**.

### Field-type mapping

QuickBooks is not a table product, so the mapping is entity-to-entity, not column-to-column. It is recorded here because PAP-424 and PAP-425 need it and because `index.json` claims a mapping exists.

| QuickBooks entity / field | PaperOS target | Lossy | Note |
|---|---|---|---|
| `Account` | chart of accounts node | no | `AccountType` + `AccountSubType` map to our account classification |
| `Customer` / `Vendor` | CRM company or person | **yes** | QBO sub-customers (jobs) are a hierarchy PaperOS CRM may not mirror |
| `Item` | product/service item | no | inventory items also carry an asset account |
| `Invoice` / `Bill` / `Payment` / `JournalEntry` | ledger postings via `ledger.postEvent` | no | per the PAP-422 amendment: `source_type: 'import'`, `source_id: '<run_id>:<entry_number>'`, one `JournalDraft` per entry |
| Any monetary field | `Money` (`{ amountMinor, currency }`) | no | **never a float** — contracts §1 and the PAP-347 `parseCurrency` amendment; QBO returns decimals in JSON and they must be parsed with the PAP-175 ISO exponent table |
| `CurrencyRef` + `ExchangeRate` | `currency` + fx rate | **yes** | per the PAP-423 amendment, a rate computed from transaction amounts is never stored as a platform rate |
| `TxnDate` / `DueDate` | `date` | no | calendar dates, not instants |
| `CustomField` (3 per txn, string only) | `text` | no | QBO's custom fields are severely limited |
| `MetaData.CreateTime` / `LastUpdatedTime` | `date` | **yes** | read-only at source |
| `SyncToken` | — | n/a | optimistic-concurrency token; keep it in the external-id map for writes, never surface it |
| `Attachable` | `attachment` | no | separate download call per file |
| `TaxCode` / `TaxRate` | tax configuration | **yes** | jurisdiction-specific and **excluded from CDC**; full re-read each sync |

### Known gaps

* **Rate-limit numbers are verify-on-first-live-run** (JS-rendered docs, see above).
* **`MAXRESULTS` default `unverified`** — always pass it.
* **CDC excludes five entity types** including `TaxCode` and `TaxRate`.
* **CDC look-back is 30 days**, forcing a full re-read after a long pause.
* **Sandbox companies reset after inactivity**, which the PAP-813 reseed step must handle.
* **No non-OAuth credential**, so there is no "paste a token" path for a quick test — every QuickBooks fixture depends on NJ-13 item 5.

---

## Throughput at documented limits

Best case at the published limit, ignoring server latency and our own processing. Read these as *floors on elapsed time*, not estimates.

| Source | 10k rows | 100k rows | 1k attachments | Binding limit |
|---|---|---|---|---|
| Airtable | ~20 s (100 rows/req at 5 req/s per base) | ~3.3 min | ~3.3 min at 5 req/s | 5 req/s per base; files must land inside the 2 h URL window |
| Notion (non-Enterprise) | ~33 s for 10k *rows*, but a page tree is many requests: realistically ~1 h for 10k pages with blocks | ~10 h+ | ~5.5 min at 3 req/s | 3 req/s |
| Notion (Business/Enterprise) | ~10 s rows / ~20 min pages | ~3.5 h | ~1.7 min | 10 req/s |
| ClickUp (Free–Business) | ~100 min (100 tasks/req at 100 req/min) | ~16.7 h | ~10 min | **100 req/min** |
| ClickUp (Enterprise) | ~1 min | ~10 min | ~6 s | 10,000 req/min |
| Monday (Standard) | 20 calls of 500 items — trivial on rate, but against a **1,000 call/day** budget | 200 calls/day: 20 % of the daily budget | 1,000 calls = the entire daily budget | **daily call limit** |
| HubSpot (Professional) | ~9 s (100/req at 19 req/s) | ~1.5 min | ~53 s | burst 190/10 s; **search capped at 10k results** |
| QuickBooks Online | ~1.2 s (1000/req at 500 req/min) | ~12 s | ~2 min | 500 req/min, 10 concurrent, per realmId |

The three numbers that should drive product copy: **ClickUp on a non-Enterprise plan is hours**, **Notion on a non-Enterprise plan is hours**, and **Monday is budget-limited rather than time-limited**. The import wizard must show an estimate before the run starts, sourced from `index.json`, rather than a spinner.

---

## Cross-source findings

1. **Attachment URLs are the deadline, not the rate limit.** Airtable's 2 hours is the shortest documented window and the only one published at all; Notion, ClickUp, Monday and HubSpot all serve signed URLs with an undocumented TTL. The safe architecture is uniform: *fetch files in the same unit of work that fetched the record*, and make the resume checkpoint a record cursor, never a file URL. This should be a rule in the `SourceConnector` contract (PAP-199), not a per-connector choice.
2. **Three different throttle shapes.** Airtable gives no headers (open-loop), ClickUp and HubSpot give remaining-and-reset headers (closed-loop), Notion gives `Retry-After` (reactive), Monday meters four things at once, QuickBooks meters concurrency per company. A single "requests per second" field in `capabilities.rateLimit` is not enough; PAP-199 should model at least `{ perSecond?, perMinute?, perDay?, concurrent?, headers?: 'remaining'|'retry-after'|'none' }`.
3. **Read-only computed columns are everywhere** (formula, rollup, lookup, auto-number, created/updated logs) and they are always lossy. The mapping wizard (PAP-349) should default them to a **frozen value** import with a visible "will not recalculate" warning, rather than silently attempting to port a foreign formula dialect.
4. **Two sources hide data from their own API.** Monday's auto number is not in `column_values`; Notion's `place` returns `null`. Both need the UI export as a supplement, which is an argument for keeping the CSV recipe path (PAP-413, PAP-200) first-class rather than treating it as a legacy fallback.
5. **Header conventions differ in a way that will cause bugs.** ClickUp personal tokens and monday tokens are sent *bare*; Airtable, Notion, HubSpot and QuickBooks use `Bearer`. Put this in the conformance harness.
6. **Incremental support is uneven.** QuickBooks (CDC), HubSpot (`hs_lastmodifieddate`), Notion (`last_edited_time`) and ClickUp (`date_updated_gt`) all support it; Airtable only if the base happens to have a modified-time field; Monday only through a column. `index.json` records this as `yes | conditional | no` rather than a boolean.

## Known gaps in this pass

* **Three of the spec's nine sources are not covered here.** PAP-198's Scope names Xero, Linear and Google Sheets alongside the six in the issue title; this session's path allocation was the single research document plus the catalogue, and the six titled sources were researched to depth. Xero, Linear, Google Sheets (and the Stripe and CSV fixture sources) are recorded as `pending` in `index.json` and should be a follow-up issue rather than a thin section here. See the follow-up note in the changelog fragment.
* **Per-source sheets** (`docs/migration/sources/<source>.md`) are consolidated into this one document for this pass; `index.json` sits at the spec's path and is the machine-readable contract either way.
* **Fixtures** (`packages/import/fixtures/<source>/`) and **export-UI screenshots at 1280** are not produced here — both depend on the test accounts of work package 2 / PAP-813 and therefore on NJ-13.
* **Items marked `unverified` above** are, in one list: Airtable offset TTL and first-class incremental; Notion file URL TTL; ClickUp UI export specifics and attachment URL TTL; Monday export specifics and asset URL TTL; HubSpot export row caps and file URL TTL; QuickBooks `MAXRESULTS` default, attachment URL behaviour, and the rate-limit numbers pending a live-run confirmation.

## Needs Justin — NJ-13

Nothing in this document required an account, and nothing here is blocked. The sign-ups below are required for work package 2 (PAP-813): fixtures, seed scripts and the live half of every importer's integration tests. They are filed now because waiting on sign-ups is the long pole. **No account was created and no service was signed up for by this session.**

1. **Airtable** — workspace `PaperOS Test`, a Team trial (the attachment API needs a paid plan; if the trial lapses, document the plan cost or accept UI-export fixtures), PAT scoped to that workspace with `data.records:read|write`, `schema.bases:read|write`.
2. **Notion** — workspace `PaperOS Test`, an internal integration, root test page shared with it.
3. **ClickUp** — free workspace `PaperOS Test`, personal API token from Settings → Apps.
4. **Stripe** — test mode on the existing account (also NJ-10 for PAP-177), restricted key with read and write on customers, products, subscriptions, invoices, refunds.
5. **QuickBooks Online** — developer account, one sandbox company, app client id and secret, sandbox realm id. **No non-OAuth path exists**, so without this there is no QuickBooks test at all beyond recorded fixtures.
6. **Xero** — developer account; the demo company suffices, no paid org. It resets monthly, so fixtures must be pinned.
7. **Google Cloud** — project `paperos-test`, OAuth client (web) in testing mode with the Scout bot address as a test user, Sheets and Drive APIs enabled (also NJ-10 for PAP-224 and PAP-200).

**Default if no reply by 2026-09-24:** proceed with Stripe, Google and ClickUp (already needed elsewhere or free), record Airtable, Notion, QuickBooks and Xero as `skipped: no-credentials`, and keep the recorded-fixture path as their only test. Every importer's recorded-fixture tests pass regardless, so no issue is blocked by this ask.

## Change tracking

| Date | Change | By |
|---|---|---|
| 2026-09-19 | First pass: Airtable, Notion, ClickUp, Monday, HubSpot, QuickBooks Online researched against official docs; `index.json` created; Xero, Linear and Google Sheets left `pending`. | PAP-198 |

Every claim above carries a `checkedOn` of 2026-09-19. Re-verify before any connector ships: vendor limits change without notice (Airtable's attachment TTL and HubSpot's burst limits have both moved in the last two years), and a stale number in this table becomes a production incident in a connector.
