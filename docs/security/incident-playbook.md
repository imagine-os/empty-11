# PaperOS security incident playbook

* Version: 1, 2026-09-19. Issue: [PAP-219](https://linear.app/paperos/issue/PAP-219) ·
  Decision: [ADR 0024](../adr/0024-threat-model-baseline.md) · Owner: Sentinel.
* Aligned to NIST SP 800-61r3 (2025-04-03) and its CSF 2.0 functions; GDPR Articles 33 and 34 set
  the notification clock.
* Companions: [`threat-model.md`](threat-model.md) (which boundary is on fire),
  [`hardening-baseline.md`](hardening-baseline.md) section 8 (rotation runbooks).

## 1. What makes this playbook unusual

PaperOS is built and largely operated by agents, and there is **one human**: Justin. Two
consequences shape everything below.

1. **An agent may be the incident.** A session that was prompt-injected, that deleted something, or
   that spent the month's credit in an afternoon is as likely as an external attacker. The first
   containment question is therefore always *"is a session still running?"*.
2. **Paging a human is expensive and must be worth it.** Only S0 and S1 page Justin. Everything
   else is contained by machines and reported in the weekly digest. In exchange, an S0 page is
   never a false alarm we could have filtered.

A machine may contain, revoke, kill and preserve without asking. A machine may **not** decide to
notify a customer or a regulator, grant a waiver, or turn a control off. Those are Justin's
(SEC-INC-01, SEC-INC-04).

## 2. Severity taxonomy

| Sev | Definition | Examples | Ack | Containment | Who is told |
| -- | -- | -- | -- | -- | -- |
| **S0** | Confirmed cross-tenant data access, credential compromise with real data reachable, or an agent action that destroyed or exposed production data | one tenant read another's rows; a root key in a public diff; production table dropped; live payment moved by an agent | 15 min | immediate, before diagnosis | Justin: Needs Justin card **and** email, within 15 min of detection |
| **S1** | A control failed and exposure is plausible but unproven; or availability of the whole platform is lost | canary value appeared in outbound traffic; RLS policy missing on a live table; deny-list breach; orchestrator host compromised-looking | 1 h | within 1 h | Justin: Needs Justin card within 1 h; email if unresolved in 4 h |
| **S2** | A control failed with no plausible exposure; or a single tenant's availability is degraded | CSP violation class from our own code; rate limiter open for one route; expired dependency advisory past SLA | 1 business day | within 1 day | weekly digest; Linear issue at priority 1 |
| **S3** | Hygiene: a finding that is not exploitable today | missing header on a non-credential host; a `verify: manual` control past its cadence | 1 week | with the next pass | weekly digest |

Severity is set by the responder at detection and **only ever revised upward during the incident**;
downgrades happen in the post-mortem, with the reason recorded. If two responders disagree, the
higher severity wins until Atlas rules.

## 3. Roles, with one human

| Role | Who | Does |
| -- | -- | -- |
| Incident lead | Sentinel (Security Auditor session, dedicated) | declares, contains, preserves, writes the timeline; owns the incident until closed |
| Deputy / comms | Atlas | files the Needs Justin card, keeps the issue updated, coordinates other characters, stops unrelated work if needed |
| Implementer | Forge (or the boundary's owning character) | applies the fix under the lead's direction |
| Decision maker | Justin | notification, waivers, live-mode and spend decisions, anything irreversible |
| Scribe | the incident issue itself | every action timestamped as a comment; no side channels |

The session that caused an incident never leads it and never investigates itself; it is stopped and
its transcript becomes evidence.

## 4. Paging path (to be confirmed by Justin)

1. **Needs Justin card** in Linear, priority 1, title `INCIDENT S<n>: <one line>`, body from the
   template in section 12, with `/approve` and `/reject` options where a decision is needed.
2. **Email** to Justin's address on file, subject `PaperOS INCIDENT S<n> — <one line>`, containing
   the card link and the current containment state.
3. **Fallback** if neither is acknowledged within the Ack window: repeat both at the interval of the
   severity (S0 every 15 min, S1 hourly) and record each attempt on the card.

> **Open item (PAP-219 Definition of done).** Justin confirms this paging path in one comment on
> PAP-219, including whether email is the right second channel or whether a phone-reaching channel
> (SMS or push) should be added for S0. Until he does, the playbook assumes card + email and says so
> in every S0 card.

## 5. The first fifteen minutes

Do these in order. Do not diagnose first; diagnosis is step 7.

1. **Declare.** Create the incident issue (`INCIDENT S<n>: …`), start the timeline, set severity.
2. **Freeze the agents.** Pause the orchestrator queue; stop new session starts. Kill any session
   implicated in the incident (`SEC-AGENT-07` kill path) — a running session can keep making it
   worse while you read.
3. **Preserve evidence** (section 6) — before any remediation touches the affected system.
4. **Contain** the boundary (section 7).
5. **Revoke** what the attacker may hold: sessions, agent keys, API keys, tokens (SEC-KEY-04,
   `pnpm revoke --all` for agent credentials).
6. **Page** per section 4 if S0 or S1.
7. Only now: diagnose, with the timeline open and every action written down as you take it.

## 6. Evidence, before remediation

Collect and hash **first**; a rollback or a redeploy destroys the evidence that tells you what
happened (SEC-INC-03).

| Evidence | How | Retention |
| -- | -- | -- |
| Request and error logs for the window | export from the collector, `sha256sum` the file | 12 months |
| `audit_event` rows for the window, plus a chain verification | `pnpm audit:verify --from <t0> --to <t1>` output attached | with the incident, indefinitely |
| Session transcripts: prompts, tool calls, denials | prompt-log export for every session in the window | 12 months |
| Database state | PITR marker plus a logical snapshot of the affected tables | until closed + 90 days |
| Container image digests and the deployed commit SHA | from the deployment record | with the incident |
| Network egress log for the session containers | proxy log export | 12 months |
| Object store access log | provider log export | 12 months |

Store under `docs/evidence/INCIDENT-<date>-<n>/` with a manifest of file names and hashes. Redact
secrets in the manifest, never in the evidence itself; the evidence bundle is not public.

## 7. Containment by boundary

| Boundary | First containment action | Second | Cost of the action |
| -- | -- | -- | -- |
| B1 Browser | invalidate all sessions (rotate the auth signing secret, S5); force sign-in | ship the CSP or cookie fix | everyone signs in again |
| B2 Tauri | revoke bearer tokens; publish a forced-update build if the shell is implicated | pull the bad update from the channel | desktop users re-authenticate |
| B3 API | disable the affected route at the edge (return 503 with a code); tighten the limiter | patch and redeploy | that feature is down |
| B4 Postgres | set the app role read-only (`ALTER ROLE … SET default_transaction_read_only`); block non-tailnet access | rotate S1/S2/S3, restore from PITR if data was altered | writes stop platform-wide |
| B5 Sync | stop the shape proxy (clients fall back to API reads); Electric is then unreachable by design | fix the shape registry or predicate; re-enable per shape | sync and offline reads stop |
| B6 Jobs | pause the queue; stop the scheduler; quarantine dead letters | replay with corrected payloads after the fix | scheduled work delays |
| B7 Realtime | close all rooms (`readOnly` globally, then disconnect) | fix `onAuthenticate`; reopen per entity type | live editing stops; documents are safe in Postgres |
| B8 Agents and orchestrator | kill all sessions; pause the queue; `pnpm revoke --all`; if the host is implicated, cut its egress and take it off the tailnet | rebuild the host from `ops/` on a new machine, restore state | the build loop stops entirely |
| B9 Forges and CI | disable the runners; freeze `main` (apply the ruleset — this also ends build-loop mode); revoke bot tokens (S8, S9, S10) | audit the push and workflow log for the window | nothing merges or deploys |
| B10 Third parties | roll the restricted keys (S14) and webhook secrets (S15); switch the provider to test mode if available | reconcile events from the provider's log after re-enabling | payments and mail pause |

Containment that is reversible is preferred to containment that is clean. Read-only is better than
down; down is better than leaking.

## 8. Eradication, recovery and closing

1. **Eradicate:** remove the cause, not the symptom — the missing policy, the widened allowlist, the
   unpinned action, the missing origin check. Add the control id and the test *in the same change*.
2. **Rotate** every credential in the blast radius using section 8 of the baseline, and attach the
   proof-of-death output (SEC-SECRET-03).
3. **Recover:** restore data from PITR or backups if it was altered; verify the audit chain still
   verifies after restore; re-enable each contained component one at a time with a check after each.
4. **Verify:** run the gates. For an S0 or S1, also run the cross-tenant harness (PAP-34) and the
   permission matrix (PAP-64) before declaring recovery, whether or not they are implicated.
5. **Close** only when: the cause is fixed with a test that fails without the fix; every credential
   in the radius is rotated with proof; evidence is stored with its manifest; the post-mortem is
   merged; and, for S0 and S1, Justin has acknowledged the card.

## 9. Agent-specific incidents

| Incident | Detection | Immediate action | Lasting fix |
| -- | -- | -- | -- |
| Prompt injection acted on | a session took an action no one asked for; a canary appeared in traffic | kill the session; quarantine the source text; raise the tier of that source | scanner rule + a case in the nightly attack suite (SEC-AGENT-05) |
| Deny-list breach | a hook denial that the session worked around, or an action with no denial where a rule exists | kill the session; verify the backstop held; if it did not, that is S0 | fix the rule and its backstop; add the hook test (SEC-AGENT-01) |
| Runaway spend | spend caps or the provider's usage graph | kill the session; lower the cap; check for a loop | cap enforcement plus the loop detector (PAP-111, SEC-AGENT-07) |
| Credential in a transcript | gitleaks, the log redaction test, or a reviewer's eyes | rotate that class immediately (section 8); purge the transcript from the log store | redaction pattern added at the hook and at ingest (SEC-LOG-02) |
| Rogue destructive action | audit event, forge log, or a missing branch | preserve, then restore from backup or reflog; kill the session | new deny rule with a backstop; server-side check |
| Wrong-tenant write by an agent | audit row with mismatched tenant | freeze the tenant's writes; correct with a reversing entry, never an edit | context propagation test (SEC-RLS-03, SEC-JOB-01) |

## 10. Personal-data breach: the 72-hour checklist

GDPR Article 33 gives 72 hours from **awareness** to notify the supervisory authority where a
personal-data breach is likely to risk individuals' rights; Article 34 covers telling the people
affected. The clock starts at detection, not at diagnosis. Run the checklist even when the answer
turns out to be "no notification required" — the decision has to be recorded (SEC-INC-04).

| # | Step | Owner | By |
| -- | -- | -- | -- |
| 1 | Record the awareness timestamp on the incident issue | Sentinel | T+0 |
| 2 | Decide personal data in scope: which columns, which tenants, how many people, special categories | Sentinel + Forge | T+4 h |
| 3 | Assess likelihood and severity of risk to individuals | Atlas → Justin | T+12 h |
| 4 | Draft the Article 33 notification: nature, categories and approximate numbers, contact point, likely consequences, measures taken | Atlas | T+24 h |
| 5 | Justin's decision: notify, or record why not | **Justin** | T+48 h |
| 6 | Notify the supervisory authority if decided | **Justin** | T+72 h |
| 7 | Decide and, if required, execute Article 34 communication to affected people | **Justin** | without undue delay |
| 8 | Notify affected tenants under their contract terms, with facts and remediation | Atlas | T+72 h |
| 9 | File the decision record and the notification text in the evidence bundle | Sentinel | at close |
| 10 | Phase-two notification if facts changed after the first | Atlas | as needed |

If the data was encrypted at field level with keys the attacker did not reach, say so in step 2 with
the control id (SEC-SECRET-05) — it changes the risk assessment, and it is the reason that control
exists.

## 11. Communication templates

**Needs Justin card (S0/S1).**

```
INCIDENT S<n>: <one line, no jargon>

Detected: <ISO timestamp> by <detector>
Boundary: <B#> — <name>
Status: <contained | containing | investigating>
Blast radius: <assets, tenants, credentials>
Personal data: <yes/no/unknown> — 72 h clock started <timestamp or n/a>
Contained by: <actions already taken, with timestamps>
Credentials rotated: <classes, or none yet>
What I need from you: <decision, one sentence>
Evidence: docs/evidence/INCIDENT-<date>-<n>/
Timeline: <issue link>
Paging: card + email (channel to be confirmed, PAP-219)
```

**Tenant notification (after Justin's decision).** What happened, what data was involved, when, what
we have done, what they should do, who to reply to. No speculation, no blame, no "out of an
abundance of caution".

**Status update cadence.** S0 every 30 minutes on the issue until contained, then hourly. S1 hourly
until contained, then daily.

## 12. Post-mortem template

Blameless, within 5 business days of closing, merged as
`docs/security/post-mortems/<date>-<slug>.md`.

```markdown
# <date> — <title>

* Severity: S<n> · Detected: <t> · Contained: <t> · Closed: <t>
* Boundary: B<n> · Incident issue: PAP-<n> · Evidence: docs/evidence/INCIDENT-<date>-<n>/

## What happened
Timeline in UTC, one line per event, detection and containment marked.

## Impact
Tenants, records, credentials, spend, availability. Numbers, not adjectives.

## Why it happened
The chain of conditions, ending at the one that was cheapest to prevent.

## Why we did not catch it earlier
The control that should have caught it, and why it did not: absent, planned, wrong threshold,
or present but unverified.

## What changes
| Change | Control id | Issue | Owner | Due |
| -- | -- | -- | -- | -- |

## Threat-model updates
Rows added or edited in threat-model.md; new control ids in controls.yaml; new deny rules.

## Calibration
Did the threat model predict this threat? If not, what class of threat did we not model, and
what other instances of that class exist today?
```

Every post-mortem produces at least one *verifiable* control (`verify: lint|test|scan`). A
post-mortem whose only output is "be more careful" is not finished.

## 13. Drills and calibration

| Drill | Cadence | Pass condition | Control |
| -- | -- | -- | -- |
| Tabletop on one S0 scenario | quarterly | paging path works end to end; Justin acknowledges the test card | SEC-INC-01 |
| Containment rehearsal, one boundary | monthly | the action works and is reversible, timed | SEC-INC-02 |
| Credential rotation, one class | quarterly | rotated and proof of death captured, timed | SEC-SECRET-02 |
| Agent kill and revoke | monthly | all sessions dead and every agent credential invalid in under a minute | SEC-KEY-04 |
| Platform DR restore | monthly | database, forge and object store restored inside RTO | SEC-INC-05 |
| Evidence collection | with each drill | manifest complete and hashes verify | SEC-INC-03 |

Drill results are logged in `docs/security/drills.md` (created by the first drill) with the elapsed
time, so a regression in response time is visible. A release candidate requires a green DR drill in
the previous 30 days (SEC-INC-05).

## 14. Where incidents live

* The incident issue in Linear is the record of truth during the incident.
* `docs/evidence/INCIDENT-<date>-<n>/` holds the evidence bundle and manifest.
* `docs/security/post-mortems/` holds the post-mortems, append-only.
* The weekly security digest lists every S2 and S3, every waiver and every control past its cadence.
* Nothing about an incident is discussed in a channel that is not archived to one of these places.
