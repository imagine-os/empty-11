# Severity taxonomy

Machine form: `packages/contracts/quality/src/rubrics/severity.json` (validated by `SeverityTaxonomySchema`; the gate rule constants are `GATE_RULE` in `finding.ts`). This page is the human reading of the same content; when they disagree, fix both in one PR.

## Severities

| Id | Name | Blocks | Definition | Required action |
|---|---|---|---|---|
| `S0` | blocker | always | Data loss or corruption; a security failure (authorisation, tenant isolation, secrets, injection, untrusted instructions obeyed); a broken build or release; an access-rule violation (the spec's Access section, or the org's input standards, make the product unusable for a class of user). | Fix before merge, or a waiver approved by Justin through Atlas with an expiry. An issue cannot move to Done with an unwaived S0. |
| `S1` | major | more than 3 | A user-visible bug on a supported path; a declared state, event or action missing; a serious accessibility failure (no name, no keyboard path, no visible focus, hover- or drag-only); a finding with no evidence; a spec or ADR that cannot be verified. | More than three open S1 block merge. Otherwise fix, or record a waiver approved by Sentinel (security S1 need Justin) with an expiry and a Linear issue. The review pass does not move an issue to Done with an unwaived S1. |
| `S2` | minor | never | A defect with a workaround or limited exposure: misalignment of 4 px or more, a theme leak, N+1 on a small list, a test that asserts nothing, a missing changelog fragment, a denied write attempt by a reviewer. | Fix in this PR when cheap, otherwise a follow-up issue linked from the finding. Trended weekly (PAP-241). |
| `S3` | nit | never | Polish: wording, intentional truncation with a tooltip, repeated cheap work, third-party code findings (pointer to PAP-216), missing Spanish strings. | Author's discretion; batched into polish passes. |
| `question` | question | never | A possible defect the reviewer could not confirm (confidence under 0.5), a request for context, or a waived finding shown for the record. | Author answers in the thread; the reviewer may upgrade with evidence next round. |
| `praise` | praise | never | Something worth repeating: a test that would catch a real regression, a clean boundary, a good edge case. | None; counted so reviewers calibrate on what good looks like. |

Examples of each, per domain, are in the rubric files (sections "Examples by severity").

## Gate rule

**Any S0 blocks. More than 3 S1 block. S2 and S3 never block.** A defect finding with confidence under 0.5 is posted as a `question`, never dropped. A finding with an unexpired waiver counts as a `question`. Code: `gateDecision(findings)` returns `{ status: 'pass' | 'fail', counts, reasons }`; Gate 2 (PAP-81) turns `fail` into `REQUEST_CHANGES` and a red `gate/2-review`, `pass` into `COMMENT` (reviewers never `APPROVE`).

## Deciding a severity

1. Start from the rubric item's typical severity.
2. Ask the S0 questions: does it lose or corrupt data, break a security control, break the build or release, or violate an access rule? If yes, S0 regardless of size.
3. Ask the S1 questions: will a user see it on a supported path; is a declared state, event or action missing; is a serious accessibility failure present; is the claim unverifiable? If yes, S1.
4. Otherwise S2 if it is a defect at all, S3 if it is polish.
5. Apply the caps, then the confidence rule, then record any waiver.

What does not change a severity: how many lines the fix takes, who wrote the code, how late in the cycle it is, whether the author agrees. What does: evidence. A reviewer who cannot show the failing input or the measurement posts a `question`.

## Caps

| When | Cap | Note |
|---|---|---|
| Finding in a generated file | S2 | Point at the generator; the fix lands in the source (`capSeverity(sev, 'S2')`). |
| Third-party or vendored code | S3 | Pointer to PAP-216 (dependency policy); vulnerabilities go through PAP-80 instead. |

Scanner-produced findings arrive already mapped by PAP-80 (gitleaks hit S0; OSV critical/high with fix S0, without fix S1 plus waiver; Semgrep `ERROR` S1, `S0` for the authz and tenant rules, `WARNING` S2; Trivy critical S0, high S1). Reviewers reference them as `from: scanner` and never re-report them.

## Waivers

A severity override is recorded on the finding as `waiver: { reason, approvedBy, expires }`, never as a silent edit of the severity. Approval:

| Finding | Approver |
|---|---|
| S0 | Justin, through Atlas (`Needs Justin` card) |
| S1 security | Justin, through Atlas |
| S1 other | Sentinel |
| S2, S3 | any reviewer, or the author with a linked issue |

Expired waivers stop applying (`effectiveSeverity()` returns the original severity) and fail release certification (PAP-88). The waiver register lives with the security waivers file (`ops/security/waivers.yaml`, PAP-80) for scanner findings and in the review artefact for reviewer findings; PAP-241's weekly report lists every active waiver.

## Multiple reviewers, duplicates, silence

- Two reviewers on the same line: both findings are kept; the most severe governs the gate. Dedupe happens only within one reviewer (`dedupeWithinReviewer`), by id.
- Re-review: a finding keeps its id when the title's case or whitespace changes, so the harness updates the existing comment (`<!-- finding:<id> -->`) instead of posting again; a resolved finding is marked `Resolved in <sha>`.
- Silence: every reviewer emits `rubricCoverage` (`checked`, `n/a`, `skipped` per item) so "no finding" can be read as "checked and clean" rather than "did not look".

## Calibration guidance

- **Anchor on the definition, not the feeling.** The same defect is the same severity in a 3-line PR and a 3,000-line PR.
- **Over-severity is a miss too.** Reporting an intentional truncation with a tooltip as S2 fails the calibration case (`10-vis-truncation-with-tooltip`) exactly as missing an S0 does.
- **Evidence gates severity.** A claim about tests cites `pnpm test` output; a claim about contrast cites the ratio; a claim about overflow cites the DOM metric. Without it, `question`.
- **Financial correctness (Ledger's note).** Rounding, currency and idempotency errors in `packages/finance` are never below S1; a replayable payment mutation or a ledger write outside its transaction is S0 even when the amount is small, because the hash chain (PAP-179) makes it permanent.
- **Accessibility (Iris's note).** "Serious a11y" means a user of one input mode cannot complete a supported task; cosmetic focus-ring colour is S2. Hover-only and drag-only are S1 by org standard, S0 when the task has no other path at all.
- **Correctness (Forge's note).** Prefer the failing test to the argument: the finding body names the input that breaks it; if you cannot name one, it is a `question`.
- **Agreement target.** Each reviewer at or above 0.8 on the 15-case set (PAP-81); PAP-241 tracks precision and recall weekly and every escaped defect becomes a calibration entry, not a shrug.
