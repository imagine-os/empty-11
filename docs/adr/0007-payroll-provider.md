# 0007. Payroll provider

* Status: Proposed (pending Justin's NJ-12 choice between the two options this ADR names; nothing has been signed or requested with either vendor)
* Date: 2026-09-19
* Issue: [PAP-176](https://linear.app/paperos/issue/PAP-176), implemented by [PAP-184](https://linear.app/paperos/issue/PAP-184) and its children PAP-398/399/400
* Deciders: Ledger (Payroll Adapter, builder), Scout (Library Evaluator, co-author), Atlas (decision review) — Justin Massion owns the final NJ-12 pick

## Context

PaperOS needs to onboard a tenant's employees, run payroll (preview, approve, cancel), show paystubs, and post every approved run to the ledger (PAP-179 accounts) without owning a payroll-tax-filing operation itself. PAP-184 needs a fixed `PayrollProvider` TypeScript interface to implement its first adapter against, and a named provider so the sandbox and Needs Justin work can start. Four candidates were in scope per the spec: Check, Gusto Embedded, Deel, Rippling. Full research, scoring and evidence links are in `docs/research/payroll-providers.md`; this ADR records only the decision.

Rubric (fixed by the spec, 1–5 each, weighted to 100): API embeddability 25, sandbox without a sales call 15, pricing model and floor 15, compliance ownership 15, geography 10, developer experience 10, time to first sandbox payroll 10.

## Decision

**Recommend Gusto Embedded as the first adapter (score 4.10/5), with Check as the named runner-up and fallback (score 3.35/5).** Deel (3.60) is shaped around EOR/international employment rather than a US semimonthly payroll run and is not a realistic first adapter; Rippling (1.50) has no discoverable public sandbox, docs or pricing and is not a candidate for the first adapter at all.

This is a **change from the pre-set default in `docs/execution-schedule.md` NJ-12** ("sign the Check sandbox agreement (default) or Gusto Embedded"), driven by one concrete, sourced fact: Gusto's demo/sandbox environment is usable directly with no signed agreement (`docs.gusto.com/embedded-payroll/docs/introduction.md`: *"We welcome any developers that want to work with the demo environment"*, partnership pre-approval is asked for before *production*), while Check's own docs route the very first API key request to `sales@checkhq.com` or a discovery call (`docs.checkhq.com/docs`). Gusto's public docs also state idempotency keys, a 200 req/min rate limit, scoped OAuth, date-based versioning and a React SDK explicitly — Check's docs page does not state any of these for the general reader. Both are US-only, both list tax filing as a covered feature, and neither publishes a per-employee price. This ADR does not sign or request anything; it only recommends which of the two named-in-schedule options to sandbox first. If Justin prefers to keep the schedule's Check default regardless (for example because a partner relationship already exists, or because the reporting-agent liability language reads better once seen), that is a one-line change to this ADR's Decision section, not a rebuild — the `PayrollProvider` interface (PAP-184) and everything PaperOS owns (employee sync, calendar, approval flow, ledger posting, paystub portal) are unaffected either way.

## Consequences

* PAP-184's adapter child (PAP-398) targets Gusto Embedded's REST API first: idempotency key per mutation (`paperos:<tenant>:<entity>:<version>`, compatible with Gusto's own idempotency-key support), webhook route with signature verification **to be confirmed in a verification spike** (Gusto's public docs did not surface the signing header/algorithm in this research pass — see Gaps in the research doc), `capabilities()` gating optional members (e.g. contractors, off-cycle runs) per what Gusto's demo actually exposes.
* CI stays green without credentials: per the round-4 amendment already on PAP-399, the mock-adapter path is the gate and the sandbox-recorded evidence is attached only once a `PAYROLL_SANDBOX_KEY` exists, so this decision does not block the build window even before Justin answers NJ-12.
* Compliance ownership (W-2/1099, state registrations, filings) sits with Gusto as the payroll-of-record; PaperOS never stores SSNs or bank account numbers (masked last-four only), per PAP-184's binding decision.
* Geography stays US-only for this adapter; international/contractor coverage is an explicit non-goal here and is tracked separately (`r4/business-core/contractors-and-1099`, `r4/business-core/payroll-filings-forms-and-deductions`).
* A `payrollProviders[id]` registry (PAP-184's interface contract) keeps the door open to add Check, or later Deel for international contractors, as a second adapter without touching the `PayrollProvider` interface — the module boundary rule already requires the port/adapter shape this decision assumes.

## Reopen criteria (switch conditions)

* Gusto's partnerships team declines pre-approval, or asks for terms before PAP-398 needs a production-shaped sandbox, that Justin will not accept → fall back to Check; reopen the Needs Justin sandbox-agreement ask naming Check specifically.
* Once real pricing is obtained from either partnership conversation, a per-employee-per-month all-in cost above roughly $6–8 at PaperOS's expected tenant sizes, or a minimum platform fee that breaks the entry tenant tier's economics → re-score with the real number; Deel's publicly-priced direct product ($125–599/employee/mo, a different shape) becomes the next comparison point before Rippling.
* A US state PaperOS needs turns out to be missing from Gusto's coverage and present in Check's (or vice versa) → the provider with that state's coverage becomes primary for tenants in that state; neither is currently confirmed all-50-states in public docs.
* Neither Gusto's React SDK/API Clients nor Check's Components ship a TypeScript-typed contract PAP-398 can vendor by the time it starts → drop to a Zod-validated `ky` client per PAP-184's already-binding fallback; this is an implementation detail, not a provider switch.

## Alternatives rejected

* **Deel (Embedded):** highest geography and compliance-ownership scores of the four (150+ countries, transparently priced direct product), but "Deel Embedded" reads as EOR/global-employment-shaped in its own marketing rather than a US-payroll-run API, sandbox access was not found to be self-serve, and pricing for the embedded product specifically is not published. Kept as the natural second adapter once PaperOS needs international contractors or EOR, not as the first.
* **Rippling:** could not find a public developer-docs portal, sandbox, or pricing for any embeddable/third-party payroll product in this research pass (`developer.rippling.com` and every Unified-API URL tried returned 404); its "Unified API" reads as an outbound integration surface for Rippling's own customers, not a payroll-as-a-feature product other platforms embed. Rejected for the first adapter; revisit only if Justin already has or can get partner-level access, since the public evidence here may understate a real but gated offering.
* **Check as the sole/default choice (the schedule's NJ-12 wording):** not rejected outright — kept as the named runner-up and immediate fallback — but not chosen as primary because its sandbox is one sales conversation further away than Gusto's, which is the one criterion (sandbox without a sales call) with a directly sourced difference between the two.

## Evidence

Full citation list (13 URLs across the four providers, each with an access date and what it showed) is in `docs/research/payroll-providers.md`. This ADR does not repeat it.
