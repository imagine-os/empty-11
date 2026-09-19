# 0003. Authentication library

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-56](https://linear.app/paperos/issue/PAP-56)
* Deciders: Scout (library evaluation), Forge (Tauri findings)
* Reviewed by: Sentinel (session and token notes); approved by Atlas
* Evidence: [`docs/research/auth-libraries.md`](../research/auth-libraries.md) - full matrix, every
  source with its retrieval date, and the explicit list of what this session could not verify

## Context

The blueprint and `docs/interface-and-data-contracts.md` already name Better Auth: §2 says "Better Auth `organization` maps onto this table, never a second one", `team` maps to `workspace`, and the agent principal is a `user` row with `kind='agent'` plus an `api_key` from "(Better Auth plugin)". The security and threat model assumes it at boundaries B1, B2, B3, B5 and B7.

That is a decision made on a plan, not on evidence. PAP-56 exists to test it before PAP-57 wires it into every surface, and the spec's own edge case is explicit: *"Evidence contradicts the plan: escalate to Needs Justin rather than agree silently."* This ADR therefore treats "Better Auth" as the hypothesis, not the conclusion, and states below exactly what evidence would have overturned it — and what still could.

Eleven requirements were derived from the contracts and threat model rather than from a generic feature list (research doc §1). Five are hard: self-hostable on our Postgres (R1); `organization`→`tenant` and `team`→`workspace` onto our existing tables (R2); passkeys as the primary human factor (R3); API keys as first-class **agent** principals with `{ character, issue, session, scopes[] }` metadata and an 8 h TTL (R5); a credential that resolves cheaply to `{ principalId, tenantId, role }` so `withTenant` can `SET LOCAL app.*` (R6); and a Tauri-workable session strategy (R7).

R5 is the unusual one. PaperOS is a platform where **agents are principals, not integrations** — nine characters holding scoped keys, minted by the orchestrator, spending real money, writing audited rows with a mandatory `app.reason`. Most auth libraries have nothing to say about this. It turned out to be the second decider after multi-tenancy.

## Decision

**Adopt Better Auth 1.7.5 (MIT), self-hosted against our own Postgres via `@better-auth/drizzle-adapter` 1.7.5.** The plan's choice is confirmed — on the evidence, not by deference.

Concretely:

1. **Core:** `better-auth` 1.7.5 with the core plugins `organization` (teams enabled), `magicLink`, `bearer`, `jwt`, `twoFactor` — imported from `better-auth/plugins`, not installed as packages.
2. **Separate packages, all 1.7.5:** `@better-auth/passkey`, `@better-auth/api-key`, `@better-auth/oauth-provider`, `@better-auth/drizzle-adapter`; `@better-auth/sso` and `@better-auth/scim` when PAP-65 needs them. Exact pins, no caret ranges. Version block for PAP-57: research doc §8.
3. **Our tables stay ours.** The organization plugin's `schema.modelName` / `schema.fields` remap `organization`→`tenant`, `member`→`membership`, `team`→`workspace`; `additionalFields` carries `kind`, `agent_character`, `attributes`. PaperOS never grows a parallel identity schema (R2). **PAP-58 owns proving this**, and it is this ADR's primary re-open trigger.
4. **Agents:** `@better-auth/api-key` with `prefix: 'pos_agent_'` (tenant keys `pos_live_`/`pos_test_`, PAP-222), `metadata` for `{ character, issue, session }`, `permissions` for scopes, `expiresIn` 8 h, per-key rate limits. **API-key mock sessions stay disabled** (they are off by default since 1.4): the key is resolved to a `Principal` in our own middleware, so the agent path — including PAP-38's mandatory `app.reason` — is code we own and audit, not a session minted behind our back.
5. **Tauri never calls WebAuthn in the webview.** The shell opens the **system browser** for an OAuth authorization-code flow with PKCE and takes the result on a single-use, PKCE-bound `paperos://auth/callback` deep link; the token goes to the **OS keychain** (PAP-17, PAP-260) and travels as a bearer token with `requireSignature: true`. Never `localStorage`, despite the plugin docs' example. PAP-225 implements this; research doc §4 is the finding it implements.
6. **PaperOS as an OIDC provider** for Forgejo (PAP-45, PAP-226) uses **`@better-auth/oauth-provider`** — *not* `oidcProvider`, which 1.7 removed. `allowDynamicClientRegistration` stays **off** unless PAP-45 demonstrates a need; it is an unauthenticated registration endpoint by design.

Status is **Accepted**, not Proposed, because the recommendation matches the plan: no Needs Justin item is opened for the decision itself (the spec only requires one if the recommendation had differed). The macOS verification gap in §"Consequences" is a separate Needs Justin item about hardware, not about this choice.

## Rationale — why the evidence confirms rather than merely permits

Two of the four candidates never reach a comparison, on facts with dates:

* **Lucia is dead.** `lucia@3.2.2` was last published **2024-10-20** and carries an npm **deprecation** flag; lucia-auth.com states "Lucia was deprecated in March 2025"; its Drizzle adapter, `arctic` and `oslo` are all deprecated too. It is now a teaching resource. PAP-209's maintenance anchor ("0 = archived or 18 months silent") scores it 0, which is a hard fail. Choosing it would mean writing organizations, passkeys, API keys, OIDC provider and SSO by hand — the exact work this platform cannot afford to own.
* **Clerk cannot be self-hosted.** That is PAP-209's hard gate "vendor cloud with no self-host path" and PaperOS's R1. It is worth being precise about what we are giving up, because Clerk is genuinely good: on the RLS criterion (R6) it is the *best* of the four — short-lived JWTs carrying `org_id` and `org_role` are the textbook pattern for `SET LOCAL`. The cost is not the seat price (10,000 MAU sits inside Clerk's 50,000 MRU free allowance); it is **$25/mo Pro + $100/mo for the B2B add-on that contains Organizations, plus $75/mo per SAML connection**, every user identity processed by a US sub-processor with **no first-party data-residency documentation we could retrieve** (the docs URL 404s), and an operations system that cannot boot without a network call to a third party. For a product whose premise is replacing the tools a company rents, renting its identity layer is the wrong shape.

Between the two survivors the gap is not close:

| | Better Auth | Auth.js |
|---|---|---|
| Organizations / teams / invitations / roles | shipped | **none** — the v5 migration guide does not mention multi-tenancy |
| Passkeys | `@better-auth/passkey` 1.7.5, production | **"experimental and not recommended for production use"**, and **Prisma-adapter only** — incompatible with our Drizzle data layer |
| API keys for agents | `@better-auth/api-key` with metadata, scopes, TTL, rate limits | **none** |
| PaperOS as OIDC provider (PAP-45) | `@better-auth/oauth-provider` | none |
| Maintenance (2026-09-19) | 1.7.5 published 5 days ago; **27 releases in 90 days**; repo pushed 2026-09-17 | `@auth/core` **1 release in 90 days**; repo last pushed **2026-07-22**; v5 still `5.0.0-beta.32` |
| PAP-209 score | **100/100** | 75/100 |

Auth.js is excellent at the one thing PaperOS needs least — breadth of OAuth providers — and absent on the three things it needs most. Adopting it would mean hand-building organizations, agent keys and an OIDC provider on top of a beta that has been beta for years.

So the confirmation is not "the blueprint said so". It is: the requirement that decided this (multi-tenancy mapped onto our own tables, plus agents as key-holding principals) is met by exactly one maintained, self-hostable, permissively licensed candidate.

## Consequences

**Good**

* Identity data stays in our Postgres, under RLS, with the rest of the tenant's data. Revocation is a `DELETE`, not a token-expiry wait.
* `organization`/`team`/`member`/`invitation` collapse onto `tenant`/`workspace`/`membership` — no second identity schema, contracts §2 honoured.
* Agents get real, scoped, expiring, rate-limited credentials without us writing a key system.
* One library covers passkeys, magic link, OAuth, 2FA, orgs, API keys, SSO, SCIM, OIDC provider and RFC 8628 device flow — the last matters for the TV/console surface the org standards already anticipate.
* MIT, zero per-user cost, no sub-processor, no residency question to answer.

**Bad, and accepted knowingly**

* **Release velocity is a real cost.** 933 versions to date, 27 in the last 90 days, and 1.7 *removed* a plugin (`oidcProvider`) that PAP-45 and PAP-226 were written against. Mitigation: exact pins, release notes read on every bump, and a renovate-style bump that runs the conformance suite.
* **723 open issues.** Normal at 30 K stars and this cadence, but it means we will hit bugs and should expect to patch around one occasionally.
* **`@better-auth/cli` is 1.4.21 (2026-03-01)** — six months behind 1.7.5. Generated migrations are a draft; PAP-57 hand-reviews the SQL.
* **The bearer path is the weakest link by construction.** A keychain token is still a bearer token. `requireSignature: true`, short TTL and keychain-only storage are mandatory, and Sentinel gates PAP-225 on them.
* **Verification debt.** This ADR is desk research: no spike ran, no screenshot was taken, no `tauri dev` executed (research doc §6 lists all ten gaps with owners). The decision rests on primary vendor documentation, npm/GitHub facts and the WebKit bug tracker — not on a demo. That is a genuine shortfall against the spec's Definition of done and is recorded as risk, not glossed.

**Neutral**

* Linux passkeys in the webview are unavailable today (WebKit bug 205350, open since 2019-12-17, status still NEW despite PR #70116 landing 2026-07-24). Our system-browser design means this never becomes a blocker, and never becomes a rewrite when Linux catches up.

## What would change this decision

Falsifiable triggers, each with an owner. Any one of them re-opens this ADR rather than being worked around quietly.

1. **PAP-58 cannot map the organization plugin onto `tenant`/`workspace`/`membership`** — specifically if `schema.modelName`/`fields` cannot express the composite `(tenant_id, workspace_id, user_id)` uniqueness or the `membership.status invited|active|suspended` lifecycle without a shadow table. *This is the most likely trigger and the least verified claim in this ADR.* Then: either the contracts §2 mapping changes (needs PAP-130) or we drop the organization plugin and keep Better Auth for credentials only, modelling tenancy ourselves. **Owner: PAP-58.**
2. **API keys are stored reversibly.** The hashing scheme is not documented (research doc §5). If PAP-60's source read finds keys recoverable at rest, we hash them in our own layer before the plugin sees them, or replace the plugin. **Owner: PAP-60.**
3. **A second load-bearing plugin is removed inside a minor**, as `oidcProvider` was in 1.7. One is a migration; two is a pattern, and we re-evaluate pinning to a fork or vendoring the plugins we depend on. **Owner: whoever takes the bump.**
4. **`@better-auth/oauth-provider` cannot satisfy Forgejo** (PAP-45/PAP-226) — missing discovery, JWKS rotation or a conformance requirement. Then PaperOS runs a dedicated IdP alongside Better Auth rather than switching auth libraries. **Owner: PAP-45.**
5. **PAP-65 needs SCIM depth the plugin lacks** — `/Groups` was added only in 1.7 and requires full reprovisioning. A shortfall there is an add-on decision, not a reason to change this one. **Owner: PAP-65.**
6. **Justin decides self-hosting is not a requirement.** That is the only thing that puts Clerk back on the table; nothing technical does. It would need a Needs Justin decision and an accepted answer on US data processing.

Not triggers: bundle size (server-side), download counts moving, or a competitor shipping a nicer DX.

## Alternatives rejected

| Candidate | Version / date (2026-09-19) | Licence | Verdict | Reason in one line |
|---|---|---|---|---|
| **Better Auth** | 1.7.5, 2026-09-14 | MIT | **adopt (100/100)** | Only maintained, self-hostable candidate with organizations, teams, passkeys, agent API keys and an OIDC provider |
| Auth.js (`@auth/core`) | 0.41.3, 2026-07-20; `next-auth` v5 still `5.0.0-beta.32` | ISC | trial — documented fallback | No organizations at all; passkeys "experimental and not recommended for production use" and Prisma-only; 1 release in 90 days |
| Lucia | 3.2.2, **2024-10-20**, npm-deprecated | MIT | **reject** | Deprecated March 2025; PAP-209 maintenance hard fail; everything above sessions would be hand-written |
| Clerk | `@clerk/backend` 3.18.1, 2026-09-15 | SDK MIT, **service proprietary** | **reject** | Cannot be self-hosted (R1 and PAP-209 hard gate); $125/mo minimum for Organizations; US processing with no retrievable residency documentation |

Fallback if trigger 1 fires and the organization plugin is abandoned: **Better Auth core for credentials + PaperOS-owned tenancy tables**, not a change of library.
