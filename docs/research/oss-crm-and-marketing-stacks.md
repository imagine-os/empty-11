# Open-source CRM and marketing stacks: reuse vs build

| | |
|---|---|
| Issue | [PAP-188](https://linear.app/paperos/issue/PAP-188/survey-open-source-crm-and-marketing-stacks-twenty-postiz-listmonk-dub) |
| Decision record | [ADR 0008 — CRM and marketing stack](../adr/0008-crm-marketing-stack.md) |
| Date of survey | 2026-09-19 (all citations accessed that day unless stated) |
| Rubric | [PAP-209](https://linear.app/paperos/issue/PAP-209) library evaluation rubric, extended (§2) |
| Licence policy | [PAP-211](https://linear.app/paperos/issue/PAP-211) tiers: allow / review / block |
| Consumers | PAP-190, PAP-191, PAP-194, PAP-197, PAP-202, PAP-206, PAP-401, PAP-485, PAP-803 |
| Sibling | [PAP-351](https://linear.app/paperos/issue/PAP-351) runs the compose spikes and scorecards; this document is the survey and the ADR input, PAP-351 is the measurement (§10) |

## 1. Summary

Six one-line answers; the paragraphs and their consequences are in [ADR 0008](../adr/0008-crm-marketing-stack.md).

| Domain | Candidate(s) | Decision | Shape | Owning issue |
|---|---|---|---|---|
| CRM records and pipelines | Twenty | **reject** running it; **borrow** its object model and UX | reimplement on the tables engine | PAP-187, PAP-189 |
| Social scheduling and publishing | Postiz | **borrow** its adapter shapes as reference; own the approval queue | reimplement, adapters ported by hand | PAP-190, PAP-401..403 |
| Email marketing and broadcasts | Listmonk | **reject** for v0.1 (single-tenant); Resend Broadcasts instead | provider behind our port | PAP-191, PAP-799 |
| Short links | Dub | **reject** self-hosting; optional **API adapter** behind our own `/l/:code` | run as a service, optional | PAP-803 |
| Support inbox | Chatwoot | **reject** for v0.1; **borrow** conversation model; only licence-viable `embed` fallback | reimplement | PAP-197, PAP-410..412 |
| Product / acquisition analytics | Umami, PostHog | **reject** both as dependencies; own first-party event table | reimplement (Umami as reference) | PAP-194 |
| Transactional + marketing email delivery | Resend, Postmark, SES | **Resend** primary, **SES** volume escape hatch, **Postmark** transactional-only fallback | provider behind PAP-191's port | PAP-191, PAP-370 |

The hypothesis in the PAP-188 spec is **confirmed in full**: build CRM and segments on the tables engine, borrow Postiz adapters behind our own approval queue, hold Listmonk in reserve behind Resend broadcasts, use Dub by API only, reject running Twenty. The survey adds two findings the hypothesis did not state: Chatwoot is the only candidate whose licence (MIT) leaves `fork` and `embed` genuinely open, and PostHog's self-host path is explicitly unsupported and single-project, which rules it out on tenancy before cost.

## 2. Method

Scored with the PAP-209 rubric, extended for whole products as PAP-188 requires. The rubric's six library criteria (license, maintenance, bundle size, accessibility, TypeScript quality, agent-friendliness) do not fit a product you run rather than import, so `bundle size` and `a11y` are recorded `n/a` and the seven product criteria below carry the score. They are scored **1 to 5** (PAP-188's scale; the PAP-209 0-4 anchors are mapped by adding one), weighted equally, with the PAP-209 evidence rule applied: **a 4 or 5 needs a dated citation in §11 or a spike observation from PAP-351**, and any criterion that could not be established from public evidence is scored down, never left blank (PAP-188: "unknowns become penalties").

| Criterion | 1 | 3 | 5 |
|---|---|---|---|
| **License fit** (PAP-211) | blocked tier (SSPL, Commons Clause, unlicensed) | review tier, `service` context only (AGPL-3.0) | allow tier everywhere (MIT, Apache-2.0, BSD) |
| **Self-host effort** | needs managed third-party SaaS we do not run | one extra Postgres plus one extra runtime | single binary or single container on the existing profile |
| **API completeness** for our flows | UI-only or partial | REST covering the main nouns, gaps in ours | every flow we need is documented and typed |
| **Tenant isolation** | one instance per tenant | app-level workspaces, shared DB | per-tenant isolation we can map onto `tenant_id` RLS |
| **TypeScript quality** | not TypeScript, no types published | TS with loose types or generated client only | TS end to end with a typed SDK |
| **Velocity** | archived or 12 months quiet | releases a few times a year | release within 90 days, company-backed |
| **Cost of exit** | data leaves only through the UI | documented export, our shapes need mapping | our own tables; nothing to exit |

Three integration shapes are costed per product, in agent-hours, on top of the score:

* **S1 run as a service** — deploy it, talk to it over its API, single sign-on from Better Auth, its database is not ours (PAP-211 `service` licence context).
* **S2 fork and embed** — vendor the code into the monorepo. AGPL-3.0 makes this a licence event for a hosted product, so it is `expected zero` per PAP-215 and needs Justin.
* **S3 reimplement on the tables engine** — build the feature on PAP-161 datasets, PAP-187 CRM tables and the PaperOS module system, studying the product as reference.

Hard gates applied before scoring (any fail forces `reject` for that shape): licence outside the PAP-211 allow tier without a waiver for anything that would ship **bundled**; no self-host path; no per-tenant isolation story; our primary Postgres shared with a foreign schema (PAP-188 edge case: never).

## 3. Matrix

Licence, mode, data-model fit with the PaperOS CRM entities (PAP-187), API, multi-tenancy, self-host cost and maintenance. RAM figures are third-party reports, not our own measurement — PAP-351 replaces them with `metrics.json` from real compose runs.

| Product | Version / release evaluated | Licence (PAP-211 tier) | Embed / fork / reimplement | Data-model fit with PAP-187 | API | Multi-tenancy | Self-host cost | Maintenance | Mode |
|---|---|---|---|---|---|---|---|---|---|
| **Twenty** | main, 2026-09-19 (57k stars) | AGPL-3.0 — review, `service` only | reimplement | high: person/company/opportunity/note/task ≈ `crm_contact`/`crm_company`/`crm_deal`/`crm_activity`; §5 maps it | REST + GraphQL auto-generated per workspace, plus a metadata API | workspace per tenant, isolated Postgres schema per workspace | ~4 vCPU / 8 GB reported; Postgres + Redis + worker; forward-only migrations | company-backed (Twenty.com PBC), very active | **reject (borrow)** |
| **Postiz** | v2.21.7, 2026-04-27 (36.1k stars) | AGPL-3.0 — review, `service` only | reimplement, adapters as reference | medium: post / integration / queue ≈ `social_post`/`social_account`/`social_post_target` (PAP-401) | public API + Node SDK, n8n and Make nodes | app-level orgs; no tenant isolation we can trust | Postgres + Redis + **Temporal** + Node 22 + object storage | active, single-vendor (Gitroom) | **reject (borrow adapters)** |
| **Listmonk** | v6.2.0, 2026-06-26 (23.5k stars) | AGPL-3.0 — review, `service` only | reimplement | medium: subscriber/list/campaign ≈ `crm_contact` + `crm_segment` + broadcast (PAP-799) | full REST behind the admin UI (basic auth, API user + token) | **single-tenant**: one instance per brand; SMTP, From, headers and archive are instance-global | single Go binary + Postgres — the cheapest candidate | active, effectively one maintainer | **reject (hold in reserve)** |
| **Dub** | main, 2026-09-19 (24.8k stars) | AGPL-3.0 core + `/ee` commercial — review, `service` only | run as a service (API only) | low: links and click events ≈ `attr_event` + short-link table (PAP-803) | REST API, typed SDKs, webhooks; 60 req/min on Free | workspaces on the hosted product; self-host is per-deployment | self-host needs PlanetScale-compatible MySQL + Upstash Redis + Tinybird + QStash: four managed services we do not otherwise run | very active, VC-backed | **reject self-host; optional API adapter** |
| **Chatwoot** | main, 2026-09-19 (36.9k stars) | MIT — allow | *embed viable*; we reimplement | high: conversation/message/contact ≈ `support_conversation`/`support_message`/`crm_contact` (PAP-197) | REST (application, platform and client APIs) | platform API creates accounts = tenants on one instance | Rails + Postgres + Redis + Sidekiq; heaviest ops of the MIT candidates | active, company-backed | **reject for v0.1 (borrow); embed is the fallback** |
| **Umami** | v3 line, 2026-09-19 (38.9k stars) | MIT — allow | reimplement (reference) | low: website/session/event ≈ `attr_event`/`attr_daily` (PAP-194) | REST + `/api/send` collector; documented | websites per user, one instance | single Node container + Postgres 12.14+; ~150-250 MB idle reported | active | **reject as dependency (reference)** |
| **PostHog** | open-source hobby, 2026-09-19 | MIT — allow | reimplement | low: events and persons ≈ `attr_event`/`attr_identity` | rich REST + client SDKs | **one project per instance** on the open-source build | Django + 2 Celery workers + plugin server + Postgres + Redis + ClickHouse + Kafka + Zookeeper + MinIO; ~32 GB guidance; self-host is officially unsupported and Kubernetes deploys were dropped in 2023 | very active upstream, unsupported downstream | **reject** |

### 3.1 Scores

Equal weights; `n/a` criteria (bundle, a11y) dropped and the rest rescaled, as PAP-209 requires. Total is the mean of the seven, to one decimal.

| Product | Licence fit | Self-host effort | API completeness | Tenant isolation | TS quality | Velocity | Cost of exit | **Total** | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Twenty | 3 | 2 | 5 | 4 | 5 | 5 | 2 | **3.7** | reject (borrow) |
| Postiz | 3 | 2 | 4 | 2 | 4 | 4 | 3 | **3.1** | reject (borrow adapters) |
| Listmonk | 3 | 5 | 4 | 1 | 1 | 4 | 4 | **3.1** | reject (reserve) |
| Dub (hosted API) | 3 | 5 | 5 | 3 | 5 | 5 | 4 | **4.3** | adapter, optional |
| Dub (self-hosted) | 3 | 1 | 5 | 2 | 5 | 5 | 3 | **3.4** | reject |
| Chatwoot | 5 | 2 | 4 | 4 | 2 | 4 | 3 | **3.4** | reject for v0.1 (borrow) |
| Umami | 5 | 4 | 3 | 2 | 4 | 4 | 3 | **3.6** | reference |
| PostHog | 5 | 1 | 5 | 1 | 4 | 5 | 3 | **3.4** | reject |

Two readings matter more than the totals. First, **no candidate clears the tenancy criterion the way PaperOS needs it**: our contract is one Postgres with `tenant_id` RLS (PAP-34) and one deployment for every tenant, and every product here answers tenancy with either a workspace concept inside its own database (Twenty, Chatwoot) or an instance per tenant (Listmonk, PostHog, Umami). Second, the scores rank *products*, and PaperOS is not buying a product: for CRM, social, campaigns and support the same data has to sit in the tables engine so segments (PAP-195), datasets (PAP-161), search (PAP-39), filters (PAP-279) and the agent surface work over it. That is what turns a mid-3 score into `reject (borrow)` rather than `trial`.

## 4. Per product

Each section records **what we take**, **what we never take**, the hours per shape, and the licence version actually evaluated (PAP-188 edge case).

### 4.1 Twenty (CRM)

AGPL-3.0, Twenty.com PBC, 57k stars on 2026-09-19. Every workspace gets an isolated Postgres schema and a REST + GraphQL API generated at runtime from workspace metadata, with a separate metadata API for objects, fields and relations; self-host is Docker Compose with forward-only migrations (`database:migrate:prod`) and reported 4 vCPU / 8 GB.

* **What we take.** The object model (person, company, opportunity, note, task, attachment, timeline activity) and its naming; the metadata-driven custom-field approach, which is what PaperOS's tables engine (PAP-161, PAP-164) already does in a first-party way; the record-page layout — tabs for timeline, notes, tasks, files — as reference for PAP-189 and PAP-333; the import CSV shapes for PAP-202.
* **What we never take.** Its runtime, its per-workspace schema generation (it is a second tables engine competing with ours), its GraphQL surface (PaperOS is oRPC, PAP-268), and any of its code in the monorepo (AGPL-3.0 in a `bundled` context is a PAP-211 block).
* **Hours.** S1 run as a service 24 h (deploy, SSO proxy, two-way sync with `crm_*`, the sync being most of it, and it never stops costing). S2 fork and embed 80 h+ and a licence event. S3 reimplement — already funded as PAP-187 and PAP-189; borrowing the model costs ~4 h of reading, which is this document plus the mapping in §5.
* **Gate.** Running Twenty means two systems of record for contacts; PAP-195 segments, PAP-194 attribution joins and PAP-202 imports would each need a bridge. This is the "duplicates the tables engine" rejection the spec hypothesised, and the survey confirms it.

### 4.2 Postiz (social scheduling)

AGPL-3.0, v2.21.7 on 2026-04-27, 36.1k stars. Covers Instagram, YouTube, LinkedIn, Reddit, TikTok, Facebook, Pinterest, Threads, X, Slack, Discord, Mastodon, Bluesky, Dribbble. Public API with a Node SDK, n8n and Make nodes. Stack is pnpm monorepo, NextJS + NestJS, Prisma/Postgres, **Temporal**, Resend for notifications.

* **What we take.** The per-platform adapter shape — validate, publish, fetch metrics, refresh auth — which PAP-402 already specifies in the same four methods; the per-platform limit table (X 280 chars, LinkedIn 3000, Instagram requires media, TikTok video-only, YouTube title under 100), which we encode in `validate`; the media-upload sequencing per platform (the part that is genuinely tedious); the set of platforms worth supporting first.
* **What we never take.** Its code (AGPL), its Temporal dependency (PaperOS has PAP-43 jobs and will not run a second workflow engine), and above all its scheduler: PaperOS's rule is that nothing leaves without an approved state and an approval hash (PAP-401), so the queue must be ours, in our database, auditable next to the outbound sandbox ledger (PAP-792).
* **Hours.** S1 run as a service 20 h and it breaks the approval rule (a second queue we do not control). S2 fork 60 h+, licence event, and we inherit Temporal. S3 reimplement: PAP-402 and PAP-403 already cost this; reading Postiz's adapters as reference saves an estimated 8-12 h of per-platform trial and error, which is the entire value of this candidate.
* **Note for PAP-190.** Postiz cannot be used to *test* publishing either: its adapters need real provider apps. Mock adapters plus recorded fixtures stay the gate (PAP-402 round-4 amendment).

### 4.3 Listmonk (campaigns)

AGPL-3.0, v6.2.0 on 2026-06-26, 23.5k stars. Single Go binary plus Postgres, Vue admin, every admin feature backed by a documented REST API (basic auth, API user + token) over subscribers, lists, campaigns, templates, media, CSV import, transactional messages and bounces. It is the cheapest thing to run in this survey.

* **The blocker is tenancy, not quality.** Listmonk is single-tenant: SMTP settings, From addresses, headers and the public archive are instance-global, and multi-tenancy is an open feature request, not a feature. Serving N PaperOS tenants means N instances, N Postgres databases and N upgrades — an ops cost that scales with customers, which is the one shape PaperOS's architecture refuses.
* **What we take.** The campaign/list/subscriber model as a sanity check on PAP-799 broadcasts; its bounce-processing design; its template variable conventions; its archive page as a reference for public campaign archives.
* **What we never take.** Its instance-global sender configuration, and the assumption that a list is a static thing — PaperOS segments are `FilterTree` (PAP-279) and dynamic by default (PAP-195).
* **Hours.** S1 run as a service 12 h for one instance, but multiply by tenants and add a provisioning story: effectively unbounded. S3 reimplement: PAP-799 already covers broadcasts on top of the PAP-404 outreach tables; incremental cost of broadcasts over sequences is ~16 h.
* **Re-open criteria.** If Resend's marketing product proves insufficient — per-tenant sending domains that Resend Audiences cannot isolate, contact-based pricing that exceeds email-based pricing at our volumes, or a need for a fully self-hosted send path for a customer with a data-residency requirement — Listmonk returns as a single-tenant appliance deployed per that customer, behind the same provider port.

### 4.4 Dub (short links)

AGPL-3.0 for the core with a commercial `/ee` enterprise directory — that split is the version we evaluated and is the exact licence fact PAP-188's edge case asks us to pin: **AGPL-3.0 + `/ee` commercial, as published on 2026-09-19**. Self-hosting is documented but assumes a PlanetScale-compatible MySQL, Upstash Redis, a Tinybird ClickHouse database for click events and QStash for jobs: four managed services outside our Postgres-and-Hetzner profile (PAP-25). The hosted API is capped at 60 requests/min per key on Free (25 links/month, 1,000 tracked events); the Business plan at $75/month gives 10,000 links/month, 250,000 events and 1,200 req/min.

* **What we take.** The link/click/event model and the idea of a conversion-tracking hop, as reference for PAP-803; the UTM builder UX; the QR-with-analytics pattern.
* **What we never take.** Its self-hosted stack (MySQL is not our database; Tinybird is not our analytics store), and dependence on its hosted service for anything on a critical path — a short link that stops resolving when a vendor bill lapses is a broken print campaign.
* **Decision shape.** First-party `/l/:code` redirects on our own tables, writing `attr_event` (PAP-194) directly, with an **optional** Dub adapter behind a `ShortLinkPort` for tenants who already live in Dub. That is exactly PAP-803's scope, so this survey confirms rather than changes it.
* **Hours.** S1 API adapter 6 h. S1 self-host 24 h plus four vendor accounts. S3 first-party redirects 16 h (already PAP-803).

### 4.5 Chatwoot (support inbox)

MIT, 36.9k stars, Rails + Postgres + Redis + Sidekiq. MIT puts it in the PAP-211 allow tier, so unlike every AGPL candidate it is the one product PaperOS *could* fork or embed without a licence event.

* **What we take.** The conversation/message/contact model, which maps almost one-to-one onto PAP-197's `support_conversation` / `support_message` / `crm_contact`; the contact-matching ladder (exact email, plus-address stripped, then domain-to-company) — PAP-197 already specifies the same ladder and Chatwoot's production experience validates it; canned replies; the agent/team assignment model; the help-centre structure for PAP-805.
* **What we never take.** Rails and Sidekiq in our ops surface; its own auth and agent identity (PaperOS identity is Better Auth, PAP-56); its widget's styling assumptions (PAP-411 is our portal widget, themed by PAP-74).
* **Hours.** S1 run as a service 32 h (deploy, platform-API tenant provisioning, SSO, contact sync back to `crm_contact`, widget theming). S2 fork 80 h+ but licence-clean. S3 reimplement: PAP-410..412 already cost this.
* **Fallback.** This is the only candidate whose rejection is a *scheduling* call rather than an architectural one. If PAP-197's children slip past the v0.2 window and a tenant needs a support inbox sooner, embedding Chatwoot per the PAP-215 embed-contract template (SSO, API surface, tenant mapping via the platform API, theming, export path, owner) is licence-viable and should be reconsidered rather than rushed in-house. Recorded as a re-open criterion in the ADR.

### 4.6 Umami and PostHog (analytics)

**Umami**: MIT, 38.9k stars, single Node container plus Postgres 12.14+ (Node 18.18+), explicitly cookieless, reported ~150-250 MB idle. **PostHog**: MIT for the open-source build, but the self-host path is a Docker Compose "hobby" deployment that is **limited to one project per instance**, described by PostHog as officially unsupported, with Kubernetes deployments dropped in 2023; a realistic deployment runs Django, two Celery workers, a plugin server, Postgres, Redis, ClickHouse, Kafka, Zookeeper and MinIO, with guidance around 32 GB of RAM.

* PostHog fails the tenancy gate before cost: one project per instance means one instance per tenant, and its own documentation disclaims self-hosted support. Reject.
* Umami passes licence and ops comfortably but solves a different problem: page analytics for websites, not the identity stitching, first/last-touch attribution and revenue join PAP-194 needs against `crm_contact` and `fin_party`. Running it would add a second event store that cannot answer "which campaign produced this paying customer".
* **What we take from Umami.** The cookieless collector design (no cookie, hashed salt rotated daily, UA reduced to a class) — PAP-194 already specifies the same; its dashboard information architecture as reference for the PAP-194 report blocks.
* **Decision.** Own event table (PAP-194) under the privacy-first rule. Umami remains a `reference` registry entry, PostHog a `rejected` one. Re-open if PaperOS ever needs session replay or product-analytics funnels beyond the acquisition reports, at which point PostHog **Cloud** (not self-host) is the comparison, with a data-protection review.

## 5. Data-model mapping to PAP-187 (for the PAP-202 and PAP-206 importers)

These tables are the importer contract. PAP-188's interface contract names PAP-202 (Airtable) and PAP-206 (Stripe) as the consumers, but none of the products surveyed here has a connector issue of its own today: in practice these mappings are consumed through the import framework (PAP-199, PAP-347 connector interface and mapping model) by the CSV and Sheets connector (PAP-200, which is how a Twenty, Listmonk or Chatwoot export actually arrives) and by PAP-413 for HubSpot. A dedicated "CRM product connectors" issue is proposed as a follow-up. Left column is the foreign system's field, right column is the PaperOS field from PAP-187 / PAP-197 / PAP-401. Every import writes `crm_external_ref (system, external_id, entity)` so re-imports are idempotent and a later migration back out is possible (PAP-187 provides the table).

### 5.1 Twenty → PaperOS CRM

| Twenty object / field | PaperOS table.field | Note |
|---|---|---|
| `person.name.firstName` / `.lastName` | `crm_contact.first_name` / `.last_name` | |
| `person.emails.primaryEmail` | `crm_contact.email` (citext, unique per tenant) | additional emails → `crm_contact.custom.emails[]` |
| `person.phones.primaryPhoneNumber` | `crm_contact.phone` | normalise to E.164; Twenty stores calling code separately |
| `person.jobTitle` | `crm_contact.title` | |
| `person.city`, `person.avatarUrl`, `person.linkedinLink`, `person.xLink` | `crm_contact.custom` | no first-class columns in PAP-187 |
| `person.companyId` | `crm_contact.company_id` | plus a `crm_contact_company` row (PAP-187 supports history) |
| `person.createdBy` | `crm_contact.created_by` | map to a human or agent principal; unknown → importer principal |
| `company.name` | `crm_company.name` | |
| `company.domainName` | `crm_company.domain` (citext, unique per tenant) | |
| `company.employees` | `crm_company.size_band` | bucket the integer |
| `company.address` | `crm_company.address jsonb` | |
| `company.annualRecurringRevenue`, `company.idealCustomerProfile` | `crm_company.custom` | |
| `opportunity.name` | `crm_deal.title` | |
| `opportunity.amount` (micros) | `crm_deal.amount_minor` + `currency` | Twenty stores `amountMicros`; divide by 10 000 for minor units, never float |
| `opportunity.closeDate` | `crm_deal.expected_close_date` | |
| `opportunity.stage` | `crm_deal.stage_id` | map by name into the seeded default pipeline; unknown stage → new `crm_pipeline_stage` at the end, `kind: open` |
| `opportunity.pointOfContactId` | `crm_deal.primary_contact_id` | |
| `opportunity.companyId` | `crm_deal.company_id` | |
| `note`, `task`, `timelineActivity` | `crm_activity` with `kind: note|task|system` | `about_type`/`about_id` from the target; `body_json` keeps the rich text |
| `task.dueAt`, `task.status` | `crm_activity.due_at`, `.completed_at` | `status: DONE` → `completed_at` |
| `attachment` | files (PAP core) + `crm_activity` link | |
| custom objects and fields | tables-engine records (PAP-164 `custom jsonb` or a table) | decided per import, not automatically |
| (no equivalent) | `crm_contact.lifecycle`, `.consent`, `.do_not_contact`, `email_status` | Twenty has no consent model: imports default to `lifecycle: lead`, consent **absent**, so `canContact` refuses marketing until a consent record exists (PAP-187 WP0) |

The gap in the last row is the important one for PAP-202: **no imported contact may be treated as consented.** HubSpot exports carry a subscription status and can seed consent records with evidence; Twenty exports cannot.

### 5.2 Chatwoot → PaperOS support (PAP-197)

| Chatwoot | PaperOS | Note |
|---|---|---|
| `inbox` | `support_mailbox` | one mailbox per inbox; channel type decides `channel` |
| `conversation.status` (`open|resolved|pending|snoozed`) | `support_conversation.status` | same four values |
| `conversation.assignee_id` | `.assignee_user_id` | map agents to PaperOS users |
| `conversation.labels` | `.tags` | |
| `message.message_type` (`incoming|outgoing|activity|template`) | `support_message.direction` (`inbound|outbound|note`) | `activity` → system note |
| `message.private` | `direction: note` | |
| `message.source_id` | `.provider_message_id` (unique) | dedupe key on re-import |
| `contact.email` / `.phone_number` | `crm_contact.email` / `.phone` | matched with PAP-197's ladder |
| `csat_survey_response` | PAP-804 survey response | v0.2 |

### 5.3 Listmonk → PaperOS campaigns (PAP-404 / PAP-799)

| Listmonk | PaperOS | Note |
|---|---|---|
| `subscriber.email`, `.name`, `.attribs` | `crm_contact.email`, names, `.custom` | |
| `subscriber.status` (`enabled|blocklisted`) | consent record + `suppression_entry` | `blocklisted` → suppression with `reason: unsubscribe` |
| `subscriber_lists.subscription_status` (`unconfirmed|confirmed|unsubscribed`) | `consent_record.status` (`pending_double_opt_in|granted|withdrawn`) | direct mapping; keeps double opt-in evidence |
| `list` (single opt-in / double opt-in) | `crm_segment` (`mode: static`) + `consent_purpose` | Listmonk lists are audiences *and* consent scopes; PaperOS separates them |
| `campaign` | PAP-799 broadcast | |
| `template` | `outreach_template` | |
| `bounce` | `suppression_entry` (`hard_bounce`) + `outreach_message.events` | |

### 5.4 Postiz → PaperOS social (PAP-401)

| Postiz | PaperOS | Note |
|---|---|---|
| `integration` (provider, token, refresh) | `social_account` (`platform`, `oauth jsonb` encrypted) | tokens re-authorised, never imported |
| `post` + `post.state` | `social_post.status` | Postiz has no approval state: every imported post lands `draft`, never `approved` |
| `post.releaseURL`, per-integration child post | `social_post_target.external_post_id` | |
| `tags`, `customer` | `social_campaign` | |

### 5.5 Dub / Umami → attribution (PAP-194, PAP-803)

| Source | PaperOS | Note |
|---|---|---|
| Dub `link` (`key`, `url`, `domain`, UTM fields) | short-link row (PAP-803) | `key` → `/l/:code`; collisions resolved by suffix |
| Dub `click` event | `attr_event` (`name: link_clicked`) | Dub retains clicks per plan; our retention is 13 months by partition (PAP-194) |
| Umami `website_event` | `attr_event` | `url_path` → `landing_path`, `referrer_domain` → `referrer_host` |
| Umami `session` | `attr_event.session_id` + `device_class` | Umami's session hash is not portable; sessions restart at import |

## 6. Deliverability: Resend vs Postmark vs SES

Feeds PAP-191 (sequences), PAP-197 (inbound support email), PAP-370 (transactional package) and PAP-799 (broadcasts).

| | Resend | Postmark | Amazon SES |
|---|---|---|---|
| Transactional | yes | yes, its speciality, with Message Streams separating transactional and broadcast reputations | yes |
| Marketing / broadcasts | yes — Broadcasts API with Audiences, HTML, text or React | **no: marketing blasts and cold outreach are not allowed** | yes |
| Cost at 100k emails/month | ~$35 (Pro) or $90 (Scale) | ~$50 | ~$10 ($0.10 per 1,000) |
| Marketing billing | separate product, **per contact** — from $40/month for 5,000 contacts | n/a | per email |
| Dedicated IP | +$30/month (Scale) | included on higher plans | $24.95/month standard, managed from $15/month |
| Warmup | managed | managed | self-managed; every new account starts in sandbox and production access needs a written request with use case, volume and bounce handling |
| Inbound parsing | inbound on every plan; parsing is a webhook you handle | inbound webhook with parsed JSON | receipt rules → S3/SNS/Lambda, you parse MIME |
| DX | typed SDK, React Email, webhooks, batch, scheduled sends | mature SDKs, best-in-class analytics | raw AWS, most work |

**Decision.** Resend is the primary provider for transactional (PAP-370) and broadcasts (PAP-799) because one provider covers both behind PAP-191's `send / verifyWebhook / parseEvent / parseInbound` port, its inbound feature serves PAP-197's support mailbox, and the SDK matches our TypeScript surface. SES is the documented escape hatch for volume — at 100k+/month the cost difference is roughly 4x and the port makes the swap a config change — accepted with the cost of running our own warmup, bounce and complaint handling (PAP-191 already specifies warmup caps 20/50/100/250/500/1000 per day, bounce >2 %, complaints >0.1 %, so the logic exists regardless of provider). Postmark is the fallback for **transactional only**, chosen if Resend's transactional reputation disappoints; it can never be the single provider because its terms exclude marketing sends. Two operational rules follow: marketing and transactional always travel on separate streams/domains whoever the provider is, and the tenant-facing sending domain wizard (PAP-406) must be provider-agnostic because the DNS records differ per provider.

**Warmup and inbound consequences for PAP-191 and PAP-197.** A new sending domain starts at the lowest cap regardless of provider; the ramp is ours, in `sending_domain.warmup_stage`. Inbound is a webhook in all three cases, so PAP-197 parses MIME itself in every world — and the round-4 amendment stands that inbound fixtures include a prompt-injection payload wrapped as T3 untrusted content before any agent reads it.

## 7. Analytics under the privacy-first rule

| Option | Licence | Ops | Tenancy | Verdict |
|---|---|---|---|---|
| Own `attr_*` tables (PAP-194) | ours | none beyond Postgres partitions | `tenant_id` RLS, native | **chosen** |
| Umami | MIT | one container + Postgres, ~150-250 MB idle | websites per instance, no tenant RLS | reference only |
| PostHog self-hosted | MIT | 8+ services, ~32 GB guidance, unsupported, 1 project/instance | fails | reject |
| PostHog Cloud | SaaS | none | fine | out of scope: a third-party tracker contradicts PAP-194's privacy-first rule; revisit only for session replay, with a DPA |

The decisive argument is not cost: it is the join. PAP-194 must answer "which channel produced this paying customer", which needs `attr_touch.contact_id` → `crm_contact.party_id` → `fin_party` and `invoice.paid` postings (PAP-397, round-4 amendment). No external analytics product can make that join without exporting our customer graph into it.

## 8. Platform OAuth app-review lead times (for PAP-190 / PAP-403)

File the applications now; they are the long pole in social publishing, not the code. Figures are public reports gathered 2026-09-19, not our own experience — record actuals on PAP-190 as they arrive.

| Platform | What must be approved | Reported lead time | Start when |
|---|---|---|---|
| **Meta (Instagram, Facebook)** | App Review for `instagram_content_publish`, `instagram_manage_messages`, business verification | **2-4 weeks**, first submissions frequently rejected | immediately; needs a working demo and screen recording |
| **YouTube (Data API)** | quota/audit review beyond the default 10,000 units/day; uploads and searches bill to their own daily buckets since 2026-06-01 | **2-6 weeks** | immediately if publishing video |
| **LinkedIn** | Community Management API, Development → Standard tier: access form, screen recording, test credentials, commercial use case | weeks; gated on a reviewed application | immediately; assemble the recording first |
| **TikTok** | Content Posting API audit (sandbox → audited) | **2 days to 2 weeks**, inconsistent outcomes | after the sandbox flow works |
| **X** | developer account plus Read-and-Write app permission; pay-per-use is the default for new developers ($0 base, per-call charges; legacy Basic $200/month closed to new signups and migrated after 2026-06-01) | account and key in ~15 minutes; complex use cases hours to days | when PAP-402 needs a live smoke; **budget line, not a lead-time risk** |

Two consequences. First, PAP-190's schedule should assume **six weeks** before Meta and YouTube publishing can be demonstrated live, which is another argument for the mock-adapter-plus-fixture merge gate. Second, X is now a per-call cost rather than a subscription, so the sandbox ledger (PAP-792) should record attempted X publishes with their price so a tenant's spend is visible before it happens.

## 9. Licence review (PAP-211) — for Sentinel

| Product | SPDX | Tier | Context if used | Obligation if we ever ship it |
|---|---|---|---|---|
| Twenty | AGPL-3.0 | review | `service` only | running a modified instance as a network service obliges publishing our modifications; vendoring into `apps/*` is a **block** |
| Postiz | AGPL-3.0 | review | `service` only | same; adapter *knowledge* is not a derivative work, adapter *code* copied in would be — PAP-402 adapters are written against the platform APIs, not Postiz source |
| Listmonk | AGPL-3.0 | review | `service` only | same; an appliance instance per tenant, unmodified, is the clean shape |
| Dub | AGPL-3.0 core + `/ee` commercial | review | `service` only, hosted API preferred | the `/ee` directory is not open source: a self-host must exclude it, and API use is unaffected |
| Chatwoot | MIT | allow | any | attribution in `THIRD_PARTY_NOTICES.md`; trademark/branding terms to confirm before any white-label embed |
| Umami | MIT | allow | any | attribution only |
| PostHog | MIT (open-source build) | allow | any | attribution only; paid features live under separate terms |

**Decision consequence:** because every chosen shape is `reject`, `borrow` or `API adapter`, **no AGPL waiver is needed for v0.1** and nothing AGPL enters `bundled`. If Chatwoot is ever embedded (§4.5 fallback), it is MIT and needs only notices. Sentinel's approval is therefore over the *policy application*, not over a live obligation. **Open item:** the PAP-211 waiver file is unnecessary today, so PAP-188 files none; PAP-351's spike lockfiles are the first place an AGPL dependency could sneak in and the `licenses` CI job covers it.

## 10. Gaps in this survey (what PAP-188 did not deliver and who does)

Honest accounting against PAP-188's Definition of done:

| Item in DoD | Status | Where it goes |
|---|---|---|
| `spikes/growth-stack/` compose files, screenshots at 1280 and 1920, API smoke scripts, `metrics.json`, `results.json` | **not delivered** — no Docker daemon in this session (`/var/run/docker.sock` absent) and no staging host (PAP-25 is unbuilt) | **PAP-351** already owns exactly these four products with compose, metrics, screenshots and scorecards; this document is its cross-linked survey input (PAP-351 Spec: "cross-link PAP-188 findings; do not repeat them") |
| Comparison table rendered from `results.json` | superseded — table in §3 is hand-built from public evidence | PAP-351 regenerates it from measured scorecards; PAP-209's `pnpm lib score` renders the Alternatives table |
| Zod-validated `results.json`, recomputed rubric totals | **not delivered** (no `packages/spec` yet: PAP-209 unbuilt) | PAP-209 provides `ScorecardSchema` and the CLI; PAP-351 writes the scorecards |
| AGPL review approved by Sentinel | drafted in §9, approval pending | review pass on this issue |
| Registry entries for PAP-215/PAP-216 | listed in ADR 0008 §Registry, files not created (registry does not exist yet) | PAP-216 |
| Cross-reference comments on PAP-190, PAP-191, PAP-194, PAP-197 | posted with this issue's session-ended comment | this issue |
| Screenshots of each candidate | **not delivered** (no Docker) | PAP-351 |

All figures marked "reported" in §3 are third-party claims and are scored conservatively per §2's unknown-penalty rule; PAP-351 replaces them with measurements. **No decision in ADR 0008 depends on a number only a spike can produce:** each rejection rests on licence tier, tenancy architecture or the tables-engine duplication argument, all of which are established from documentation.

## 11. Citations

All accessed 2026-09-19.

* Twenty — repository and README (57k stars, self-host via Docker Compose): https://github.com/twentyhq/twenty
* Twenty — APIs (auto-generated REST + GraphQL, Core and Metadata APIs): https://docs.twenty.com/developers/extend/api
* Twenty — self-hosting: https://docs.twenty.com/developers/self-hosting
* Twenty — AGPL-3.0, per-workspace Postgres schema, 4 vCPU / 8 GB, forward-only migrations (measurement dated 2026-05-01): https://use-apify.com/docs/self-hosted/crm-and-gtm/twenty-crm and https://railway.com/deploy/twenty-open-source-salesforce-alternative-crm--twenty-salesforce-alternative
* Postiz — repository (AGPL-3.0, 36.1k stars, platform list, public API, NestJS/Prisma/Temporal/Postgres): https://github.com/gitroomhq/postiz-app
* Postiz — v2.21.7 released 2026-04-27; self-host stack (Postgres, Redis, Temporal, Node 22, S3): https://teqvolt.com/open-source/postiz-29-6k-star-open-source-social-scheduler-buffer-alternative
* Listmonk — repository and site (AGPL-3.0, 23.5k stars, single Go binary + Postgres): https://github.com/knadh/listmonk and https://listmonk.app/
* Listmonk — v6.2.0 released 2026-06-26: https://woodpecker.co/blog/listmonk/
* Listmonk — REST API coverage: https://listmonk.app/docs/
* Listmonk — multi-tenancy is an open feature request (issue #2872), instance-global SMTP/From/archive: https://github.com/knadh/listmonk/issues/2872
* Dub — repository (AGPL-3.0 core + `/ee` commercial, 24.8k stars, Upstash/Tinybird/PlanetScale/Vercel stack): https://github.com/dubinc/dub
* Dub — self-hosting guide (PlanetScale-compatible MySQL, Upstash Redis, Tinybird, QStash): https://dub.co/docs/self-hosting
* Dub — API rate limits (60 req/min Free): https://dub.co/docs/api-reference/rate-limits
* Dub — plan limits (Free 25 links/1,000 events; Business $75/month, 10,000 links, 1,200 req/min): https://linklyhq.com/review/dub
* Chatwoot — repository and README ("Released under the MIT License", Rails/Postgres/Redis/Sidekiq, 36.9k stars): https://github.com/chatwoot/chatwoot
* Umami — repository (MIT, 38.9k stars, Node 18.18+, Postgres 12.14+, cookieless): https://github.com/umami-software/umami
* Umami vs PostHog resource comparison (~150-250 MB idle vs ClickHouse/Kafka and ~32 GB guidance): https://blog.elest.io/umami-vs-posthog-which-self-hosted-analytics-in-2026/
* PostHog — self-host docs and open-source disclaimer (MIT, Docker Compose hobby, one project per instance, unsupported, Kubernetes dropped 2023): https://posthog.com/docs/self-host and https://posthog.com/docs/self-host/open-source/disclaimer
* Resend — Broadcast API and Audiences: https://resend.com/blog/broadcast-api
* Resend — pricing (Pro $35 / Scale $90 at 100k; marketing billed per contact from $40/5,000; inbound on every plan; dedicated IP +$30): https://flexprice.io/blog/detailed-resend-pricing-guide and https://resend.com/docs/knowledge-base/what-is-resend-pricing
* Postmark — transactional only, Message Streams, ~$50 at 100k: https://www.courier.com/integrations/compare/amazon-ses-vs-postmark and https://www.buildmvpfast.com/blog/resend-vs-ses-vs-postmark-transactional-email-deliverability-saas-2026
* Amazon SES — $0.10/1,000, dedicated IP $24.95/month (managed from $15), sandbox and production access request: https://www.buildmvpfast.com/blog/resend-vs-ses-vs-postmark-transactional-email-deliverability-saas-2026
* Meta App Review 2-4 weeks; TikTok audit 2 days-2 weeks; YouTube review 2-6 weeks and the 2026-06-01 quota change; LinkedIn Community Management API Standard-tier gate: https://www.socialcrawl.dev/blog/ultimate-guide-social-media-apis-2026 and https://posteverywhere.ai/blog/how-to-get-social-media-api-access and https://www.getphyllo.com/post/social-media-api-guide-on-top-apis-for-developers
* LinkedIn partner-programme approval reality: https://www.getphyllo.com/post/linkedin-api-access-in-2026-partner-program-approval-timeline-alternatives
* X API — pay-per-use default for new developers, legacy Basic $200/month closed and migrated after 2026-06-01, Read-and-Write permission required to post, key in minutes: https://postproxy.dev/blog/x-api-pricing-2026/ and https://docs.x.com/x-api/getting-started/getting-access

Sources are third-party where a vendor page did not state the fact; each is dated by access and none is load-bearing for a decision on its own (§10).

**Link check, 2026-09-19.** All 36 URLs in this document were requested: 28 returned 200. The seven `github.com` URLs answer 403 to this session's outbound proxy (GitHub API and HTML access is restricted here; their content was read through the fetch tool and is quoted above) and `linklyhq.com` answered 429 (rate limit). No dead links.
