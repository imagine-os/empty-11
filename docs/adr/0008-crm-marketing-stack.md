# 0008. CRM and marketing stack — what PaperOS borrows and what it builds

* Status: Proposed — accepted when Atlas and Beacon approve and Sentinel signs off the Licence review section
* Date: 2026-09-19
* Issue: [PAP-188](https://linear.app/paperos/issue/PAP-188)
* Deciders: Atlas (decision), Beacon (CRM Builder), Sentinel (licences)
* Authors: Scout (Library Evaluator) with Beacon
* Research: [`docs/research/oss-crm-and-marketing-stacks.md`](../research/oss-crm-and-marketing-stacks.md)
* Affects: PAP-187, PAP-189, PAP-190, PAP-191, PAP-194, PAP-197, PAP-202, PAP-206, PAP-401, PAP-485, PAP-799, PAP-803
* Supersedes: none

## Context

The growth module (PAP-187 to PAP-197, PAP-401 to PAP-412, PAP-790 to PAP-812) covers ground that mature open-source products already cover: CRM records and pipelines (Twenty), social scheduling (Postiz), newsletters and campaigns (Listmonk), short links (Dub), a support inbox (Chatwoot) and product analytics (Umami, PostHog). Before any growth code is written we have to say, once, which of these PaperOS runs, forks, borrows from or rejects, so that fifteen downstream issues stop re-deciding it and so that licence obligations are known before code lands.

Three PaperOS constraints frame every answer, and they are architectural rather than a matter of taste:

1. **One deployment, one Postgres, `tenant_id` RLS** (PAP-34). PaperOS serves every tenant from one instance. A product whose tenancy story is "run one instance per customer" adds ops cost that scales with sales.
2. **The tables engine is the data layer** (PAP-161, PAP-164, PAP-279). Segments (PAP-195), datasets, saved views, search (PAP-39), filters, the agent surface and the page-spec system all work over records in our own tables. Data that lives in a foreign product's database is invisible to all of it.
3. **Nothing leaves without an approved state** (PAP-401, Security Model §4). Outbound email, SMS and social posts pass our approval queue and are recorded in the outbound sandbox ledger (PAP-792). A product with its own scheduler and its own send path is a second, unaudited exit.

The survey behind this ADR — scores, three costed integration shapes per product, field-level data-model mappings, deliverability and analytics comparisons, OAuth review lead times and dated citations — is [`docs/research/oss-crm-and-marketing-stacks.md`](../research/oss-crm-and-marketing-stacks.md). Licence tiers come from PAP-211 (allow / review / block); scoring follows PAP-209 extended for whole products.

## Decision

Six decisions, one paragraph each.

**1. CRM: build on the tables engine; reject running Twenty; borrow its model.** PaperOS models contacts, companies, leads, deals, pipelines, activities and segments as its own tables (PAP-187) and builds the pipeline and contact surfaces on the tables engine (PAP-189). Twenty scores well — AGPL-3.0, company-backed, 57k stars, an auto-generated REST and GraphQL API per workspace and a genuinely isolated Postgres schema per workspace — and it is rejected precisely because of that strength: its metadata-driven object engine is a second tables engine, and running it would put the customer graph outside the one place segments, datasets, search, filters, attribution joins and agents can reach. We borrow instead: its object model, its custom-field approach and its record-page layout are recorded as a `reference` registry entry and mapped field by field onto PAP-187 in the survey (§5.1) so the PAP-202 importer has a contract.

**2. Social: own the queue, borrow Postiz's adapter shapes.** PaperOS builds the social schema, approval state machine, composer and calendar (PAP-401) and its own adapters and publishing worker (PAP-402, PAP-403). Postiz is not run and not forked: it is AGPL-3.0 (`service` tier only), it brings a Temporal dependency we will not add beside PAP-43 jobs, and — decisively — its scheduler would be a send path outside our approval hash and our ledger. What we take is knowledge: the four-method adapter shape (`validate`, `publish`, `fetchMetrics`, `refreshAuth`) which PAP-402 already specifies identically, the per-platform limit table, and the media-upload sequencing per platform. Adapters are written against the platforms' own APIs, never copied from Postiz source, which keeps the AGPL boundary clean.

**3. Email marketing: Resend Broadcasts now, Listmonk held in reserve.** One-off broadcasts and newsletters (PAP-799) go through Resend's Broadcasts and Audiences API behind the same provider port as sequences (PAP-191), not through Listmonk. Listmonk is the cheapest thing in this survey to operate — one Go binary plus Postgres, v6.2.0 on 2026-06-26, a complete REST API — and it fails on one axis only: it is single-tenant, with instance-global SMTP, From addresses, headers and archive pages, so serving N tenants means N instances and N upgrades. It stays on the shelf as a per-customer appliance, re-openable under the criteria below.

**4. Short links: first-party `/l/:code`, Dub by API only if at all.** PaperOS owns its short links and their click events on its own tables, writing `attr_event` directly so link clicks join attribution and revenue like any other touch (PAP-803, PAP-194). Dub is not self-hosted: its self-host path assumes a PlanetScale-compatible MySQL, Upstash Redis, a Tinybird ClickHouse database and QStash — four managed services outside our profile — and its licence is AGPL-3.0 for the core with a commercial `/ee` directory, which is the exact version evaluated on 2026-09-19. A `ShortLinkPort` adapter for the hosted Dub API stays optional for tenants already invested in it (Free is 25 links/month and 60 requests/minute; Business is $75/month).

**5. Support: build the inbox; Chatwoot is the borrow, and the only licence-clean fallback.** The shared support inbox, portal widget and three-pane console (PAP-410, PAP-411, PAP-412) are built on our tables so conversations sit next to the customer record and inside the same permissions, search and agent surface. Chatwoot is rejected for v0.1 on ops and duplication (Rails, Sidekiq, a second contact store), not on licence: it is MIT, in the PAP-211 allow tier, and therefore the one candidate PaperOS could legitimately fork or embed. We take its conversation and message state model, its contact-matching ladder (exact email, plus-address stripped, then domain-to-company — the same ladder PAP-197 specifies) and its canned-reply and help-centre structure.

**6. Analytics: own the event table; reject PostHog self-hosted; keep Umami as reference.** Acquisition analytics stays first-party and cookieless on `attr_*` tables (PAP-194). PostHog's open-source build is MIT but its self-host path is a Docker Compose deployment its own documentation calls unsupported and limits to one project per instance, over eight services with guidance around 32 GB of RAM: it fails the tenancy gate before the cost gate. Umami is MIT, light (~150-250 MB idle) and well built, but it answers page analytics, not the join PAP-194 exists for — `attr_touch` → `crm_contact.party_id` → `fin_party` → paid invoices — so it is a `reference` entry for collector design and dashboard layout, not a dependency.

**Deliverability (supporting decision, binding on PAP-191, PAP-197, PAP-370, PAP-406).** Resend is the primary provider for transactional and marketing mail, because one provider behind PAP-191's `send / verifyWebhook / parseEvent / parseInbound` port covers both plus the inbound webhook PAP-197 needs. Amazon SES is the documented escape hatch at volume (roughly $10 versus $35-90 per 100k emails) and is a config change behind the port, accepted with self-managed warmup and production-access request. Postmark is the transactional-only fallback and can never be the sole provider, because its terms forbid marketing sends. Marketing and transactional always travel on separate streams or domains, and the domain wizard (PAP-406) stays provider-agnostic because DNS records differ per provider.

### Consequences for the issues that consume this ADR

| Issue | Constraint this ADR imposes |
|---|---|
| PAP-190, PAP-401..403 | Adapters are ours, written against platform APIs; Postiz is reference only. File Meta, YouTube, LinkedIn and TikTok app reviews **now** — six weeks to a live Meta or YouTube demo (survey §8). X is pay-per-use, so record attempted-publish cost in the ledger (PAP-792). |
| PAP-191, PAP-799 | Resend first behind the provider port; SES escape hatch; Postmark transactional-only. Broadcasts are a PaperOS feature over `outreach_*`, not Listmonk. |
| PAP-194 | Own `attr_*`; no third-party tracker; Umami's cookieless collector design is the reference. |
| PAP-197, PAP-410..412 | Build on our tables; Chatwoot's conversation model and contact-matching ladder are the reference; embedding Chatwoot is the documented fallback if the children slip. |
| PAP-202, PAP-206 | Importers follow the field mappings in survey §5, write `crm_external_ref` for idempotency, and **never** mark an imported contact as consented (Twenty exports carry no consent; PAP-187 WP0 `canContact` refuses marketing until a consent record exists). |
| PAP-187, PAP-485 | The CRM contract package stays the single customer graph; no foreign CRM tables. |
| PAP-803 | First-party redirects; Dub adapter optional behind a port. |

## Consequences

**Positive.** One customer graph, so segments, search, datasets, attribution and agents work over everything without bridges. No AGPL obligation and no waiver needed for v0.1, because nothing AGPL is run modified or vendored. Ops footprint unchanged: no Temporal, no ClickHouse, no Kafka, no Rails, no MySQL, no per-tenant instances. Provider risk is contained behind ports (email provider, short links), so Resend, SES or Dub can be swapped by configuration.

**Negative, accepted.** PaperOS builds five features that exist off the shelf, which is real work: PAP-189 (CRM surfaces), PAP-401..403 (social), PAP-799 (broadcasts), PAP-410..412 (support) and PAP-194 (analytics). We inherit deliverability operations — warmup ramps, bounce and complaint thresholds — that a managed marketing tool would absorb. We carry the maintenance of per-platform social adapters, the most breakage-prone code in the module, with no upstream community to share it. And we give up the free-of-charge maturity of Chatwoot's inbox and Twenty's CRM polish in exchange for integration; if the schedule slips, decision 5's fallback is the pressure valve.

**Neutral.** Every rejected product remains a documented reference with a field-level mapping, so migrating a customer *from* one of them is a solved problem rather than a discovery exercise.

## Alternatives rejected

| Alternative | Shape | Score (survey §3.1) | Why rejected |
|---|---|---|---|
| Twenty as the CRM of record | run as a service, ~24 h + permanent sync | 3.7 | second tables engine; customer graph outside segments, search, datasets and attribution; AGPL `service` tier gains nothing |
| Twenty forked into the monorepo | fork and embed, 80 h+ | — | AGPL-3.0 in a bundled context is a PAP-211 **block**; needs Justin; expected zero per PAP-215 |
| Postiz as the scheduler | run as a service, ~20 h | 3.1 | a send path outside our approval hash and ledger; adds Temporal |
| Listmonk per tenant | appliance per tenant, ~12 h each | 3.1 | single-tenant; ops cost scales with customers; instance-global sender config |
| Dub self-hosted | ~24 h + four managed services | 3.4 | MySQL, Upstash, Tinybird, QStash outside our profile; `/ee` not open source |
| Chatwoot embedded | run as a service, ~32 h | 3.4 | duplicate contact store and Rails/Sidekiq ops for v0.1 — **licence-clean, kept as the fallback** |
| PostHog self-hosted | 8+ services | 3.4 | one project per instance; self-host officially unsupported; ~32 GB guidance |
| Umami alongside our collector | one container | 3.6 | second event store that cannot make the revenue join |
| Postmark as sole email provider | provider | — | terms forbid marketing sends |
| SES as day-one provider | provider | — | sandbox exit, self-managed warmup and no broadcast product slow v0.1; kept as the volume escape hatch |

## Re-open criteria

* **Listmonk returns** if Resend Audiences cannot isolate per-tenant sending domains, if contact-based marketing pricing (from $40/month per 5,000 contacts) exceeds email-based pricing at our volumes, or if a customer requires a fully self-hosted send path — as a single-tenant appliance behind the existing provider port.
* **Chatwoot returns** if PAP-410..412 slip past the v0.2 window and a tenant needs a support inbox sooner: embed it under the PAP-215 embed-contract template (SSO, API surface, tenant mapping through the platform API, theming, export path, owner). MIT, so no licence event.
* **Twenty returns** only if PaperOS abandons the tables engine as the CRM substrate — that is a different ADR, not a revision of this one.
* **Dub self-hosting returns** if its stack ever runs on plain Postgres without Tinybird and Upstash.
* **PostHog Cloud** is reconsidered if session replay or product-analytics funnels become requirements, with a data-protection review against the privacy-first rule; PostHog self-hosted does not return while the one-project limit stands.
* **Deliverability is re-tested** when monthly volume passes 100k emails or when bounce exceeds 2 % or complaints exceed 0.1 % on a warmed domain (PAP-191 thresholds).
* Any re-open re-runs the survey's §2 scoring with measurements from PAP-351 rather than reported figures.

## Licence review (PAP-211) — Sentinel

Twenty, Postiz, Listmonk and Dub are AGPL-3.0 (Dub with a commercial `/ee` directory): PAP-211 **review** tier, `service` context only. Chatwoot, Umami and PostHog's open-source build are MIT: **allow**. Because every decision here lands on `reject`, `borrow` or `hosted API adapter`, **no AGPL code is run modified and none is vendored, so no waiver is required for v0.1** and `THIRD_PARTY_NOTICES.md` gains no new entry from this ADR. The first place an AGPL dependency could enter is PAP-351's spike lockfiles, which the `licenses` CI job covers. If decision 5's Chatwoot fallback is ever taken, MIT requires attribution only, and its trademark and branding terms must be checked before any white-label embed.

## Registry entries (for PAP-216)

`reference`: Twenty (CRM object model, custom fields, record page), Postiz (adapter shape, platform limits, media sequencing), Chatwoot (conversation model, contact matching, help centre), Umami (cookieless collector, dashboard IA), Listmonk (campaign and bounce model — *reserve*).
`adopted`: Resend (email provider), optionally Dub hosted API (short links, per tenant).
`rejected`: PostHog self-hosted (tenancy), Dub self-hosted (stack), Twenty as CRM of record (duplication), Listmonk as the multi-tenant campaign engine (single-tenant).

## Open questions

* **Justin may prefer a paid tool** for CRM (HubSpot) or support (Intercom). Recorded as an open question, not a blocker, per PAP-188's edge case: the port-and-adapter shape here means a paid tool would enter as another adapter rather than a rewrite — except for CRM, where the tables engine is the architecture.
* **Chatwoot trademark and branding terms** for a white-label embed: unread at the time of writing, needed only if the fallback is taken.
* **PAP-351 measurements** may move the reported RAM and startup figures; they cannot move a decision (survey §10).
