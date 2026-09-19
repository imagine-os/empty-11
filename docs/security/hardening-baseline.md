# PaperOS hardening baseline

* Version: 1, 2026-09-19. Issue: [PAP-219](https://linear.app/paperos/issue/PAP-219) ·
  Decision: [ADR 0024](../adr/0024-threat-model-baseline.md) · Owner: Sentinel, implemented by Forge.
* Data: [`ops/security/headers.json`](../../ops/security/headers.json) (headers, CSP, CORS, cookies,
  limits) and [`ops/security/controls.yaml`](../../ops/security/controls.yaml) (the control ids).
* Companions: [`threat-model.md`](threat-model.md) (why), [`incident-playbook.md`](incident-playbook.md)
  (when it fails).

Every app cloned from this template inherits these settings. They are data first and prose second:
if a value appears in both, `ops/security/headers.json` wins and this file is the annotation.

## 1. How the baseline is applied

| Surface | Applies it by | Profile in `headers.json` |
| -- | -- | -- |
| `apps/api` (Hono) | `securityHeaders()` middleware, first in the chain (section 13) | `api`, and `app` for HTML error pages |
| `apps/web` (Vite) | dev and preview server headers from the same JSON; static host config generated from it | `app` |
| `apps/desktop` (Tauri) | `tauri.conf.json` CSP generated from the `tauri` profile | `tauri` |
| file origin | object-store / proxy config generated from the `files` profile | `files` |
| component workshop, Pages demo, embedded OSS routes | their own profiles, never the app's | `storybook`, `pages-demo`, `embedded-oss` |

One generator, one source: a surface that hand-writes a header set is a Gate 1 failure
(SEC-HDR-01). A profile that does not exist in the JSON cannot be deployed.

## 2. Transport

* HTTPS only. Port 80 redirects; no mixed content; `upgrade-insecure-requests` is in the app policy.
* `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on every public host
  (SEC-HDR-02). Two years with `includeSubDomains` and `preload` satisfies the preload list's
  one-year minimum with margin (hstspreload.org, retrieved 2026-09-19). **Preload is a one-way
  door:** every present and future subdomain must be HTTPS before submission, which is why
  submitting the apex is a Needs Justin step, not a session's.
* TLS 1.2 minimum, 1.3 preferred; certificates automated by the edge; internal traffic between
  services stays on the tailnet (SEC-ORCH-01).
* HTTP/2 or HTTP/3 at the edge; no TLS termination inside a session container, ever.

## 3. Response headers

The enforced set for the `app` profile. Values are exact; where a profile differs the difference is
in `headers.json`, not here.

| Header | Value | Why | Control |
| -- | -- | -- | -- |
| `Content-Security-Policy` | see section 4 | XSS containment | SEC-CSP-02 |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | downgrade and cookie-stripping attacks | SEC-HDR-02 |
| `X-Content-Type-Options` | `nosniff` | MIME confusion on uploads and JSON | SEC-HDR-03 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | no path or query leakage cross-origin | SEC-HDR-04 |
| `X-Frame-Options` | `DENY` | legacy clickjacking defence beside `frame-ancestors` | SEC-HDR-05 |
| `Cross-Origin-Opener-Policy` | `same-origin` | cuts `window.opener` cross-origin | SEC-HDR-05 |
| `Cross-Origin-Resource-Policy` | `same-origin` (`same-site` on the API and file origins) | blocks cross-origin inclusion of our responses | SEC-HDR-05 |
| `Cross-Origin-Embedder-Policy` | `credentialless` | isolation without breaking third-party images | SEC-HDR-05 |
| `Permissions-Policy` | deny-all list in `headers.json`; a page opts in through its page spec | an undeclared capability cannot be used | SEC-HDR-06 |
| `Cache-Control` | `no-store` on HTML and on every authenticated response | no shared-cache or back-button leakage | SEC-HDR-01 |
| `Server`, `X-Powered-By` | absent | no free version fingerprint | SEC-HDR-07 |

`Permissions-Policy` is the one header that is not static: a page that needs the camera declares it
in its page spec (PAP-114) and the generator adds `camera=(self)` for that route only. A page that
uses a capability it did not declare fails the lint, which is the point (SEC-HDR-06).

## 4. Content Security Policy

### 4.1 The app policy

```
default-src 'self';
base-uri 'none';
object-src 'none';
frame-ancestors 'none';
frame-src 'none';
form-action 'self';
script-src 'self' 'nonce-<per-response>' 'strict-dynamic';
style-src 'self' 'nonce-<per-response>';
img-src 'self' data: blob: <files origin>;
font-src 'self';
connect-src 'self' <api> <sync> <collab> <telemetry>;
media-src 'self' <files origin>;
worker-src 'self' blob:;
manifest-src 'self';
upgrade-insecure-requests;
report-to paperos-csp
```

* **Nonces, not allowlists.** A fresh 128-bit CSPRNG nonce per HTML response, on the request-context
  key `CSP_NONCE`, never reused, never cached (SEC-CSP-01). `'strict-dynamic'` lets a nonced
  bootstrap script load the chunks the bundler split out without listing hosts, which is the
  pattern CSP Level 3 (W3C WD 2026-08-13) exists to enable.
* **No `'unsafe-inline'`, no `'unsafe-eval'`, no wildcard hosts** in any app profile (SEC-CSP-02,
  SEC-CSP-03). Source code carries no inline event handler, no `javascript:` URL, no `eval`
  (SEC-CSP-04).
* **`connect-src` is exact origins.** The API, the shape proxy, the collab socket and the telemetry
  collector. Adding an origin means editing `headers.json` in a reviewed commit, which is the
  review hook we want on "the frontend now talks to something new".
* **Reporting:** `report-to paperos-csp` posts to `/api/v1/security/csp-report`, rate limited to 30
  per minute per IP and sampled (SEC-CSP-05). A new violation class opens a finding. It never opens
  a relaxation: the fix is the code that violated the policy.
* **Trusted Types** ship report-only (`require-trusted-types-for 'script'`) and are enforced only
  once every WebView in the device matrix is confirmed to support them (SEC-CSP-07).

### 4.2 Rollout, in order

1. Report-only on staging for one week with the report endpoint live.
2. Zero violations at 375 and 1280 across the smoke routes; the Playwright run asserts a seeded
   nonce-less inline script **is** blocked, so we know the policy is on and not merely present.
3. Enforce on staging, then production. The report-only header stays for Trusted Types.

### 4.3 The three documented relaxations

| Profile | Relaxation | Why it is acceptable | Boundary rule |
| -- | -- | -- | -- |
| `storybook` | `'unsafe-eval'`, `'unsafe-inline'` styles | the component workshop compiles in the browser | its own origin; **no session cookie is valid there** |
| `pages-demo` | inline styles; CSP in a meta tag because Pages cannot set headers | static demo, holds no credential and no tenant data | separate origin, `X-Robots-Tag: noindex` |
| `embedded-oss` | inline scripts and styles | an embedded third-party OSS UI (PAP-215) that we do not fork | scoped to `/embed/<product>/**`, its own cookie path, never the app's policy |

Any fourth relaxation needs an ADR. Relaxing the `app` profile itself is never acceptable
(SEC-CSP-06).

### 4.4 Tauri

The WebView origin is `tauri://localhost`, so the CSP is generated into `tauri.conf.json` rather
than sent as a header, and `connect-src` additionally allows `ipc:`/`http://ipc.localhost` and
`img-src` allows `asset:`/`http://asset.localhost`. HSTS and COEP do not apply to a custom scheme.
`publickey-credentials-get` stays denied because the shell never calls WebAuthn in the WebView
(SEC-AUTH-02); authentication happens in the system browser.

## 5. CSRF and origin checks

* Every mutating route (`POST`, `PATCH`, `DELETE`, and any oRPC mutation) checks `Origin` against
  the allowlist and `Sec-Fetch-Site` before the handler runs (SEC-CSRF-01).
* `SameSite=Lax` on the session cookie is the second layer, not the only one.
* **Bearer requests are exempt from the origin check and only from that check**: a Tauri, agent or
  SDK call carries `Authorization` and no cookie. A request carrying both a bearer token and a
  session cookie is rejected — that combination is either a confused client or an attack
  (SEC-CSRF-02).
* `Sec-Fetch-Site: none` is accepted only for bearer-authenticated requests.
* Safe methods are safe: no `GET` route and no oRPC *query* writes, enqueues or emits (SEC-CSRF-03).
* Webhooks are not CSRF-checked; they are signature-checked (SEC-ORCH-02) and live under
  `/api/webhooks/*` where no cookie is ever read.

## 6. Cookies and client-side storage

| Cookie | Flags | Notes |
| -- | -- | -- |
| `__Host-paperos_session` | `Secure; HttpOnly; SameSite=Lax; Path=/`, no `Domain` | the only credential cookie; the `__Host-` prefix pins it to the exact host (draft-ietf-httpbis-rfc6265bis-20, Internet-Draft as of 2026-09-19) |
| `paperos_locale` | `Secure; SameSite=Lax; Path=/`, readable by script | language toggle only; no security meaning |

Client storage rules (SEC-COOK-02, SEC-SYNC-05):

* No token, key or session in `localStorage`, `sessionStorage`, IndexedDB or the PGlite local
  database — including "just for the demo".
* The desktop token lives in the OS keychain only (SEC-COOK-03).
* The local store is a cache: no secrets, no other tenant's rows, no audit data; wiped when the
  principal, tenant or schema hash changes. Only the outbox is durable, and on Tauri it lives
  outside the WebView-owned storage, because WebView storage is wiped across app updates
  (ADR 0004).
* Sign-out clears the service-worker caches and the local store, then reloads.

## 7. CORS

* Exact origins only: the web origin, `tauri://localhost`, and the two localhost dev ports which are
  dropped from production builds. No wildcard, no reflected origin, no suffix matching
  (SEC-CORS-01).
* `Access-Control-Allow-Credentials: true` only for those origins.
* Allowed headers are enumerated (`authorization`, `content-type`, `idempotency-key`, `traceparent`,
  `x-tenant`, `x-paperos-env`, `x-paperos-reason`); exposed headers are `x-request-id` and
  `retry-after`; preflight cached 600 seconds (SEC-CORS-02).
* A public unauthenticated endpoint (payment link, short link, embed) serves `Access-Control-Allow-Origin: *`
  **only** when it reads no cookie and returns no tenant data.

## 8. Secrets: classes, storage and rotation runbooks

### 8.1 Storage rules

* Values live in sops-encrypted files (`ops/secrets/*.enc.yaml`, age, two recipients: Justin's
  offline key and the host key) and in the deployment platform's secret store. The repository holds
  **no** secret value; `.env.example` holds placeholder names only (SEC-ORCH-03, SEC-SECRET-01).
* Only `VITE_`-prefixed variables reach a client bundle; the build fails otherwise (SEC-SECRET-01).
* A session container holds broker placeholders, not values; the egress proxy injects the real
  credential per allowlisted host and logs the use (SEC-AGENT-06).
* Stored third-party credentials are encrypted at the field level under a per-tenant data key
  (SEC-SECRET-05).
* `env`, `printenv`, `/proc/*/environ` and base64 of secret paths are denied in sessions
  (`DENY-SECRET-01`).

### 8.2 Rotation: the shape of every runbook

Each class below answers the same four questions, because an incident is not the time to invent
them: **blast radius** (what breaks while the old value is dead), **steps**, **proof of death** (the
command that shows the old value no longer works), and **SLA** (how fast a suspected leak must be
rotated). Overlap means the old and new value are both valid for a window so nothing is locked out
mid-run.

| # | Class | Blast radius | Rotation steps | Proof of death | SLA · overlap |
| -- | -- | -- | -- | -- | -- |
| S1 | Database app role (`paperos_app`) | API and jobs cannot connect; no data loss | `ALTER ROLE paperos_app PASSWORD`; update sops + platform secret; rolling restart of API and worker | `psql "…password=<old>"` fails with `28P01` | 4 h · none (rolling restart) |
| S2 | Database owner role (`paperos_owner`) | migrations blocked; runtime unaffected | rotate password; update the migrator secret only | old value fails `28P01`; migrator dry-run passes with the new one | 4 h · none |
| S3 | Replication role (`electric`) | shape streaming stops; app falls back to API reads | rotate password; restart Electric; slot survives | Electric with the old value fails to connect; `pg_stat_replication` shows the new session | 4 h · none |
| S4 | sops age keys | nothing can be decrypted or deployed until recipients are updated | generate a new age key; `sops updatekeys` every file with old+new recipients; distribute; drop the old recipient; re-seal the offline copy | `sops -d` with only the old key fails on every file | 24 h · both recipients during the window |
| S5 | Auth signing secret (Better Auth) | every session and bearer token is invalidated; everyone signs in again | set the new secret with the old kept as a verifier for the overlap; then remove the old | a token signed with the old secret is rejected after the overlap ends | 1 h · 15 min |
| S6 | Agent keys (`pos_agent_`) | running sessions lose their credential and re-mint | `pnpm revoke --all` or revoke by character; orchestrator re-mints on next heartbeat | a request with a revoked key answers `UNAUTHORIZED` within 60 s | 15 min · none (deliberate) |
| S7 | Tenant API keys (`pos_live_`, `pos_test_`) | that tenant's integrations fail until they take the new key | mint the new key, notify the tenant, keep both for the window, revoke the old | the old key answers `UNAUTHORIZED`; usage counter stops | 24 h (leak: 1 h) · 7 days normal, 0 on leak |
| S8 | Forge bot tokens | that character's sessions cannot push or comment | create a token on the bot account, update sops + orchestrator, delete the old | forge API with the old token returns 401; audit log shows no further use | 4 h · 10 min |
| S9 | Forge app private key (GitHub App) | mirror and status reporting stop | generate a new key in the app settings, upload, delete the old | old key fails to mint an installation token | 4 h · both keys valid until deleted |
| S10 | SSH signing keys | commits stop verifying; pushes with that key fail | generate per-character key, add to the bot account and `allowed_signers`, remove the old | `git log --show-signature` marks old-key commits with the retired signer; a push with the old key is refused | 24 h · 24 h |
| S11 | Linear API key | the queue stops moving; no session can claim or comment | rotate in Linear, update the orchestrator secret only (no session ever holds it) | a call with the old key returns 401 | 1 h · none |
| S12 | Model provider key | every session stops mid-turn | create a new key, update the orchestrator and the proxy, delete the old | a request with the old key returns 401; console shows zero usage on it | 1 h · 10 min |
| S13 | Email provider key (transactional) | outbound mail stops; queued mail retries | rotate in the provider, update secret, redeploy the mailer | provider API with the old key returns 401; a test send on the new key delivers | 4 h · 10 min |
| S14 | Payment restricted keys | checkout and billing writes fail; webhooks keep arriving | roll the restricted key per service, update secrets, redeploy | old key returns `Invalid API Key`; dashboard shows it revoked | 1 h · 10 min |
| S15 | Payment webhook signing secret | webhooks fail signature verification and retry | add the new endpoint secret, accept both for the window, remove the old | a replay signed with the old secret is rejected | 4 h · 1 h |
| S16 | Payroll provider credentials | payroll runs blocked (never mid-run) | rotate in the provider console, update secret, re-authorise | old credential rejected; a read-only call on the new one succeeds | 24 h · none; never during a run |
| S17 | Object store keys (files) | uploads and downloads fail; existing objects safe | create a new access key, update the API secret, delete the old | a signed URL minted with the old key returns 403 | 4 h · 10 min |
| S18 | Backup repository password (restic) | new backups fail; existing snapshots still readable with the old password | add a new key to the repository, update the secret, remove the old key | `restic` with the old password fails; `restic check` passes with the new one | 24 h · both keys during the window |
| S19 | Tailnet auth keys and device keys | a node cannot rejoin the tailnet | revoke the key, mint a new ephemeral key, re-authenticate the node | the old key cannot enrol a device; the node list shows the new enrolment | 4 h · none |
| S20 | Telemetry ingest key | traces and metrics stop; app unaffected | rotate in the collector, update the exporter secret | old key rejected at the collector; spans arrive under the new one | 24 h · 10 min |

Rules that apply to all twenty classes:

1. **Rotate on suspicion, not on proof.** A secret that appeared in a log, a transcript, a screenshot
   or a public diff is compromised (SEC-SECRET-03).
2. **Prove death before closing.** The incident stays open until the proof-of-death command has been
   run and its output attached (SEC-SECRET-03).
3. **One class per drill.** Quarterly, Sentinel rehearses one class end to end and records the
   elapsed time (SEC-SECRET-02); the first rehearsal is S13, the email provider, on staging.
4. **Never rotate two dependent classes at once** (S4 then S1, not both together) — recovery needs
   one known-good path.
5. **Every rotation writes a changelog line** under Security and an audit entry naming who rotated
   what, without the values.

## 9. Rate limits, quotas and payload caps

| Route class | Limit | Response | Control |
| -- | -- | -- | -- |
| Authenticated RPC and REST | 600 / min per actor | 429 + `Retry-After` | SEC-RATE-01 |
| Per API key | the key's configured limit (default 600 / min) | 429 + `Retry-After` | SEC-RATE-01 |
| Public routes (payment link, short link, embeds) | 60 / min per IP | 429 | SEC-RATE-01 |
| Auth routes (sign-in, reset, magic link, key mint) | 10 / min per IP **and** per identifier, exponential backoff | 429, lockout audited | SEC-RATE-02 |
| CSP report endpoint | 30 / min per IP, sampled | 204 | SEC-CSP-05 |
| Webhooks | 600 / min per source, signature first | 429 after verification | SEC-ORCH-02 |
| List inputs | `limit <= 100`, keyset cursor | 400 `VALIDATION` | SEC-RATE-03 |
| Batch mutations | 25 per request, each with its own idempotency key | 400 `VALIDATION` | SEC-RATE-03 |
| Bulk patch | 500 ids | 400 `VALIDATION` | SEC-RATE-03 |
| JSON body | 1 MB | 413 `PAYLOAD_TOO_LARGE` | SEC-RATE-04 |
| Upload | 100 MB per file | 413 | SEC-RATE-04 |
| Yjs document | 20 MB | close 4413 | SEC-RATE-04 |
| Shape response | 25 MB, narrowing required above ~10k rows | 400 with a narrowing hint | SEC-RATE-04, SEC-SYNC-02 |
| Agent spend | per-session and per-day caps, then kill | session ends, card filed | SEC-AGENT-07 |

Counters are Postgres-backed so they survive a restart and work across processes; the in-memory
bucket in PAP-35 is the interim. A limit that is only in the client is not a limit.

## 10. Input, output and uploads

* **Validation:** Zod 4 on every procedure input and job payload, strict objects (unknown keys
  rejected), server-side coercion only. JSON Schema is generated, never hand-written.
* **Output encoding:** React's escaping is the default; `dangerouslySetInnerHTML` requires a
  sanitiser and a reviewer sign-off, and is banned in `packages/ui` (SEC-CSP-04).
* **Uploads:** content type decided by server-side sniffing, not by the client header or the file
  name; executables, HTML and archives outside the allowlist rejected before storage
  (SEC-FILE-01).
* **SVG:** sanitised server-side, or served from the file origin as a download under the sandbox
  policy. Never inlined on an app origin (SEC-FILE-02).
* **Downloads:** URLs minted per request after an RLS-scoped read, 5 minute expiry, single tenant
  (SEC-FILE-03).
* **Archives:** extraction is bounded (entry count, total size, no path traversal, no symlinks).
* **Identifiers in URLs:** UUIDv7, never sequential; a guessable id is not a control, but a
  sequential one is an invitation.

## 11. Logging and telemetry rules

Never logged, at any level, in any environment (SEC-LOG-01): `Authorization` headers, cookies, API
keys, passwords, TOTP codes, recovery codes, signed URLs, payment tokens, age or SSH private keys.

* Redaction runs at the emitter, not only at the sink, so a local `console` in a session transcript
  is covered too.
* Prompt and tool-call logs are redacted at the hook and again at ingest, including the calling
  character's own secret values; **email addresses appear as hashes, never in full** (SEC-LOG-02).
* Telemetry drops request and response payloads and personal data; span attributes are allowlisted
  in code (SEC-LOG-06).
* `audit_event` is append-only with a per-tenant hash chain; `pnpm audit:verify` proves it
  (SEC-LOG-03). Agent mutations carry `X-PaperOS-Reason`, stored on the row (SEC-LOG-04).
* Security events (`bypass_read`, deny-list hit, lockout, scanner finding, waiver granted) have a
  catalogue and a weekly digest; S0 events alert immediately (SEC-LOG-05).
* Errors returned to a client carry `{ code, message, requestId }` and never a stack, a SQL
  fragment or a policy name.

## 12. Dependency and supply-chain policy

* **Gate:** `pnpm audit` plus an OSV scan on every change and nightly. Critical or high with a fix
  available blocks the merge; without a fix within 14 days it becomes a Needs Justin decision
  (SEC-SUP-01).
* **Pins:** exact versions for auth, crypto, parsers, the sync engine and the CRDT library; no
  caret ranges (SEC-SUP-03, ADR 0003 decision 2). Container images by digest (SEC-SUP-05). CI
  actions by commit SHA (SEC-FORGE-03).
* **Entry:** a new dependency needs a scorecard (`docs/platform/library-rubric.md`) and a
  license-policy pass; a version published less than 14 days ago needs a written reason
  (SEC-SUP-04).
* **Provenance:** a CycloneDX SBOM per release and provenance verified at deploy; an artefact whose
  provenance does not match its commit is refused (SEC-SUP-02).
* **Secret hygiene in git:** gitleaks on every diff and nightly over full history; a hit blocks the
  merge **and** starts the matching rotation runbook from section 8 (SEC-FORGE-02).
* **Lockfile:** one lockfile, committed, `--frozen-lockfile` in CI. A lockfile change in a diff that
  claims to touch only docs is a finding.

## 13. The middleware contract

`securityHeaders()` is the single implementation every surface calls. It is specified here and
implemented by Forge under `packages/core/src/security/` (follow-up issue, see PAP-219's report);
until it lands, `ops/security/headers.json` is applied by each app's own boot code and Gate 1
checks the result rather than the call site.

```ts
// packages/core/src/security/headers.ts
export interface SecurityHeadersOptions {
  profile: 'app' | 'api' | 'tauri' | 'files' | 'storybook' | 'pages-demo' | 'embedded-oss';
  origins: Record<'api' | 'web' | 'sync' | 'collab' | 'telemetry' | 'files', string>;
  reportOnly?: boolean;   // CSP-Report-Only instead of enforcing; staging rollout only
  nonce?: () => string;   // defaults to 16 random bytes, base64url
}

export const CSP_NONCE = 'cspNonce' as const;         // request-context key (SEC-CSP-01)
export function securityHeaders(o: SecurityHeadersOptions): MiddlewareHandler;
```

Contract:

1. Sets every header of the profile, plus the CSP with the per-response nonce substituted.
2. Puts the nonce on the request context under `CSP_NONCE` before any renderer runs; a renderer that
   emits a script without it produces a page that fails its own policy — which the test asserts.
3. Never merges with a caller-supplied CSP; a route that needs a different policy names a different
   profile.
4. `reportOnly` toggles the header name only, so the rollout in section 4.2 needs no code change.
5. Throws at boot on an unknown profile or an unresolved `${...}` origin placeholder: fail at start,
   not on the first request.

### What a new app inherits (checklist)

- [ ] `securityHeaders({ profile })` first in the middleware chain, before routing and body parsing.
- [ ] Origin check on mutating routes; bearer requests exempt from that check only.
- [ ] `__Host-` session cookie with the flags in section 6; nothing else carries a credential.
- [ ] CORS allowlist from `headers.json`; no reflected origin.
- [ ] Rate limits from section 9 wired to the Postgres limiter.
- [ ] RLS context set per request; no query path without it.
- [ ] Redacting logger and the audit hook installed.
- [ ] `.env.example` lists every variable by name, with no values.
- [ ] A row in `docs/reference/surfaces.md` for every new ability, and a control id for anything new
      this checklist does not already cover.

## 14. Verification matrix

| Section | Checked by | Where it runs |
| -- | -- | -- |
| 2, 3 | header snapshot test + `curl -I` assertion on the deployed host | Gate 1, deploy smoke |
| 4 | Playwright run with CSP enforced at 375 and 1280, zero violations, seeded inline script blocked | Gate 3 |
| 5, 7 | integration tests: cross-origin mutation rejected, bearer+cookie rejected, preflight shape | Gate 1 |
| 6 | cookie-flag test; storage lint (`SEC-COOK-02`) | Gate 1 |
| 8 | `node scripts/security-controls.ts --check` for coverage; quarterly timed drill for the runbook | Gate 1, quarterly |
| 9 | limiter unit tests + k6 budgets | Gate 1, Gate 4 |
| 10 | upload corpus test (types, SVG, archive bombs) | Gate 1 |
| 11 | redaction test over a secret-shaped corpus; `pnpm audit:verify` | Gate 1 |
| 12 | `pnpm audit`, OSV, gitleaks, SHA-pin lint | Gate 1, nightly |
| 13 | middleware unit tests (every header, nonce per request, report-only toggle) | Gate 1 |
