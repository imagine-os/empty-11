---
id: "0024"
title: "Threat model and hardening baseline as versioned, machine-checkable data"
status: Accepted
date: 2026-09-19
deciders: ["Sentinel", "Atlas"]
issue: PAP-219
supersedes: []
supersededBy: null
tags: ["security", "process", "platform"]
reviewDate: 2026-12-19
---

# 0024. Threat model and hardening baseline as versioned, machine-checkable data

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-219](https://linear.app/paperos/issue/PAP-219)
* Deciders: Sentinel (decision), Atlas (scope); Forge implements the middleware
* Review date: 2026-12-19 (quarterly, with the `verify: manual` control cadences)

## Context

PaperOS is built by agent sessions and reviewed by agent sessions. There is one human, and he
approves decision cards, not diffs. Every security check we have — Gate 1's static checks, Gate 2's
security reviewer, the Semgrep rules of PAP-80, the `security.md` rubric of PAP-79 — needs something
to check *against*. Until now that something was a plan document (*PaperOS Security & Threat Model*,
round 2, 2026-09-17): good prose, nine boundaries, no ids, no verification mode, and no way for a
reviewer to say "this diff crossed boundary B5 without control X".

Three forces make the shape of the answer non-obvious.

1. **A reviewer that cites opinion is unusable.** A finding has to name a control, and the control
   has to exist somewhere both the reviewer and the author can read. Prose cannot be cited
   precisely enough, and a reviewer that argues from taste is one the author can always dispute.
2. **Two decisions since round 2 created boundaries the document did not have.** ADR 0004 put a read
   path beside the API that **bypasses RLS** (Electric replicates as a `REPLICATION` role, so the
   shape proxy is the only tenant boundary for reads), and PAP-43's jobs carry a tenant context that
   no request typed. A threat model that does not name a boundary cannot have a control on it.
3. **The build loop is currently violating one of our own rules, for a good reason.** Justin's
   git-only policy means builders push to `main`; the forge rulesets that would forbid it are files,
   not applied policy (ADR 0010 section 1). An undocumented exception is indistinguishable from a
   breach, and at this cadence "everyone knows" lasts about a day.

Constraints: no new runtime dependency for reading the control data (it must work in a PreToolUse
hook and in Gate 1 before install); root files belong to PAP-13 in this wave; and the plan's
document stays the narrative version, so this decision has to define which one governs.

## Decision

**The threat model and hardening baseline are repository artefacts with an id per control, a
verification mode per control, and machine-readable data files as the authority.**

1. **Three documents** under `docs/security/`: `threat-model.md` (STRIDE per boundary),
   `hardening-baseline.md` (the settings, including the twenty secret classes and their rotation
   runbooks), `incident-playbook.md` (severities, paging, containment, the 72 hour checklist, the
   post-mortem template).
2. **Ten trust boundaries**, B1 to B10, with a mapping table to the round-2 numbering so older
   references resolve. B5 (sync read path) and B6 (jobs) are new; v1's Yjs boundary becomes B7;
   v1's orchestrator host and agent sessions merge into B8 because they share a blast radius.
3. **Every control gets `SEC-<AREA>-<nn>`** in `ops/security/controls.yaml` with
   `{ statement, boundary, verify: lint|test|scan|manual, cadence, owner, issues[], standard, status }`.
   103 controls today; 87 are machine-verifiable; `verify: manual` always carries a cadence.
   `standard` cites a version or a retrieval date, never a bare "per OWASP".
4. **Two more data files:** `ops/security/agent-deny.yaml` (the destructive-action deny list, 23
   rules, every `S0` naming a backstop outside the agent) and `ops/security/headers.json` (the
   header, CSP, CORS, cookie and limit baseline as data, with seven named profiles).
5. **`node scripts/security-controls.ts --check`** validates all three files with no dependencies
   and is the Gate 1 hook: ids unique and well-formed, boundaries known, manual controls carry a
   cadence, every `S0` deny rule has a backstop, the `app` CSP profile contains no `'unsafe-inline'`,
   `'unsafe-eval'` or wildcard, HSTS meets the preload minimum, credentialed CORS is never `*`.
6. **No empty cells.** Every STRIDE row names a threat, a control and a verification; where no
   control exists the Gap column names the owning issue. A dash is a review finding.
7. **Disagreement is an ADR.** An implementation that needs something the model forbids changes the
   model through an ADR, not by diverging. Where this repository's documents and the plan document
   differ, **these govern the repository**.
8. **The build-loop exception is data**: `DENY-GIT-03` carries `mode: build-loop` with its
   conditions and an explicit end condition (the rulesets being applied), and section 14.3 of the
   threat model states what the exception does *not* relax.

Status is Accepted rather than Proposed because nothing here contradicts the plan: it is the
executable form of a document the plan already approved, plus two boundaries that two later ADRs
forced.

## Consequences

**Positive.** A reviewer can cite `SEC-CSP-03` instead of an opinion, and an author can dispute a
finding by reading one line. A new route, table, shape, job, room or provider has an obvious
obligation: a row and a control in the same commit. The header set stops drifting between the API,
the web app, the desktop shell and the file origin because there is one JSON file. The deny list
gains a property it did not have: `S0` without a backstop now fails a check, which forced three
rules to name one. And the exception we are actually running under is written down with an end
condition.

**Negative.** 103 controls at 87 machine-verifiable is a debt statement, not an achievement: only
eight are `partial` and none are `enforced` today, because the code they describe is mostly unwritten.
The list will read as theatre until PAP-80, PAP-78 and PAP-64 wire the checks, and Sentinel has to
keep the `status` field honest — a control marked `enforced` with no passing check is worse than a
control marked `planned`. The YAML subset is small on purpose and will reject valid YAML (block
scalars in the wrong place, anchors); the price of no dependency is a parser with opinions. Sixteen
manual controls carry cadences that a human-free organisation can still forget; they are in the
quarterly review and nowhere else.

**Neutral.** The plan document and these files now both exist. That is deliberate — narrative and
reference have different readers — and section 17 of the threat model records the differences so
the pair does not quietly fork.

## Alternatives rejected

**Keep the single plan document and cite section numbers.** Cheapest, and it fails the first time a
section is renumbered or a control is only half true; section 3 of v1 mixes threat, control and
owner in one sentence, which is unreviewable. The fact that would change the answer: a reviewer that
could reliably cite prose at line granularity across edits.

**One `security.yaml` with everything (threats, controls, deny rules, headers) and generated docs.**
Tempting, and it is probably where this ends up. Rejected for now because the generator is code
nobody has written, it would live in root-owned territory in this wave, and a generated threat model
is much harder for a human to read at the moment when reading matters — during an incident. Re-open
when PAP-80's Zod schema exists and the generator is one file.

**Adopt a framework template (ASVS checklist, CIS benchmark) verbatim as the baseline.** Rejected as
the *primary* artefact: ASVS 5.0.0 has around 350 requirements across 17 chapters and says nothing
about an agent that holds a forge token and a model key. We cite ASVS, the OWASP Top 10:2025, the
OWASP Top 10 for LLM Applications 2025, CSP Level 3, NIST SP 800-63B-4 and SP 800-61r3 per control
instead, and keep the boundaries ours. The fact that would change the answer: a published standard
that models agent principals with credentials as first-class actors.

**Threat model as `threats.json` with STRIDE rows as data.** Considered because it would let a
reviewer diff threats mechanically. Rejected: the threat text is the part a reader needs to
understand, and we would immediately want prose beside every row. The controls are the part worth
making data, and they are.

## Re-open criteria

- **Date.** `reviewDate` 2026-12-19 passes while the status is `Accepted`.
- **Fact.** The forge rulesets are applied (build-loop mode ends and section 14.3 changes); or a new
  boundary appears (a new sync engine, a mobile background service, a public embed host); or PAP-80
  lands a Zod schema that makes the single-source generator cheap.
- **Budget.** More than 20 controls sit at `status: planned` with a passed due date on their owning
  issue — the list is then describing intentions, not controls, and the fix is fewer controls or
  more tests.
- **Advisory.** A standard we cite publishes a new major version (ASVS 6, a CSP Level 3
  Recommendation, a Top 10 edition), or an incident post-mortem finds a threat class the model does
  not contain.

Re-opening means a new ADR that supersedes this one; this file then becomes `Superseded by <nnnn>`.

## References

- Linear issue: PAP-219; consumers PAP-80, PAP-81, PAP-79, PAP-60, PAP-78, PAP-64
- Documents: `docs/security/threat-model.md`, `docs/security/hardening-baseline.md`,
  `docs/security/incident-playbook.md`
- Data: `ops/security/controls.yaml`, `ops/security/agent-deny.yaml`, `ops/security/headers.json`;
  checker `scripts/security-controls.ts`
- Prior decisions: [ADR 0003](0003-auth-library.md) (bearer in the keychain, agent keys),
  [ADR 0004](0004-local-first-sync.md) (Electric bypasses RLS on the read path; WebView storage is
  wiped across Tauri updates), [ADR 0010](0010-branching-and-commits.md) (build-loop mode)
- Standards: OWASP ASVS 5.0.0 (2025-05-30); OWASP Top 10:2025 (final 2026-01); OWASP Top 10 for LLM
  Applications 2025; CSP Level 3 (W3C WD 2026-08-13); hstspreload.org (retrieved 2026-09-19);
  draft-ietf-httpbis-rfc6265bis-20; NIST SP 800-63B-4 (2025-08); NIST SP 800-61r3 (2025-04-03);
  GDPR Articles 33 and 34; PCI DSS 4.0.1 SAQ-A
- Plan narrative: *PaperOS Security & Threat Model*, round 2, 2026-09-17
