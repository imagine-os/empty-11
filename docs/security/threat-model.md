# PaperOS threat model

* Version: 2 (repo-native), 2026-09-19. Supersedes nothing; this is the code-adjacent edition of
  the plan document *PaperOS Security & Threat Model* (round 2, 2026-09-17), which stays the
  narrative version in `linear-builder/docs/security-and-threat-model.md`.
* Issue: [PAP-219](https://linear.app/paperos/issue/PAP-219) · Decision: [ADR 0024](../adr/0024-threat-model-baseline.md)
* Owner: Sentinel (Security Auditor). Reviewed by Forge (implementation) and Atlas (scope).
* Companions: [`hardening-baseline.md`](hardening-baseline.md) (the settings),
  [`incident-playbook.md`](incident-playbook.md) (what to do when one of these threats happens),
  [`../../ops/security/controls.yaml`](../../ops/security/controls.yaml) (every control with an id),
  [`../../ops/security/agent-deny.yaml`](../../ops/security/agent-deny.yaml) (section 14 as data),
  [`../../ops/security/headers.json`](../../ops/security/headers.json) (the header baseline as data).

## 1. How this document is used

This file is the reference a check points at, not an essay. Four consumers read it:

| Consumer | Reads | Fails on |
| -- | -- | -- |
| Gate 1 static checks (PAP-78) | `ops/security/headers.json`, the `verify: lint` controls | a missing header, a policy relaxation outside a named profile, a route with no `authorize()` |
| Gate 2 security reviewer (PAP-81, PAP-245) | the boundary sections and `controls.yaml` | a diff that crosses a boundary without the controls that boundary requires |
| Semgrep local rules (PAP-80) | `controls.yaml` ids | a rule id that resolves to no control, or a control with `verify: lint` and no rule |
| Review rubric `security.md` (PAP-79) | control ids | a finding without a control id or a severity |

Three rules keep it honest.

1. **Every control has an id.** `SEC-<AREA>-<nn>` in `ops/security/controls.yaml` (103 controls today,
   87 of them machine-verifiable). Prose here cites ids; it does not restate control text.
2. **No empty cells.** Every STRIDE row names a threat, a control and how the control is verified.
   Where there is no control yet, the Gap column names the issue that owns it — never a dash.
3. **Disagreement is an ADR, not an edit.** If an implementation needs something this model
   forbids, the model changes through an ADR (PAP-130) and the issue that forced it is linked from
   the row. A silent divergence is a finding.

## 2. Assets, in the order we would miss them

| # | Asset | Where it lives | Worst realistic day |
| -- | -- | -- | -- |
| A1 | Tenant business data (records, documents, files, ledger) | Postgres under RLS, object store, Yjs documents | one tenant reads another's rows; the ledger stops being evidence |
| A2 | Identities, sessions, agent keys | Postgres (Better Auth tables), OS keychain on desktop | every other control is voided because the principal is fake |
| A3 | Root credentials (age keys, forge tokens, model-provider key, payment keys) | sops-encrypted files, orchestrator host, deployment secret store | total compromise, and the bill arrives before the alert |
| A4 | Audit, prompt and tool-call logs | `audit_event`, prompt log store | we cannot prove who did what in a company where most contributors are agents |
| A5 | Code, CI and the two forges | Forgejo primary, GitHub mirror, runners | a malicious commit or dependency ships itself to production |
| A6 | Linear workspace | SaaS | the queue agents obey becomes an injection channel |
| A7 | Model credit and spend | provider account, session caps | a hijacked or looping session is a financial attack |
| A8 | Justin's external accounts | provider consoles, registrar, forge org | the root of trust for A1 to A7 |

Impact ratings used in the tables: **critical** (A1, A2 or A3 crosses a boundary), **high** (an asset
is altered or destroyed with recovery possible), **medium** (availability or spend), **low**
(information that is embarrassing but not exploitable).

## 3. Trust boundaries

Ten boundaries. The `v1` column maps them onto the round-2 document so a reference in an older
issue still resolves.

| Id | Boundary | v1 | Entry points | Principal and credential | Sections |
| -- | -- | -- | -- | -- | -- |
| B1 | Browser and PWA | B1 | oRPC over HTTPS, REST, shape proxy, collab WebSocket, static assets | human session in `__Host-paperos_session` | 4 |
| B2 | Tauri shell | B2 | `tauri://localhost`, IPC, `paperos://` deep links, updater, keychain | bearer token from the system-browser PKCE flow | 5 |
| B3 | API | B3 | `/api/v1/*`, `/api/auth/*`, `/api/sync/shape`, `/api/webhooks/*` | session cookie or API key resolved to a `Principal` | 6 |
| B4 | Postgres and RLS | B4 | pooled connections from API, jobs, migrator, replication slot | database role plus `app.*` session context | 7 |
| B5 | Sync read path | new in v2 | shape proxy to Electric, Electric to Postgres, PGlite in the client | shape registry entry plus the proxy's tenant predicate | 8 |
| B6 | Jobs and scheduler | new in v2 | pg-boss queues, cron schedules, dead-letter replays | job payload's actor, `actor_kind='system'` | 9 |
| B7 | Realtime and collaboration | B5 | Hocuspocus rooms, `live_event` push | session or `pos_agent_` key checked in `onAuthenticate` | 10 |
| B8 | Agents and orchestrator | B6 + B9 | orchestrator API and webhooks, session containers, worktrees | per-session minted key; orchestrator holds the roots | 11, 14, 15 |
| B9 | Forges and CI | B7 | git over SSH and HTTPS, Actions, API, mirror | per-character bot identity, signing keys | 12 |
| B10 | Third parties | B8 | payment and payroll webhooks, email, Linear, model provider, tailnet | provider keys, HMAC signatures | 13 |

Two boundaries are new in this edition because two decisions created them after round 2:
**B5** exists because ADR 0004 put a read path next to the API that *bypasses RLS* (Electric
replicates as a `REPLICATION` role), and **B6** exists because PAP-43's jobs run with a tenant
context nobody typed. Both are the kind of boundary that gets forgotten precisely because it was
not in the first drawing.

## 4. B1 — Browser and PWA

*Entry points:* the web app on the app origin; oRPC and REST calls to B3; `GET /api/sync/shape` to
B5; the collab WebSocket to B7; service worker and manifest.
*Data crossing:* session cookie, tenant slug, every record the principal may read, presence.
*Credential:* `__Host-paperos_session`, `Secure; HttpOnly; SameSite=Lax`.
*Assumption we do not make:* that the client is honest. Every UI permission check is decoration
(SEC-AUTH-05).

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | An injected script steals the session and acts as the user | SEC-CSP-01..04, SEC-COOK-01..02, SEC-AUTH-01 | Playwright CSP run with zero violations and a seeded nonce-less inline script that must be blocked; Semgrep bans inline handlers | none open |
| Tampering | A third-party page posts a form to a mutating route (CSRF) | SEC-CSRF-01..03, SEC-COOK-01 | integration test: cross-origin `POST` is rejected before the handler | none open |
| Repudiation | A user denies a destructive action taken in the UI | SEC-LOG-03, SEC-LOG-04 | `pnpm audit:verify` over a seeded chain | end-user-visible activity feed is PAP-38's follow-up |
| Information disclosure | A build inlines a server secret, or a referrer leaks a token | SEC-SECRET-01, SEC-HDR-04, SEC-LOG-01 | build-time guard on non-`VITE_` variables; header snapshot test | PAP-17 owns the guard; until it lands the check is the reviewer |
| Denial of service | A hostile tab loops mutations until the tenant is throttled out | SEC-RATE-01, SEC-RATE-04 | k6 budget run (PAP-242) | Postgres-backed limiter is PAP-35's follow-up; interim limiter is in-memory |
| Elevation of privilege | A user calls an admin procedure the UI hid from them | SEC-AUTH-04, SEC-AUTH-05, SEC-RLS-06 | permission matrix at policy, HTTP and UI level (PAP-64) | none open |

**Notes that are easy to get wrong.** The PWA cache must never hold an authenticated response for a
different principal: the service worker keys its cache by principal id and is cleared on sign-out
(SEC-COOK-02 covers the storage rule; the service-worker cache key is PAP-18's Definition of done).
`Cache-Control: no-store` on HTML is in the `app` profile for the same reason.

## 5. B2 — Tauri shell

*Entry points:* the WebView on `tauri://localhost`, Tauri IPC commands, `paperos://auth/callback`
deep links, the signed updater, the OS keychain.
*Data crossing:* bearer token, local cache contents, file-system paths the shell exposes.
*Credential:* a signed bearer token minted through the system browser (ADR 0003 decision 5).
*Standing facts:* WebAuthn in the Linux WebView is unavailable (WebKit bug 205350, open since
2019-12-17); WebView storage is wiped across app updates (ADR 0004 `knownLimits`), so nothing
durable may live there.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | Another local app registers `paperos://` and catches the auth callback | SEC-AUTH-02 (PKCE, single-use, state-bound), SEC-AUTH-03 | unit test: a replayed or unbound callback is refused | PAP-225 owns the flow; deep-link hijack test is its DoD |
| Tampering | A malicious update is served to the shell | SEC-SUP-02, plus updater signature verification | release pipeline verifies signature and provenance before publishing | supply-chain issue `security/supply-chain` owns provenance at deploy |
| Repudiation | A desktop action cannot be tied to a device | SEC-LOG-04, SEC-KEY-01 | audit rows carry session and device id | device id on the session is PAP-260's follow-up |
| Information disclosure | The token is readable on disk, or the local cache survives a user switch | SEC-COOK-02, SEC-COOK-03, SEC-SYNC-05 | keychain adapter unit test; cache-wipe test on principal change | macOS keychain behaviour unverified — needs a Mac runner (Needs Justin) |
| Denial of service | The local database fills the disk or fails to open, leaving the app unusable offline | SEC-SYNC-05, SEC-RATE-04 | test: corrupt or absent local store falls back to server-only mode | PGlite memory on mid-range Android unmeasured (ADR 0004 C6) |
| Elevation of privilege | An IPC command or capability lets the WebView read arbitrary files | SEC-HDR-06, SEC-CSP-06, SEC-AUTH-02 | capability allowlist snapshot test; Semgrep rule on allowlist widening | PAP-255 owns the capability set |

**The rule that matters most here:** the WebView is not trusted more than a browser tab. Tauri
capabilities are scoped to the main window, the shell exposes no generic file or shell command, and
`navigator.credentials` is never called in the WebView (SEC-AUTH-02).

## 6. B3 — API

*Entry points:* `/api/v1/rpc/*` and the REST projection, `/api/auth/*`, `/api/sync/shape` (proxied
to B5), `/api/webhooks/<source>`, `/api/v1/security/csp-report`.
*Data crossing:* everything. This is where a principal becomes an RLS context.
*Credential:* session cookie (web), bearer session (desktop), `pos_agent_` or `pos_live_`/`pos_test_`
API key.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A forged webhook triggers a paid or destructive action | SEC-ORCH-02, SEC-TP-02 | signature and replay tests per source | none open |
| Tampering | Mass assignment writes a field the caller may not set (role, tenant, amount) | SEC-RATE-03, SEC-AUTH-04, plus strict Zod input schemas | schema tests reject unknown keys; reviewer checks every new procedure | none open |
| Repudiation | An agent mutation lands with no reason recorded | SEC-LOG-04, SEC-RLS-03 | integration test: agent mutation without `X-PaperOS-Reason` is rejected | none open |
| Information disclosure | An id from another tenant is read through a procedure that forgot the tenant filter (IDOR) | SEC-AUTH-06, SEC-RLS-01, SEC-RLS-06, SEC-FILE-03 | cross-tenant HTTP matrix (PAP-64) and the RLS harness (PAP-34) | connector secrets are still stored in clear — `security/field-encryption`, covered by SEC-SECRET-05 as planned |
| Denial of service | An unbounded list or a 200 MB body ties up the single host | SEC-RATE-01..04 | k6 budgets; payload cap tests | Postgres-backed limiter pending (PAP-35 follow-up) |
| Elevation of privilege | A new procedure ships with no `authorize()` and inherits ambient trust | SEC-AUTH-04, SEC-AUTH-05 | Semgrep S0 rule plus the spec-conformance reviewer | none open |

**Error shape is a security control.** `42501` becomes `NOT_FOUND` on reads and `FORBIDDEN` on
writes (SEC-RLS-06); no error body, header or timing tells a caller that a row exists in a tenant
they cannot see. `explain` output from `can()` is non-production only.

## 7. B4 — Postgres and RLS

*Entry points:* pooled connections from the API and the jobs worker as `paperos_app`, the migrator
connection as `paperos_owner`, the replication slot as `electric`, a read-only role for analytics.
*Data crossing:* every tenant row, the audit chain, the ledger.
*Credential:* database role plus `SET LOCAL app.tenant_id, app.actor_id, app.actor_kind,
app.request_id, app.reason, app.bypass` (contracts section 1). Missing context fails closed.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A service connects as the wrong role and inherits bypass rights | SEC-RLS-02, SEC-ORCH-01 | connection-string scan in CI; role attributes asserted in a migration test | none open |
| Tampering | Audit or ledger rows are edited to hide an action | SEC-LOG-03, SEC-PII-02 | `pnpm audit:verify` hash chain; posted-entry immutability test | none open |
| Repudiation | `app.bypass` is used with no trace | SEC-RLS-04, SEC-LOG-05 | Semgrep rule plus a test that a bypass writes an audit row and a security event | `security/security-telemetry` owns the digest |
| Information disclosure | A query without context returns every tenant's rows | SEC-RLS-01, SEC-RLS-03, SEC-RLS-05 | RLS harness: every table has a cross-tenant denial test (PAP-34) | tables added by later modules must be added to the harness; the harness fails on an unregistered table |
| Denial of service | A replication slot stalls and WAL fills the disk | SEC-SYNC-01, plus lag alerting | lag alert at threshold (PAP-40) | `security/platform-dr` owns the disk-full runbook |
| Elevation of privilege | A migration runs as owner from a request path | SEC-RLS-02, SEC-RLS-03 | migrations run only as a pre-deploy step (PAP-26); scan for owner credentials outside the migrator | none open |

**Fail closed, not open.** A policy that returns rows when `app.tenant_id` is `NULL` would be worse
than no policy at all, because it looks like it works. `FORCE ROW LEVEL SECURITY` plus a test that
asserts zero rows on missing context is the only acceptable shape (SEC-RLS-01).

## 8. B5 — Sync read path (Electric shape proxy and the local store)

*Entry points:* `GET /api/sync/shape` on B3, the proxy's connection to Electric, Electric's
replication connection to Postgres, PGlite in the client.
*Data crossing:* whole shapes of tenant rows, continuously, to every connected client.
*Credential:* the caller's session or key at the proxy; **inside** the boundary Electric holds a
`REPLICATION` role.

> **ADR 0004, consequence C1:** Electric bypasses RLS on the read path. The shape proxy is
> therefore *the only* tenant boundary for reads. It is a security component, not plumbing.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A client reaches Electric directly and skips the proxy | SEC-SYNC-01 | port scan in the compose smoke test (PAP-754); network policy assertion | none open |
| Tampering | A client-supplied filter widens the shape or replaces the tenant predicate | SEC-SYNC-03 | proxy unit tests over a hostile-filter corpus (only `AND` narrowing accepted) | none open |
| Repudiation | Nobody can say which shapes a principal streamed | SEC-LOG-05, SEC-LOG-06 | shape requests logged with principal, shape id and row count | shape-level audit is a `security/security-telemetry` row |
| Information disclosure | A shape's predicate drifts from the table's RLS policy and leaks a neighbouring tenant | SEC-SYNC-02, SEC-SYNC-04 | drift test comparing shape predicate to policy expression; per-shape cross-tenant denial test | none open — but every new shape must add its denial test, which is its DoD |
| Denial of service | A 500k-row shape is requested and the single host streams until it falls over | SEC-RATE-04, SEC-SYNC-02 | shape size cap test; registry requires a narrowing predicate above 10k rows | shapes above ~10k rows need per-view narrowing (ADR 0004 `knownLimits`) |
| Elevation of privilege | The local store is trusted as an authority and a client writes to Postgres directly | SEC-SYNC-05, plus the outbox rule (PAP-272) | test: a direct client write path does not exist; local store is read-through cache | none open |

**Treat the local database as hostile storage.** It is a cache that the user, another app or an OS
update can read or wipe (ADR 0004 C4). No secret, no other tenant's row and no audit data goes in
it; the durable outbox lives outside the WebView-owned store on Tauri (SEC-SYNC-05).

## 9. B6 — Jobs and scheduler

*Entry points:* `enqueue()` from the API and from other jobs, cron schedules, dead-letter replay,
the admin queue view.
*Data crossing:* whatever the payload carries — which is the risk.
*Credential:* the enqueuing actor, propagated; platform jobs run with `actor_kind='system'`.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A replayed dead-letter job runs with a different, higher-privileged actor | SEC-JOB-01, SEC-JOB-03 | replay test asserts the original actor and tenant, or refuses | replay UI is PAP-43's follow-up |
| Tampering | A payload is edited in the queue table to change an amount or a target | SEC-JOB-01, SEC-RLS-01 | dequeue-side Zod validation test; queue tables are not tenant-writable | none open |
| Repudiation | A side effect has no actor because a job did it | SEC-LOG-04, SEC-JOB-01 | audit rows from jobs carry `actor_kind='system'` and the causing request id | none open |
| Information disclosure | A secret or a full email sits in a job argument, a retry row or a dead letter forever | SEC-JOB-02, SEC-LOG-01 | redaction test over the payload corpus; Semgrep rule on secret-shaped payload fields | retention of dead letters is a `security/retention-pii` row |
| Denial of service | A poison job retries forever and starves the queue | SEC-RATE-01, plus retry caps and dead-lettering | job retry-cap test; queue depth alert | queue-depth alerting is PAP-40's follow-up |
| Elevation of privilege | A job runs with no tenant context and therefore sees everything | SEC-JOB-03, SEC-RLS-01 | test: a context-free job not on the platform allowlist fails at enqueue | none open |

## 10. B7 — Realtime and collaboration

*Entry points:* Hocuspocus rooms `doc:<tenant>:<type>:<id>`, awareness and presence channels,
`live_event` push.
*Data crossing:* document state, presence, cursor positions.
*Credential:* session cookie or `pos_agent_` key verified in `onAuthenticate`.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A stolen or expired token joins a room and edits as someone else | SEC-RT-01, SEC-AUTH-03 | connect tests: expired, revoked and wrong-tenant tokens are refused | none open |
| Tampering | A read-only collaborator's updates are applied because the check was client-side | SEC-RT-02 | server drops updates from a readOnly connection (test) | none open |
| Repudiation | An edit cannot be attributed to a human or an agent | SEC-RT-03, SEC-LOG-03 | awareness carries `principalId`; agents are visually distinct (PAP-141, PAP-146) | per-update attribution in document history is PAP-140's follow-up |
| Information disclosure | Presence reveals who is in a document, or an email address in awareness | SEC-RT-03 | presence payload snapshot test asserts the allowlisted fields only | none open |
| Denial of service | A 20 MB document or an update storm saturates the collab process | SEC-RATE-04, SEC-RT-01 | document size cap; throttle test; load test (PAP-147) | load test is PAP-147, scheduled |
| Elevation of privilege | An unknown entity type creates an unpoliced room | SEC-RT-01 | unknown entity type closes with 4403 (test) | none open |

## 11. B8 — Agents and orchestrator

This boundary has two halves that fail differently: the **host** that holds the roots, and the
**session** that runs untrusted-ish text with tools. Both are in scope here because an attacker who
owns a session is one mistake away from the host.

*Entry points (host):* the orchestrator API (tailnet only), inbound webhooks, the deploy path.
*Entry points (session):* the rendered prompt, the issue body and comments it reads, PR diffs, web
pages, tool output, MCP servers, the worktree.
*Credential:* the host holds the root keys; a session holds a per-session minted key and broker
placeholders.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A comment that is not Justin's says "approved" and a session acts on it | SEC-AGENT-04, SEC-AGENT-03 | trust-tier test: an approval grammar match below T1 is ignored | `security/prompt-injection` owns the full suite |
| Tampering | A session edits its own hooks, deny list, bundle or memory to widen its reach | SEC-AGENT-09, SEC-AGENT-10, DENY-FS-03 | path-deny hook test; memory review gate | server-side backstop for `.claude/**` is the review pass until PAP-106 lands |
| Repudiation | A destructive action cannot be traced to a session and a prompt | SEC-LOG-02, SEC-KEY-01 | every prompt, tool call and denial is logged with the session id | prompt-log store is PAP-129 |
| Information disclosure | An injected instruction exfiltrates a credential through `curl` or an `env` dump | SEC-AGENT-06, SEC-ORCH-04, DENY-SECRET-01, DENY-SECRET-02 | canary test: a canary value in a fixture must never leave the network; egress allowlist test | credential broker is `security/credential-broker` |
| Denial of service | A looping session burns the month's model credit in an afternoon | SEC-AGENT-07, SEC-KEY-04 | spend-cap test; kill after three S0 denials; provider account limit as the outer wall | PAP-111 owns the caps |
| Elevation of privilege | A poisoned issue drives a destructive git, database or payment action | SEC-AGENT-01, SEC-AGENT-02, section 14's rules with their backstops | deny-list hook test per rule; backstop asserted for every S0 | sandbox is `agents/runtime-sandbox`; deny list is partially enforced today |

**Host-side controls that do not fit a STRIDE row.** Only 80 and 443 are public (SEC-ORCH-01);
secrets are sops-encrypted with two recipients (SEC-ORCH-03); the orchestrator is the only holder of
the root keys and mints per-session credentials (SEC-ORCH-05); egress from session containers is
allowlisted (SEC-ORCH-04).

## 12. B9 — Forges and CI

*Entry points:* git over SSH and HTTPS, Actions and Forgejo runners, forge APIs, the mirror.
*Data crossing:* all source, CI secrets, release artefacts.
*Credential:* per-character bot identities with SSH signing keys (PAP-48).

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A commit is attributed to a character that did not write it | SEC-FORGE-04, SEC-FORGE-05 | commitlint on the push range; `allowed_signers` once signing is on | signing is gated on PAP-48 (ADR 0010 section 6) |
| Tampering | History on `main` is rewritten, or a ruleset is edited away | DENY-GIT-01, DENY-GIT-02, DENY-FORGE-01, SEC-FORGE-01 | hook test per rule; rulesets in `ops/forge/rulesets/` reviewed as code | rulesets are **not applied** (Needs Justin); build-loop exception, see 14.3 |
| Repudiation | Nobody can say which issue a change belongs to | SEC-FORGE-05 | commitlint requires a `Linear:` trailer or a `PAP-<n>` scope | none open |
| Information disclosure | A secret is committed, or a fork workflow reads one | SEC-FORGE-02, SEC-FORGE-03, SEC-SECRET-01 | gitleaks on diff and nightly history; workflow permission lint | history scan is PAP-80 |
| Denial of service | The forge or the runner fleet is down and nothing can merge | mirror topology plus the DR drill | monthly forge restore drill (PAP-274) | `security/platform-dr` owns the drill |
| Elevation of privilege | A malicious dependency or a floating action tag executes in CI with a token | SEC-SUP-01..05, SEC-FORGE-03 | OSV and `pnpm audit` gate; SHA-pinned actions lint; digest-pinned images | provenance at deploy is `security/supply-chain` |

## 13. B10 — Third parties

*Entry points:* payment and payroll webhooks and APIs, transactional email, Linear, the model
provider, the tailnet.
*Data crossing:* customer contact data, invoice and payout metadata, prompts.
*Credential:* provider keys (restricted where the provider supports it), HMAC signatures inbound.

| STRIDE | Realistic scenario | Controls | Verified by | Gap |
| -- | -- | -- | -- | -- |
| Spoofing | A fake webhook marks an invoice paid | SEC-TP-02, SEC-ORCH-02 | signature and replay tests; event-id inbox | none open |
| Tampering | An agent triggers a live refund or payout while "testing" | SEC-TP-01, DENY-PAY-01 | Semgrep ban on live-key literals; test keys only in session environments | live-mode enablement is a Needs Justin decision |
| Repudiation | A provider event has no local record | SEC-TP-02, SEC-LOG-03 | inbox row per event with payload hash | none open |
| Information disclosure | Card or bank data touches our servers or logs | SEC-TP-03, SEC-LOG-01 | PAN and IBAN shaped-field scan; provider-hosted flows only | `security/pci-posture` owns the quarterly SAQ-A check |
| Denial of service | A provider outage blocks sign-in or checkout | SEC-RATE-01, plus retries and a degraded mode | outage simulation in the edge-case suite (PAP-85) | degraded-mode UX is PAP-234's state components |
| Elevation of privilege | An over-scoped provider key lets a small service do anything | SEC-ORCH-05, SEC-TP-01 | key inventory review; restricted keys per service | inventory review is manual, quarterly (SEC-ORCH-05) |

## 14. Destructive-action deny list

The list lives as data in [`ops/security/agent-deny.yaml`](../../ops/security/agent-deny.yaml)
(23 rules today). This section is the rationale and the exception record; the file is the authority.

### 14.1 Enforced three times

1. **PreToolUse hook** in every session bundle (PAP-106) matches the rule's `surface` and `match`
   before the tool runs.
2. **Tool removal:** MCP tools carrying the `destructive` scope are absent from every character
   bundle except Atlas (PAP-210, SEC-AGENT-02). A rule you cannot reach is better than a rule you
   must catch.
3. **Backstop** outside the agent: every `S0` rule names one (`backstop:` in the file) — a forge
   ruleset, a database role, an absent credential, a provider restriction. A rule whose only
   enforcement is the hook is one prompt away from being useless, so `S0` without a backstop is
   itself a finding (checked by `node scripts/security-controls.ts --check`).

Rule families: git history, filesystem and secrets, database, Linear, forges and CI, payments and
payroll, infrastructure, secret exfiltration, communications, agents. Severities: `S0` kill the
session and file a decision card, `S1` deny and record a finding, `S2` warn and log.

### 14.2 When a blocked action is the right action

`/request-approval` files a PAP-94 decision card containing the exact command, the rule id and why
the session believes it is necessary, and then the session ends. Justin answers the card. Nothing
retries a blocked action with a cleverer spelling; that is itself an S0 pattern.

### 14.3 The build-loop exception (active)

Justin's org policy runs the build loop **git-only, with no pull requests**, and no forge ruleset
has been applied to the repositories yet (ADR 0010 section 1). Three rules therefore carry a mode
exception, marked `mode: build-loop` in the file:

| Rule | Normally | In build-loop mode | Ends when |
| -- | -- | -- | -- |
| `DENY-GIT-03` | no direct push to `main` or `release/*` | a builder may `git push origin HEAD:main` for its own issue branch, rebased, with a green `pnpm check`, at most twice, never with force, after pushing its branch to origin | `ops/forge/rulesets/*` are applied (Needs Justin) |
| `DENY-FORGE-02` | only the Merger merges pull requests | inert: there are no pull requests | same |
| `DENY-GIT-04` | never rewrite a commit | unchanged: a session may amend or rebase **its own unpushed** commits only | not an exception; the normal worktree flow |

What the exception does **not** relax, and Sentinel treats a breach as S0 regardless of mode:
force-push, ref deletion, rewriting another session's commits, pushing a red check, and pushing to
`main` for an issue the session did not claim. The three properties the pull-request flow exists to
guarantee still hold in this mode — `main` is green, history is linear, every commit resolves to one
issue and one character (ADR 0010 section 1).

When the rulesets are applied, this section and the `modes.active` field flip together, in one
change, with an ADR entry: the exception is dated and reversible, not a habit.

## 15. Prompt-injection trust tiers

Untrusted text is the main attack surface of an agent-built product, so it gets a tier, not a
judgement call.

| Tier | Source | May instruct? | Handling |
| -- | -- | -- | -- |
| T0 | the orchestrator's rendered prompt | yes | the instruction section |
| T1 | a Linear comment whose author id is Justin's | yes | approval, kill and state grammars accept T1 only (SEC-AGENT-04) |
| T2 | issue bodies, bot comments, other sessions' reports | no | wrapped in an untrusted block with source and tier (SEC-AGENT-03) |
| T3 | fork diffs, imported documents, web pages, third-party API responses | no | wrapped, scanned, and reviewers run with no MCP servers (SEC-AGENT-05, SEC-AGENT-08) |
| T4 | scanner and tool output quoting attacker-controlled text | no | wrapped and truncated; never executed |

The scanner strips instruction overrides, hidden HTML, zero-width and bidi characters, base64 blobs
and tool-call lookalikes, and posts what it removed (SEC-AGENT-05). A `Ready for Claude` issue
carries a spec hash; an edit by anyone but Justin before the claim bounces it back to Backlog.
Canary values live in fixtures and secret maps: if one ever appears in outbound traffic, that is an
S1 incident by definition (see the playbook).

## 16. Gap register

Every "Gap" cell above resolves to one of these. A gap is a named owner and an issue, never a
shrug. The first five are P0 for the hardening milestone.

| Gap | What is missing | Owning issue or key | Blocked by |
| -- | -- | -- | -- |
| Deny-list enforcement | the hook, not just the file | PAP-106 + `security/agent-deny-list` | PAP-210 |
| Prompt-injection suite | the 60-attack nightly suite and the scanner | `security/prompt-injection` | PAP-92, PAP-97 |
| Credential broker | placeholders, per-host injection, `revoke --all` | `security/credential-broker` | PAP-96, PAP-48, PAP-25 |
| Break-glass | offline recovery path for the root of trust | `security/founder-break-glass` | PAP-25 |
| Field encryption | connector secrets are stored in clear today | `security/field-encryption` | PAP-32, PAP-17 |
| Platform DR | the 4 hour whole-platform restore drill | `security/platform-dr` | PAP-30, PAP-37, PAP-140, PAP-96 |
| Retention and PII | classification, retention jobs, DSAR registry | `security/retention-pii` | PAP-33, PAP-43, PAP-38 |
| Security telemetry | event catalogue, weekly digest, bypass alerts | `security/security-telemetry` | PAP-40, PAP-97, PAP-38 |
| DAST | nightly dynamic scan and the IDOR suite | `security/dast` | PAP-80, PAP-240, PAP-26 |
| Supply chain | SBOM, provenance at deploy, digest pinning | `security/supply-chain` | PAP-80, PAP-52, PAP-26 |
| PCI posture | SAQ-A checklist, restricted keys, PAN rules | `security/pci-posture` | PAP-177, PAP-184 |
| Rulesets applied | the forge protections exist as files only | PAP-46 (Needs Justin) | PAP-45, PAP-48 |
| Mac verification | keychain and WebView behaviour on macOS | PAP-225, PAP-260 (Needs Justin: a Mac runner) | hardware |

## 17. What changed from v1, and what we disagree with

Kept as-is: the asset list, the deny-list families, the secrets model, the injection tiers, the
backup and compliance posture. Changed, with reasons:

1. **Two new boundaries.** B5 (sync read path) and B6 (jobs) did not exist in v1. B5 is forced by
   ADR 0004: an RLS-bypassing read path is a boundary whether or not we call it one. B6 is forced by
   PAP-43: a job carries a tenant context nobody typed at a keyboard.
2. **v1's B5 (Yjs) is now B7, and v1's B6 + B9 are one boundary, B8.** The orchestrator host and the
   agent session share a blast radius; splitting them hid the step from one to the other. The
   mapping table in section 3 keeps old references resolvable.
3. **Every control has an id and a verification mode.** v1 named controls in prose. 87 of the 103
   controls are now machine-verifiable, which is the difference between a document and a gate.
4. **The build-loop exception is written into the deny list as data,** with an end condition, rather
   than living only in a brief. An undocumented exception is indistinguishable from a breach.
5. **HSTS is two years, not "2 years preload" as an aspiration:** `max-age=63072000;
   includeSubDomains; preload`, which satisfies the preload list's one-year minimum with margin.

No disagreement with v1 has risen to an ADR of its own; where this file and v1 differ, **this file
governs the repository** and v1 stays the narrative for the plan. A future disagreement about
substance — not shape — is a new ADR that supersedes 0024.

## 18. Standards referenced

Cited with the version or retrieval date, because a security document that says "per OWASP" without
a date is unverifiable.

| Standard | Version and date |
| -- | -- |
| OWASP Application Security Verification Standard | 5.0.0, released 2025-05-30 (Global AppSec EU); 17 chapters V1..V17 |
| OWASP Top 10 | 2025 edition, announced 2025-11 at Global AppSec Washington DC, final published 2026-01; A01 Broken Access Control, A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging and Alerting Failures, A10 Mishandling of Exceptional Conditions |
| OWASP Top 10 for LLM Applications | 2025 list (LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM06 Excessive Agency, LLM10 Unbounded Consumption) |
| Content Security Policy Level 3 | W3C Working Draft, 2026-08-13 |
| HSTS preload requirements | hstspreload.org, retrieved 2026-09-19: `max-age` at least 31536000, plus `includeSubDomains` and `preload` |
| Cookies (SameSite, `__Host-` prefix) | draft-ietf-httpbis-rfc6265bis-20, still an Internet-Draft as of 2026-09-19; `draft-ietf-httpbis-layered-cookies` is set to obsolete it |
| NIST SP 800-63B-4 Digital Identity Guidelines | final, 2025-08 |
| NIST SP 800-61r3 Incident Response Recommendations | 2025-04-03, aligned to CSF 2.0 (Govern, Identify, Protect, Detect, Respond, Recover) |
| GDPR | Articles 5, 15, 17, 33 (72 hour notification) and 34 |
| PCI DSS | 4.0.1, SAQ-A scope only |

## 19. Review cadence and how this document changes

* **Every pass:** a diff that adds a route, a table, a shape, a job, a room, an MCP tool or a
  provider adds or updates a row here and a control in `controls.yaml`, in the same commit. A diff
  that crosses a boundary with no such change is a Gate 2 finding.
* **Monthly:** Sentinel rehearses one boundary's containment steps (SEC-INC-02) and closes or
  re-dates the gap register.
* **Quarterly:** the `verify: manual` controls come due on their cadences; the standards table is
  re-checked for new versions; the device-matrix-dependent items (Trusted Types, WebView passkeys)
  are re-tested.
* **On incident:** the playbook's post-mortem adds the missed threat as a row with a new control id,
  and the calibration log records why the model did not predict it.
