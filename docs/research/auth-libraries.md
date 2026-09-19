# Authentication libraries: Better Auth vs Lucia vs Clerk vs Auth.js

* **Issue:** [PAP-56](https://linear.app/paperos/issue/PAP-56) — Identity, Roles & Audiences
* **Author:** Scout (Library Evaluator); Tauri section by Forge (Tauri Smith); session and token notes for Sentinel (Security Auditor)
* **Retrieval date for every fact below: 2026-09-19.** npm registry and downloads API figures are for the week 2026-09-10 → 2026-09-16.
* **Decision:** [ADR 0003 — Authentication library](../adr/0003-auth-library.md)
* **Rubric:** [PAP-209](https://linear.app/paperos/issue/PAP-209) (license 20, maintenance 20, bundle 15, a11y 15, TypeScript 15, agent-friendliness 15; hard gates)

> Reading rule: every cell is either a fact with a source and a retrieval date, or the literal string **not verified** with the reason. No cell is a vendor marketing claim restated as fact. Where this session could not run code, it says so instead of guessing.

---

## 1. What PaperOS actually requires

These come from `docs/interface-and-data-contracts.md` §1–§2 and `docs/security-and-threat-model.md` §B1–B3, B5, B7, not from a generic auth wish-list.

| # | Requirement | Why | Hard? |
|---|---|---|---|
| R1 | Runs on our own Postgres, self-hosted, no vendor round-trip in the request path | Blueprint self-host stance; PAP-209 hard gate "vendor cloud with no self-host path" | **Hard** |
| R2 | `organization` maps onto our existing `tenant` table, `team` onto `workspace` — never a second entity | Contracts §2: "Better Auth `organization` maps onto this table, never a second one" | **Hard** |
| R3 | Passkeys (WebAuthn) as the primary human factor | Threat model B1: "passkeys first (PAP-219, PAP-57)" | **Hard** |
| R4 | Magic link + Google and GitHub OAuth as secondary factors | PAP-57 scope | Yes |
| R5 | API keys as first-class principals for **agents**, with metadata `{ character, issue?, session?, scopes[] }`, prefix `pos_agent_`, 8 h TTL | Contracts §2 "Agent principal"; PAP-60 | **Hard** |
| R6 | The credential resolves to `{ principalId, tenantId, role }` cheaply enough to `SET LOCAL app.tenant_id, app.actor_id, app.principal_id, app.role` per request | Contracts §1; PAP-34, PAP-58, PAP-59 | **Hard** |
| R7 | A session strategy that works inside a Tauri 2 webview (bearer token in the OS keychain, not a third-party cookie) | Threat model B2; PAP-17, PAP-225 | **Hard** |
| R8 | The app can act as an **OIDC provider** (Forgejo signs in against PaperOS) | PAP-45, PAP-226; threat model B7 | Yes |
| R9 | Enterprise SSO **client** (SAML/OIDC in) and a SCIM story | PAP-65 | Later |
| R10 | Drizzle adapter, TypeScript-first, Zod-compatible | Contracts §1 (Zod 4), data layer is Drizzle | Yes |
| R11 | Permissive licence, no per-MAU cost | Budget; PAP-211 licence tiers | **Hard** |

---

## 2. Comparison matrix

Legend: **Y** = shipped and documented by the vendor; **Y\*** = shipped but with a caveat named in the notes; **N** = not provided; **nv** = not verified by this session (reason given in §6).

### 2.1 Identity and factors

| Capability | Better Auth | Lucia | Clerk | Auth.js (next-auth) |
|---|---|---|---|---|
| Passkeys / WebAuthn | **Y** — `@better-auth/passkey` 1.7.5, its own package since 1.4 ([1.4 notes](https://better-auth.com/blog/1-4), 2025-11-21) | **N** — no passkey module; Lucia is a session primitive, you write WebAuthn yourself | **Y** — hosted, part of the platform's factor set | **Y\*** — "The WebAuthn / Passkeys provider is **experimental and not recommended for production use**" ([authjs.dev](https://authjs.dev/getting-started/authentication/webauthn)); requires `next-auth@5.0.0-beta.8+` **and `@auth/prisma-adapter`** — no Drizzle support |
| Magic link | **Y** — `magicLink` in core `better-auth/plugins` (no separate package on npm) | **N** — DIY | **Y** | **Y** — the built-in Email provider |
| Google + GitHub OAuth | **Y** — core social providers | **Y\*** — via `arctic`, which is **deprecated on npm** (3.7.0, 2025-05-21) | **Y** | **Y** — its strongest area, ~80 providers |
| TOTP / MFA | **Y** — `twoFactor` core plugin | N | Y | N (roll your own) |
| Anonymous / guest principal | **Y** — `anonymous` plugin | N | Y | N |

### 2.2 Multi-tenancy — the requirement that decides this

| Capability | Better Auth | Lucia | Clerk | Auth.js |
|---|---|---|---|---|
| Organizations | **Y** — `organization` core plugin: tables `organization`, `member`, `invitation`; users may belong to many orgs ([docs](https://www.better-auth.com/docs/plugins/organization)) | **N** | **Y** — Organizations, but behind the **B2B add-on, $100/mo** ([clerk.com/pricing](https://clerk.com/pricing)) | **N** — the v5 migration guide does not mention organizations, teams or multi-tenancy at all |
| Teams (second level) | **Y** — `team`, `teamMember` tables when `teams` is enabled; options `teams.defaultTeam.customCreateDefaultTeam`, `teams.maximumTeams` | N | Y (same add-on) | N |
| Invitations with roles + expiry | **Y** — `invitation` table, email invite, role on invite | N | Y | N |
| Roles / permissions | **Y** — default `owner`/`admin`/`member`, custom permissions, runtime roles in `organizationRole` | N | Y | N |
| Active org on the session | **Y** — `session.activeOrganizationId`, `session.activeTeamId` | N | Y — `org_id` JWT claim | N |
| **R2: remap onto our own `tenant` / `workspace` / `membership` tables** | **Y\*** — `schema` option with `modelName` and `fields` remaps every table and column ("map the organization table to organizations", "map the name field to title"), plus `additionalFields`. Sufficient on paper; **the composite `(tenant_id, workspace_id, user_id)` uniqueness and `membership.status invited\|active\|suspended` remain nv** (§6) | n/a | **N** — org data lives in Clerk, not in our Postgres; our tables would be a webhook-synced mirror | n/a |

### 2.3 Agents as principals (R5) — PaperOS-specific, and the second decider

| Capability | Better Auth | Lucia | Clerk | Auth.js |
|---|---|---|---|---|
| API keys | **Y** — `@better-auth/api-key` 1.7.5 ([docs](https://www.better-auth.com/docs/plugins/api-key)) | N | Y — machine-to-machine tokens (Clerk-issued) | **N** |
| Custom key prefix (`pos_agent_`, `pos_live_`, `pos_test_`) | **Y** — `prefix` option | n/a | nv | n/a |
| Per-key metadata `{ character, issue, session, scopes[] }` | **Y** — `metadata` (arbitrary key/value) + `permissions` (`Record<string, string[]>`, server-only) | n/a | Partial (claims) | n/a |
| Per-key expiry → 8 h agent TTL | **Y** — `expiresIn` seconds; expired keys auto-deleted "every time any apiKey plugin endpoints were called" | n/a | Y | n/a |
| Per-key rate limit | **Y** — `rateLimitEnabled`, `rateLimitTimeWindow`, `rateLimitMax` | n/a | Y | n/a |
| Key → session ("mock session") | **Y\*** — supported, but **"Mock-sessions by api-keys are now disabled by default, and should be enabled through the auth-config first"** (1.4, 2025-11-21). Security-relevant default; see §5 | n/a | Y | n/a |
| Key hashing at rest | **nv** — the docs page does not state the hashing scheme; must be read out of the source before PAP-60 ships (§6) | n/a | nv | n/a |

### 2.4 Federation out and in

| Capability | Better Auth | Lucia | Clerk | Auth.js |
|---|---|---|---|---|
| **R8 — act as an OIDC provider** (for Forgejo, PAP-45/226) | **Y\*** — `@better-auth/oauth-provider` 1.7.5: authorization code, PKCE by default, dynamic client registration (`allowDynamicClientRegistration`, RFC 7591), JWKS via the JWT plugin, DPoP and back-channel logout added in 1.7. **Breaking:** 1.7 *removed* the old `oidcProvider` plugin; `@better-auth/oidc-provider` does not exist on npm | **N** | **N** — Clerk is the IdP for *your users*, it is not an OIDC provider you host | **N** |
| Enterprise SSO **client** (SAML / OIDC in) | **Y** — `@better-auth/sso` 1.7.5; identity normalisation across OAuth/OIDC/SAML in 1.7 | N | Y — **SAML $75/mo per connection** (2–15 connections tier) | Y (OIDC providers only; no SAML) |
| SCIM | **Y\*** — `@better-auth/scim` 1.7.5; 1.7 adds "first-class Groups, role projections and direct memberships". Earlier the plugin implemented `/Users` only; 1.7 requires **full reprovisioning** | N | Y (enterprise) | N |
| Device authorization (RFC 8628) — future TV/console surface | **Y** — expanded in 1.7 | N | nv | N |

### 2.5 RLS-friendliness (R6)

None of the four writes Postgres session variables; `SET LOCAL app.*` is ours (PAP-34, PAP-58). The question is how cheaply our `withTenant` middleware can get `{ principalId, tenantId, role }` out of the credential.

| | Better Auth | Lucia | Clerk | Auth.js |
|---|---|---|---|---|
| Where the session lives | **Our Postgres** (`session` table), with `activeOrganizationId` on the row and an optional signed/encrypted cookie cache (JWE by default since 1.4) | Our Postgres | Clerk's cloud; verified locally as a JWT via JWKS | Our Postgres (database strategy) or a JWT |
| Cost per request to resolve tenant | One local indexed read, or zero with the cookie cache | One local read | Zero (claims), but tenant truth is remote | One local read |
| Tenant/role in the credential out of the box | **Y** (`activeOrganizationId`) | N | **Y** (`org_id`, `org_role` claims) — genuinely the neatest fit for RLS claims | N |
| Verdict | Good, and the data stays ours | Adequate, all hand-built | Technically excellent, **fails R1** | Adequate, no org concept to carry |

Honest note: on this criterion alone Clerk is the best of the four — short-lived JWTs with `org_id` are the textbook RLS pattern. It loses on R1/R11, not on R6.

### 2.6 Engineering facts (npm registry + GitHub API, retrieved 2026-09-19)

| | Better Auth | Lucia | Clerk | Auth.js / next-auth |
|---|---|---|---|---|
| Package | `better-auth` | `lucia` | `@clerk/backend`, `@clerk/clerk-js` | `next-auth`, `@auth/core` |
| Latest version | **1.7.5**, published 2026-09-14 | **3.2.2**, published **2024-10-20** | `@clerk/backend` **3.18.1** (2026-09-15), `@clerk/clerk-js` **6.32.1** (2026-09-15) | `next-auth` **4.24.15** (2026-07-20); v5 is **`5.0.0-beta.32`** (2026-07-20) — still beta |
| npm deprecation flag | No | **Yes** — "This package has been deprecated. Please see https://lucia-auth.com/lucia-v3/migrate" | No | No |
| Weekly downloads | **7,601,581** | 304,843 (declining legacy traffic) | `@clerk/backend` 4,359,991; `@clerk/clerk-js` 635,188 | `next-auth` 5,630,856; `@auth/core` 4,032,694 |
| Releases in the last 90 days | **27** | **0** | 637–638 (canary-heavy release train) | `next-auth` **2**; `@auth/core` **1** |
| Repo last push | 2026-09-17 | 2026-08-08 (docs only) | 2026-09-19 | **2026-07-22** |
| Stars / open issues | 30,007 / 723 | 10,452 / 24 | 1,756 / 126 (SDK repo only) | 28,368 / 604 |
| Licence | **MIT** | MIT (deprecated) | SDKs MIT; **the service is proprietary and paid** | **ISC** |
| Drizzle adapter | **`@better-auth/drizzle-adapter` 1.7.5** (2026-09-14), 6,870,969 weekly; init-time schema validation with mismatch guidance, on by default including production | `@lucia-auth/adapter-drizzle` 1.1.0 (2024-08-05), **deprecated** | n/a (no local schema) | `@auth/drizzle-adapter` 1.11.3 (2026-07-20), 287,872 weekly — **but the WebAuthn provider needs Prisma** |
| Self-hostable on Postgres | **Yes** | Yes | **No** — Clerk is cloud-only; there is no self-host path | Yes |
| Bundle size | nv — not measured; the server half runs in `apps/api`, not the browser bundle, so this criterion carries little weight here | nv | nv (hosted UI components are the heaviest) | nv |

Supporting Better Auth packages, all **1.7.5 published 2026-09-14, MIT**: `@better-auth/passkey`, `@better-auth/sso`, `@better-auth/scim`, `@better-auth/api-key`, `@better-auth/oauth-provider`, `@better-auth/drizzle-adapter`, `@better-auth/stripe`, `@better-auth/expo`. `organization`, `magicLink`, `bearer`, `twoFactor` and `jwt` are **core** plugins imported from `better-auth/plugins` — they have no separate npm package, so do not add them to `package.json`. One laggard: **`@better-auth/cli` is 1.4.21, published 2026-03-01** — six months behind the library; treat `generate`/`migrate` output as a draft and hand-review the migration (see §6).

---

## 3. Hosted-provider economics and residency (Clerk)

Retrieved from [clerk.com/pricing](https://clerk.com/pricing) on 2026-09-19.

| Item | Price |
|---|---|
| Free (Hobby) | 50,000 MRU (monthly retained users) per app |
| Pro | $25/mo ($20/mo billed annually) + **$0.02 per MRU** above the included 50 K |
| B2B / enhanced authentication add-on (**this is where Organizations live**) | **$100/mo** ($85/mo annually) |
| SAML / enterprise connections | **$75/mo per connection** (2–15 tier) |
| Business (includes SOC 2 reports) | $300/mo |
| HIPAA + BAA | Enterprise, custom pricing |

**At 10,000 MAU** the seat cost is nil — 10 K is inside the 50 K free allowance — so the honest number is not "MAU cost" but **feature cost: $25 + $100 = $125/mo ($1,500/yr)** for Pro plus the Organizations add-on, before a single SAML connection ($75/mo each) and before SOC 2 ($300/mo). That is not the reason to reject Clerk; R1 is.

**Data residency: not verified.** `clerk.com/docs/guides/development/data-residency` returned HTTP 404 on 2026-09-19, and a search returned no first-party statement of Clerk's regions or the plan required. What *is* on record is Clerk's GDPR notice stating the company is US-headquartered and the service is hosted in the USA ([clerk.com/legal/gdpr](https://clerk.com/legal/gdpr)). For PaperOS this means: if Clerk were adopted, every user identity — email, factors, org membership — would be personal data processed in the US by a sub-processor, needing a DPA, an entry in the PAP-221 records and an answer for EU customers. Self-hosting removes the question entirely rather than answering it.

---

## 4. Tauri 2 and passkeys (Forge)

**This section is reasoned from primary sources, not from a run.** No display, no macOS host and no Tauri toolchain exist in this session (§6).

Tauri does not ship a browser engine. It uses the platform webview: **WKWebView** on macOS, **WebView2 (Chromium)** on Windows, **WebKitGTK** on Linux. WebAuthn therefore has three different answers, not one.

* **Linux / WebKitGTK — treat as unavailable.** WebKit bug [205350 "[WPE][GTK] Support WebAuthn"](https://bugs.webkit.org/show_bug.cgi?id=205350) was opened **2019-12-17** and its status field is still **NEW**. There is genuine 2026 movement: Lauro Moura's **PR #70116 landed on 2026-07-24**, and the cross-desktop [Credentials for Linux](https://alfioemanuele.io/talks/2026/02/01/fosdem-2026-credentials-for-linux.html) effort (`credentialsd` portal, `libwebauthn`) is building the platform API underneath it. But: whether that landing enables WebAuthn by default, which WebKitGTK release carries it, whether it works through `webkit2gtk-4.1` as Tauri 2 links it, and whether the user's distro ships that version — **all four are not verified**. Even in the best case it depends on a portal daemon most distros do not yet install. Plan for absent, be pleased if present.
* **macOS / WKWebView — not verified.** Safari supports passkeys; an embedded WKWebView in a non-App-Store app is a different trust context and this session could not test it. Tauri discussion [#6601](https://github.com/tauri-apps/tauri/discussions/6601) is the standing thread. Do not assume it works because Safari does.
* **Windows / WebView2 — likely to work** (Chromium + Windows Hello), also not verified.

**Decision (this ADR's `Tauri` finding, which PAP-225 implements):** the desktop shell never calls `navigator.credentials` in the webview. It opens the **system browser** — where passkeys already work on every platform — for an OAuth 2.0 authorization-code flow with **PKCE**, and receives the result on a single-use, PKCE-bound `paperos://auth/callback` deep link (threat model B2: "single-use PKCE-bound deep-link tokens (PAP-225)"). The resulting token is stored in the **OS keychain** (PAP-17, PAP-260), never in `localStorage`, and sent with Better Auth's **`bearer` plugin**. Two consequences Sentinel should hold PAP-225 to:

1. Better Auth's own bearer docs warn: *"Use this cautiously; it is intended only for APIs that don't support cookies or require Bearer tokens for authentication. Improper implementation could easily lead to security vulnerabilities."* The documented example stores the token in `localStorage`; **we do not.** Keychain only.
2. Set `requireSignature: true` on the bearer plugin (it defaults to `false`), so an unsigned token is not accepted.

This design is strictly better than passkey-in-webview even if WebKitGTK ships WebAuthn tomorrow: one code path on all three platforms, the strongest available factor on each, and nothing to re-write when Linux catches up. It is also why R3 ("passkeys first") and R7 ("bearer in the keychain") are not in tension.

---

## 5. Session and token notes for Sentinel

| Surface | Credential | Notes |
|---|---|---|
| B1 Browser / PWA | Better Auth session cookie, `HttpOnly`, `Secure`, `SameSite=Lax` | Cookie cache is **JWE-encrypted by default** since 1.4. Session row lives in our Postgres, so revocation is a `DELETE`, not a token-expiry wait |
| B2 Tauri | Bearer token from the system-browser PKCE flow, OS keychain | `requireSignature: true`; never `localStorage`; single-use deep-link code |
| B3 API | Session **or** `pos_agent_` / `pos_live_` API key → `actor` → `withTenant` sets `app.*` | Mock sessions from API keys are **off by default** since 1.4. Recommendation: **leave them off** and resolve the key to a `Principal` in our own middleware, so the agent path is auditable code we own (PAP-38 requires `app.reason` for agents — a silently minted session would bypass the place that check lives) |
| B5 Yjs | Session or `pos_agent_` key verified in `onAuthenticate` | Unchanged by this choice |
| B7 Forgejo | PaperOS as OIDC provider via `@better-auth/oauth-provider` | PKCE on by default in 1.7; JWKS through the JWT plugin; keep `allowDynamicClientRegistration` **off** unless PAP-45 needs it — it is an unauthenticated registration endpoint by design |

Open security question for PAP-60: **API-key hashing at rest is not documented on the plugin page.** Read it out of `@better-auth/api-key` 1.7.5 source and record the answer in PAP-60 before any `pos_agent_` key is minted. If keys are stored reversibly, we hash them ourselves.

---

## 6. What this session could not verify, and why

The spec's Definition of done asks for runnable spikes, Chromium screenshots at 1280 px, and `tauri dev` runs on Linux and macOS. **None of that was possible here**, and no part of it is reported as done.

| Not done | Reason | Who picks it up |
|---|---|---|
| `spikes/auth/<candidate>/` runnable Vite pages | Path not allocated to this session; headless container, no browser | Follow-up issue (§8) |
| Chromium screenshots at 1280 px of sign-up / passkey / org create / switch | No display, no browser binary in this session | Follow-up issue |
| `tauri dev` on Linux — passkey behaviour | No display, no Tauri/Rust webkit toolchain | **PAP-225** |
| `tauri dev` on macOS — WKWebView passkey behaviour | No macOS host is reachable from CI or this session | **Needs Justin** (a Mac runner) |
| Google OAuth end to end | No Google test app; the spec's own edge case says to mark it unverified and spike with GitHub | PAP-57 |
| Better Auth org schema remap onto `tenant`/`workspace`/`membership` with `(tenant_id, workspace_id, user_id)` uniqueness and `status invited\|active\|suspended` | Needs a live Postgres + Drizzle migration, i.e. PAP-58's actual work | **PAP-58** — this is the ADR's main re-open trigger |
| API-key hashing scheme | Not stated in the docs; needs a source read | PAP-60 |
| Clerk data residency regions and plan requirement | First-party docs URL 404s; no authoritative source found | Moot unless Clerk is revisited |
| Bundle sizes | Not measured; the auth surface is mostly server-side, so the PAP-209 bundle criterion is scored `n/a` and rescaled | — |
| `@better-auth/cli` migration output correctness | CLI is 1.4.21 (2026-03-01) against library 1.7.5 — six months of schema drift | **PAP-57** must hand-review generated SQL |

---

## 7. PAP-209 scorecard

Weights: licence 20, maintenance 20, bundle 15, a11y 15, TS 15, agent-friendliness 15. **Bundle and a11y are `n/a`** for a server-side auth library (Clerk's hosted UI is the only one with an a11y surface, and adopting it is exactly what R1 forbids), so per the rubric they drop and the remaining three rescale to licence 40, maintenance 40, TS/agent-friendliness 20 — recorded here as the rubric requires.

| Candidate | Hard gates | Licence (40) | Maintenance (40) | TS + agent-friendliness (20) | Total | Verdict |
|---|---|---|---|---|---|---|
| **Better Auth 1.7.5** | pass | 4 → 40 (MIT) | 4 → 40 (release 5 days ago, 27 in 90 days, company-backed, 30 K stars) | 4 → 20 (TS-first, `.mdx` docs, typed plugins, well known to Claude) | **100** | **adopt** |
| Auth.js `@auth/core` 0.41.3 | pass | 4 → 40 (ISC) | 2 → 20 (1 release in 90 days, repo last pushed 2026-07-22, v5 in beta since 2023) | 3 → 15 | **75** | trial (fallback only) |
| Lucia 3.2.2 | **FAIL** — "archived or 18 months silent" ⇒ maintenance 0; npm-deprecated | 4 | **0** | 3 | — | **reject** |
| Clerk | **FAIL** — "vendor cloud with no self-host path" | 0 (proprietary, paid) | 4 | 4 | — | **reject** |

Ties: none — the gap between Better Auth and Auth.js is 25 points and both survivors clear the gates, so no tie-break by `migrationCostHours` was needed.

---

## 8. Package and version list for PAP-57

Exact versions verified on the npm registry on **2026-09-19**. PAP-57 pins these; the spec asks for a `spikes/auth/versions.json` which this session's path allocation did not include — PAP-57 (or the spike follow-up) should write this block to that file verbatim.

```json
{
  "retrievedAt": "2026-09-19",
  "source": "https://registry.npmjs.org",
  "dependencies": {
    "better-auth": "1.7.5",
    "@better-auth/drizzle-adapter": "1.7.5",
    "@better-auth/passkey": "1.7.5",
    "@better-auth/api-key": "1.7.5",
    "@better-auth/oauth-provider": "1.7.5",
    "@better-auth/sso": "1.7.5",
    "@better-auth/scim": "1.7.5"
  },
  "devDependencies": {
    "@better-auth/cli": "1.4.21"
  },
  "corePluginsNoSeparatePackage": [
    "organization",
    "magicLink",
    "bearer",
    "jwt",
    "twoFactor",
    "anonymous"
  ],
  "notes": [
    "organization, magicLink, bearer, jwt, twoFactor and anonymous are imported from better-auth/plugins and must NOT be added to package.json",
    "@better-auth/oidc-provider does not exist; 1.7 removed the oidcProvider plugin in favour of @better-auth/oauth-provider",
    "@better-auth/cli lags the library by six months (1.4.21, 2026-03-01) - hand-review generated migrations"
  ]
}
```

### Known breaking changes and bugs to plan around

| Item | Detail | Source |
|---|---|---|
| `oidcProvider` removed in 1.7 | Migrate to `@better-auth/oauth-provider`; affects PAP-45 and PAP-226 before they start | [1.7 release notes](https://better-auth.com/blog/1-7), 2026-08-17 |
| SCIM requires full reprovisioning on 1.7 | Only matters once PAP-65 ships SCIM | 1.7 release notes |
| Account identity mappings need review on 1.7 | Identity normalisation across OAuth/OIDC/SAML changed shape | 1.7 release notes |
| API-key mock sessions off by default since 1.4 | Intentional; we keep it off (§5) | [1.4 release notes](https://better-auth.com/blog/1-4), 2025-11-21 |
| Drizzle adapter schema validation runs in production by default | A schema drift now fails at boot rather than at first query — good, but PAP-57 must keep Drizzle and Better Auth schemas in lockstep | [Drizzle adapter docs](https://better-auth.com/docs/adapters/drizzle) |
| 723 open issues on a 30 K-star repo shipping 27 releases a quarter | Normal for the velocity, but it means **pin exact versions, never a caret range**, and read release notes on every bump | GitHub API, 2026-09-19 |

---

## 9. Sources

All retrieved 2026-09-19.

* npm registry (`registry.npmjs.org`) and downloads API (`api.npmjs.org/downloads/point/last-week`) for every version, publish date, licence, deprecation flag and weekly download figure
* GitHub REST API `/repos/{owner}/{repo}` for stars, open issues and last push
* [Better Auth 1.7 release notes](https://better-auth.com/blog/1-7) (2026-08-17) · [1.4 release notes](https://better-auth.com/blog/1-4) (2025-11-21) · [changelog](https://better-auth.com/changelog)
* [Organization plugin](https://www.better-auth.com/docs/plugins/organization) · [API key plugin](https://www.better-auth.com/docs/plugins/api-key) · [Bearer plugin](https://www.better-auth.com/docs/plugins/bearer) · [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle) · [OAuth 2.1 / OIDC provider](https://better-auth.com/docs/plugins/oauth-provider) · [SSO](https://better-auth.com/docs/plugins/sso) · [SCIM](https://better-auth.com/docs/plugins/scim)
* [lucia-auth.com](https://lucia-auth.com/) — "Lucia was deprecated in March 2025. This website was updated in July 2026"
* [Auth.js WebAuthn](https://authjs.dev/getting-started/authentication/webauthn) · [Auth.js v5 migration](https://authjs.dev/getting-started/migrating-to-v5)
* [clerk.com/pricing](https://clerk.com/pricing) · [clerk.com/legal/gdpr](https://clerk.com/legal/gdpr)
* [WebKit bug 205350 "[WPE][GTK] Support WebAuthn"](https://bugs.webkit.org/show_bug.cgi?id=205350) · [Tauri discussion #6601 FIDO2/U2F/WebAuthn](https://github.com/tauri-apps/tauri/discussions/6601) · [Credentials for Linux, FOSDEM 2026](https://alfioemanuele.io/talks/2026/02/01/fosdem-2026-credentials-for-linux.html)
