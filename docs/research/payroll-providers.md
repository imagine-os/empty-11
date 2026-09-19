# Payroll provider research: Check, Gusto Embedded, Deel, Rippling

**PAP-176** — Research payroll APIs for embeddability and pricing; feeds the `PayrollProvider` interface (PAP-184) and its adapter children (PAP-398/399/400). Builder: Ledger (Payroll Adapter), with Scout (Library Evaluator) co-authoring. Model: Sonnet 5 (`claude-sonnet-5`) / medium. Access date for every citation below: **2026-09-19**, via public marketing pages and public docs sites (no account, no signed agreement, no API key was created or requested).

## Method

Official docs, pricing/marketing pages and docs-site markdown mirrors (`*.md` / `llms.txt` endpoints, where a provider publishes one) fetched over HTTPS. Quote-only pricing is flagged explicitly rather than estimated as a number. Every row states whether a sandbox key looks obtainable within the build window without a signed agreement or a sales call, which is the PAP-184 blocker (NJ-12). Some pages returned `403`/`404` to an unauthenticated fetch (noted per provider) — these are treated as **evidence of access friction**, not silently skipped, per the edge case "docs contradicting or unreachable."

## Scoring rubric (weights fixed by the spec, 1–5 per row, weighted to 100)

| Criterion | Weight |
|---|---|
| API embeddability (companies, employees, onboarding, schedules, runs, paystubs, filings, webhooks, embeddable components) | 25 |
| Sandbox without a sales call | 15 |
| Pricing model and floor | 15 |
| Compliance ownership (filings, W-2/1099, state registrations) | 15 |
| Geography | 10 |
| Developer experience (TS SDK, idempotency, errors, rate limits) | 10 |
| Time to first sandbox payroll | 10 |

## Score table

| Criterion (weight) | Check | Gusto Embedded | Deel (Embedded) | Rippling |
|---|---|---|---|---|
| API embeddability (25) | 5 | 5 | 4 | 1 |
| Sandbox w/o sales call (15) | 2 | 4 | 2 | 1 |
| Pricing model & floor (15) | 2 | 2 | 3 | 1 |
| Compliance ownership (15) | 4 | 5 | 5 | 3 |
| Geography (10) | 3 | 3 | 5 | 3 |
| Developer experience (10) | 4 | 5 | 4 | 1 |
| Time to first sandbox payroll (10) | 2 | 4 | 2 | 1 |
| **Weighted total /5** | **3.35** | **4.10** | **3.60** | **1.50** |

Arithmetic: `Σ(score_i × weight_i) / 100`, e.g. Gusto = (5·25 + 4·15 + 2·15 + 5·15 + 3·10 + 5·10 + 4·10)/100 = 4.10. A 10-line check script (`results.json` + the formula above) is left for the reviewer per the spec's test plan; see "Reviewer check" below.

## Check

**Evidence:**
1. `https://checkhq.com/` (accessed 2026-09-19) — embedded payroll platform pitch: company/employee management, onboarding, pay schedules/runs, paystubs, "Tax calculation," "Tax notices," "Tax filing," webhooks, "Customizable drop-in Components," white-label UI. Claims 1M+ employees paid, 50,000+ businesses, $15B+/yr processed, 65+ platform partners.
2. `https://docs.checkhq.com/docs` (accessed 2026-09-19, dated on-page "September 3, 2026") — entities: companies, workplaces, employees, contractors, payrolls, paystubs, benefits, tax documents, pay schedules/cycles. Sandbox line: *"Request your API key to begin exploring Check's API first-hand"*, with a fallback to `sales@checkhq.com` or "schedule a discovery session" — **not self-serve**. Also lists a Check MCP Server, a CLI, and embeddable React Components.
3. `https://checkhq.com/security` (accessed 2026-09-19) — SOC 2 Type II certified; licensed money transmitter in all 50 states + DC (US-only signal); TLS 1.2+/AES-256-GCM, MFA, RBAC, auto-expiring API keys, WAF/IDS, pen testing, bug bounty. No explicit statement of who is liable for a missed filing.
4. `https://checkhq.com/partners` (accessed 2026-09-19) — partner roster (7shifts, Homebase, Trayd, Warp, Eddy, Miter, Playground, Housecall Pro, Dripos, Wave) spanning workforce management, vertical SaaS and accounting; case-study numbers (Dripos: weeks to build with Components, 26% ARPU lift, 50% payroll attach, 125% NDR) but no pricing or agreement terms disclosed.
5. `https://checkhq.com/pricing` (attempted 2026-09-19) — returned `403 Forbidden` to an unauthenticated fetch; no public price list found anywhere in the crawl. Treated as **quote-only, sales-gated**.

**Reading:** Full-featured embeddable payroll API and component library, US-only, but the very first step (getting an API key) already routes to sales/a discovery call rather than a self-serve signup form. Tax filing is a listed product feature; the liability split (Check as reporting agent vs. platform) is not published and needs to be pinned down in the sandbox agreement PAP-176 asks Justin to review (see Needs Justin, below).

## Gusto Embedded

**Evidence** (the marketing pages `gusto.com/embedded-payroll` and the plain `docs.gusto.com/embedded-payroll/docs` HTML both returned `403 Forbidden` to an unauthenticated fetch; the docs site publishes an `llms.txt` index and a markdown mirror of every page at `<path>.md`, which is not bot-blocked, so citations 2–4 use that mirror):
1. `https://docs.gusto.com/embedded-payroll/llms.txt` (accessed 2026-09-19) — index of the docs tree: Webhooks (event categories Bank Account, Company, Employee, Contractor, Payroll, Forms), a React SDK, "API Clients," a Postman collection, API fundamentals (pagination, rate limits, scopes), API versioning (date-based), Errors/Error Categories, per-state tax-requirements endpoints, federal tax detail management, new-hire reporting folded into onboarding, and a demo environment with a simulated bank-deposit endpoint (`POST /v1/companies/{id}/bank_accounts/{uuid}/send_test_deposits`).
2. `https://docs.gusto.com/embedded-payroll/docs/introduction.md` (accessed 2026-09-19, dated on-page "February 3, 2026") — *"We welcome any developers that want to work with the demo environment but ask all developers to also connect with our partnerships team to discuss pre-approval before getting too deep into your build."* Demo access is usable directly (**self-serve for sandbox**); moving to production needs "commercial, security, and implementation conversations/reviews" with the partnerships team — i.e. the gate is at production, not at first sandbox call.
3. `https://docs.gusto.com/embedded-payroll/docs/api-fundamentals.md` (accessed 2026-09-19, dated "July 20, 2026") — page-based (`page`/`per`, default 25) and cursor-based (`starting_after_uuid`/`limit`) pagination; `sort_by` with multi-field support; **rate limit 200 req/min/user** with `Retry-After`/`X-RateLimit-*` headers; **idempotency keys** for create operations; optimistic concurrency via required `version` fields (`409` on conflict); delta-only updates; scoped OAuth (`employees:read`, etc.).
4. `https://docs.gusto.com/embedded-payroll/docs/react-sdk.md` (accessed 2026-09-19, dated "July 2, 2026") — React component library with built-in payroll business logic, theme/layout customizable; docs candidly note component coverage is still partial ("consult the GitHub repo's Workflows Overview for current availability"); also offers "Flows" (hosted, faster to ship) and a pure API-only path for teams that don't want React.
5. Pricing: no `gusto.com/embedded-payroll/pricing` page was reachable (`403`); no per-employee number found in the public docs crawled. Treated as **quote-only**, same as Check, but the sandbox step itself needs no quote first.

**Reading:** The most complete and best-documented API of the four (explicit idempotency, rate limits, versioning, scopes, error taxonomy — the only provider whose docs state all of this in public, unauthenticated pages), and the only one where a developer can start hitting a **sandbox today with no sales conversation**; the partnership conversation is required before *production*, which is later than the build-window blocker PAP-184 needs solved. Gusto's core product is a decade-old US full-service payroll/tax-filing business, so compliance ownership (W-2/1099, state registrations, new-hire reporting) reads as the strongest of the four, US-only.

## Deel (Embedded)

**Evidence:**
1. `https://www.deel.com/deel-api` (accessed 2026-09-19) — REST + MCP integration surface across Hiring/EOR (150+ countries), Payroll (multi-entity, local execution), HR/Compliance (screenings, right-to-work), Contractors (onboarding, timesheets, expenses, payments), Webhooks (contracts, payments, approvals), Time & Mobility. Explicitly names **"Deel Embedded"** as a distinct product: *"build global employment natively into your product — your team owns the UX, Deel stays invisible,"* backed by 130+ legal entities. Code samples in curl, TypeScript, Python, Go and Java.
2. `https://developer.deel.com/docs` (accessed 2026-09-19) — confirms API key issuance "from the Deel app" (self-serve for an existing Deel account, no dedicated public sandbox environment called out) and the same multi-language sample set.
3. `https://www.deel.com/pricing` (accessed 2026-09-19) — **published, non-quote pricing for the direct product**: US PEO $125/employee/mo, EOR $599/employee/mo, contractor $49/mo, contractor-of-record $325/mo (all-in, includes payroll, tax filings, benefits admin, compliance). A promo (Jul 15–Dec 31 2026) waives platform fees for 3 months on new 2-year PEO orders. **Deel Embedded itself has no published price** on this page — the white-label product is quote-only even though the direct product is transparently priced.
4. `https://www.deel.com/global-payroll` (accessed 2026-09-19) — 150+ countries, $20B+/yr processed, 40,000+ customers; two compliance modes: "Managed" (Deel runs "processing, compliance, calculations, filings, and updates" with a named Payroll Manager) and "customer-run" (platform support only); "built-in compliance updates" as local rules change. No embeddable/API mention on this specific page — confirms embeddability lives on the separate `deel-api`/Embedded pages, not the flagship payroll page.

**Reading:** Broadest international reach by far and the only provider with genuinely public, numeric pricing (for its direct EOR/PEO/contractor product — not for Embedded specifically), and the most multi-language SDK coverage. But "Deel Embedded" reads as EOR/global-contractor-shaped rather than a pure US payroll-run API (preview/approve a semimonthly run, W-2 paystubs) the way Check and Gusto are; the spec's edge case "mixed EOR and software products (Deel): evaluate the embedded software only" applies directly — scored down on API embeddability and sandbox friction accordingly, since Deel Embedded access was not found to be a self-serve signup.

## Rippling

**Evidence:**
1. `https://www.rippling.com` (accessed 2026-09-19) — only developer-facing mention on the homepage is a footer link, "API Documentation," pointing at `developer.rippling.com`; no Unified-API or embedded-payroll marketing copy on the homepage itself.
2. `https://developer.rippling.com/` and `https://developer.rippling.com/docs/rippling-api/introduction` (both attempted 2026-09-19) — **both returned `404 Not Found`** to an unauthenticated fetch, as did `https://www.rippling.com/platform/unified-api`, `https://www.rippling.com/unified-api` and `https://www.rippling.com/blog/rippling-unified-api`. No public, crawlable developer-docs portal was found for Rippling in this pass — a materially different posture from Check, Gusto and Deel, all three of which have a public docs site.
3. `https://www.rippling.com/products/payroll` (accessed 2026-09-19) — markets "Global Payroll" and country hiring guides (Canada, UK, Australia, India, France, Germany, Brazil, …) as part of Rippling's own product for *Rippling's customers*; mentions 650+ integrations and an "App Studio," but nothing describing a third-party-embeddable payroll API akin to Check/Gusto/Deel Embedded.
4. `https://www.rippling.com/pricing` (accessed 2026-09-19) — per-employee-per-month billing per module (Payroll, Expenses, Benefits, Device Management, …), but the actual page pushes a **custom-quote form** ("Tell us what services you need, and we'll send you a custom quote") rather than a rate card.

**Reading:** Rippling's "Unified API" appears to be aimed at its own customers wiring up their *other* tools to Rippling (an outbound integration surface), not a payroll-as-a-feature product a third-party SaaS platform embeds the way Check, Gusto Embedded or Deel Embedded are designed to be embedded. No public sandbox, no public docs reachable without an account/partner relationship, no published pricing. Scored lowest on every embeddability- and access-related row; compliance ownership and geography are scored on Rippling's strength as a direct payroll provider, since that much is well established, but that strength does not transfer to a documented embedded product.

## Decision rule and reopen criteria (feeds `docs/adr/0007-payroll-provider.md`)

Per the spec: pick the highest score with sandbox access inside the build window. **Gusto Embedded (4.10) is highest and clears "sandbox inside the build window" today** — the demo environment needs no signed agreement, only a `.md`-mirrored docs read and a self-serve key. **Check (3.35) is the documented org default** in `docs/execution-schedule.md` (NJ-12) and remains the fallback: its API is equally complete and its whole product is US-payroll-run-shaped, but the very first API key requires a sales conversation, which is the concrete difference driving the two scores apart.

Switch conditions (reopen this ADR / revisit PAP-184's adapter choice):
* Gusto's partnership team declines pre-approval, or asks for terms Justin won't sign, before PAP-398/399/400 need production access → fall back to Check, and reopen the sandbox-agreement Needs Justin item for Check specifically.
* Either provider's published (once obtained) per-employee price clears roughly **$6–8/employee/mo all-in** at PaperOS's expected tenant sizes, or requires a minimum monthly platform fee that makes the free/entry tenant tier uneconomical → re-score with real numbers and consider Deel's transparently-priced direct product as a fallback (accepting its EOR/global shape) before Rippling.
* A state PaperOS needs to support turns out to be missing from either Gusto's or Check's coverage → the other of the two becomes primary for that tenant; both are already scored equal on US geography (3/5) because neither publishes an all-50-states guarantee.
* No TypeScript-typed SDK ships for the chosen provider by the time PAP-398 starts (Gusto's React SDK/API Clients and Check's Components both currently exist, so this has not triggered) → drop to a Zod-validated `ky` client per PAP-184's binding decision, not a provider switch.

Rippling and Deel-as-embedded-EOR are not realistic runners-up for the *first* adapter (scores 1.50 and 3.60, and Deel is shaped for EOR/contractor use, not a semimonthly US payroll run) but stay documented here so a later international-payroll or 1099-heavy issue (`r4/business-core/contractors-and-1099`, `r4/business-core/payroll-filings-forms-and-deductions`) can start from this table instead of re-researching from zero.

## What PaperOS builds regardless of provider

Per the spec, these are PaperOS-owned regardless of which adapter PAP-184 implements first: employee sync from `fin_employee` (PAP-175) into `payroll_employee_link`, the pay-period calendar, the approval flow (`payroll.approve` + typed net-total confirmation, agents draft-only), ledger posting on `payroll.approved`/`payroll.paid` (PAP-179 accounts), and the paystub portal page. None of this changes if the adapter is swapped later — it is exactly the port/adapter seam the module-system rules (`docs/module-system.md`) call for.

## Needs Justin (NJ-12)

**Ask:** Justin picks the first payroll provider to actually sandbox: **Gusto Embedded (recommended by this research's score)** or **Check (the schedule's pre-set default and the runner-up here)**. Nothing has been signed or requested; both remain sandbox-only until Justin says otherwise.

* **If Gusto Embedded:** no signature needed to start. Sign up for the sandbox at `docs.gusto.com/embedded-payroll` with a work email, read the demo environment (self-serve, no cost), then have Justin (or whoever owns the platform's legal name) email Gusto's partnerships team — link surfaced from the introduction doc — to get **pre-approval before PAP-398 needs a production-shaped sandbox** (this is a conversation, not a contract, per the docs). **Expected cost while in sandbox: $0** (published pricing not found; expect a per-employee-per-month fee plus possibly a base platform fee once production terms are negotiated — get the real number in that partnership conversation, not before).
* **If Check:** email `sales@checkhq.com` or use the "schedule a discovery session" link at `checkhq.com`/`docs.checkhq.com/docs` to request a sandbox API key; Check's site does not show whether a signed agreement is required before that key is issued or only before going live, so the first partnership call should ask that explicitly and report back. **Expected cost while in sandbox: unknown / not published** — get the number on that call.
* **Scope while Needs Justin is open:** PAP-398/399/400 build and merge against the mock adapter regardless (per the round-4 amendment already on PAP-399: CI runs the mock-adapter path and reports `skipped: no-credentials` for the sandbox recording until `PAYROLL_SANDBOX_KEY` exists), so this NJ item does not block the build window — only the sandbox-recorded evidence in PAP-184's Definition of done.

## Reviewer check (test plan: "rubric arithmetic checked by a 10-line script from `results.json`")

```json
{
  "weights": {"embeddability": 25, "sandbox": 15, "pricing": 15, "compliance": 15, "geography": 10, "dx": 10, "time_to_sandbox": 10},
  "scores": {
    "check":  {"embeddability": 5, "sandbox": 2, "pricing": 2, "compliance": 4, "geography": 3, "dx": 4, "time_to_sandbox": 2},
    "gusto":  {"embeddability": 5, "sandbox": 4, "pricing": 2, "compliance": 5, "geography": 3, "dx": 5, "time_to_sandbox": 4},
    "deel":   {"embeddability": 4, "sandbox": 2, "pricing": 3, "compliance": 5, "geography": 5, "dx": 4, "time_to_sandbox": 2},
    "rippling": {"embeddability": 1, "sandbox": 1, "pricing": 1, "compliance": 3, "geography": 3, "dx": 1, "time_to_sandbox": 1}
  }
}
```
```js
// check.mjs — run with `node check.mjs results.json`
const { weights, scores } = require(process.argv[2] || "./results.json");
for (const [provider, s] of Object.entries(scores)) {
  const total = Object.entries(weights).reduce((sum, [k, w]) => sum + s[k] * w, 0) / 100;
  console.log(provider, total.toFixed(2));
}
// Expect: check 3.35, gusto 4.10, deel 3.60, rippling 1.50
```

## Gaps and confidence notes

* Tax-filing **liability language** (who is on the hook for a missed filing — reporting-agent model vs. platform-shared) was not published by Check or Deel on any page crawled; Gusto's page similarly does not use liability language, though its decade-long full-service-payroll reputation is stronger public-record evidence than a marketing page. **This needs to be pinned down in the actual sandbox/partner agreement**, not assumed from this research — flagged for whoever reviews the signed terms.
* Webhook **signature-verification mechanics** (header name, algorithm) were not confirmed for any of the four from a public page in this pass (Check's docs page only named a "Webhooks Configuration" section without detail; Gusto's dedicated webhook-signing doc page could not be located at the paths tried; Deel and Rippling likewise). Per the spec's edge case ("docs contradicting on webhook signing: record both, plan a verification spike"), **PAP-184/PAP-398 needs a short verification spike against the actual sandbox** before relying on any assumed header/algorithm.
* Rippling's public presence is thin enough (two docs URLs 404, three marketing URLs 404) that this table may be understating a real partner-only API; if Justin or a future session gets Rippling partner access, re-score it before treating 1.50 as final.
* "Pricing model and floor" is quote-only for three of four providers (Deel's direct, non-Embedded product is the sole public exception); no evidence link in this doc states a real per-employee number for Check or Gusto — do not use this doc as a source for a budget line without the actual sandbox/partner conversation.
