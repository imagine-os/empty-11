# Review rubrics: entry point

Everything reviewers and humans share when judging work lives in [`docs/quality/rubrics/`](./rubrics/README.md):

- **Severity taxonomy** S0 blocker, S1 major, S2 minor, S3 nit, plus `question` and `praise`, with examples, required actions, caps, waivers and calibration guidance: [rubrics/severity.md](./rubrics/severity.md).
- **Rubrics** with checklist ids `RUB-<DOMAIN>-<nn>` for correctness, security, spec conformance, visual, accessibility, performance, docs and changelog, and agent behaviour: [rubrics/README.md](./rubrics/README.md) lists them; each is generated from `packages/contracts/quality/src/rubrics/<domain>.json`.
- **Finding schema** and deterministic ids: [rubrics/finding.schema.json](./rubrics/finding.schema.json), TypeScript in `packages/contracts/quality/src/finding.ts`.
- **Review comment template**: [rubrics/review-comment-template.md](./rubrics/review-comment-template.md).
- **Calibration set** (15 cases) and scorer: `rubrics/calibration/`, `pnpm --filter @paperos/contract-quality calibrate <output.json>`.

Gate rule in one line: any S0 blocks, more than 3 S1 block, S2 and S3 never block, confidence under 0.5 posts as a question, waived findings count as questions.

## Build-loop review pass (2026-09-19)

Until Gate 2 (PAP-81) runs on every PR, the build loop reviews by hand-driven sessions using these rubrics. The pass that moves an issue from `In Review` to `Done` works like this:

1. **Trigger.** The builder posts `Session ended` and moves the issue to `In Review` (brief rule 8). The review pass picks it up from there; the builder never reviews its own work.
2. **Reviewer model.** Per `docs/cost-and-duration-estimate.md` §4b: the reviewer runs on Opus 5 / high when the builder was Opus 5 or Fable 5.1, and on Sonnet 5 / high when the builder was Sonnet 5; the QA gate for code issues runs on Haiku 4.5 / low. The reviewer comment names the model it ran on.
3. **Inputs.** The issue (all eleven sections), the spec file, the commits on `main` named in `Session ended`, the changed files, the check output (`pnpm check` or the package's `lint`, `typecheck`, `test`, `build`), and any evidence paths the builder listed.
4. **Rubrics applied.** Correctness and spec conformance on every issue; security when the diff touches procedures, queries, auth, files, outbound requests, logging, dependencies or agent configuration; docs-and-changelog and agent behaviour on every issue (the changelog fragment, ADR completeness, model names in repo content, paths respected, session trail); visual and accessibility when UI changed (screenshots at the seven widths or a stated `n/a`); performance when queries, loops, bundles or payloads changed. The reviewer records `checked`, `n/a` or `skipped` per rubric item.
5. **Findings.** Written as `Finding`s (rubric id, severity from the taxonomy, file and line, failure scenario, proving test, evidence, confidence) and rendered with the review comment template. The rendered review is posted as **one Linear comment on the issue**, ending with a `paperos-session` footer whose `status` is `reviewed`.
6. **Decision.** `gateDecision()` on the findings: **any S0, or more than three S1, blocks Done**; an issue with any unwaived S1 also stays out of Done until fixed or waived (severity.md, required actions). Blocked: the issue stays `In Review`, the comment lists the must-fix findings, and the builder (or a follow-up session on the same branch) fixes on `main` and posts `Resolved in <sha>` per finding; the reviewer re-checks only the open findings. Clean or S2/S3 only: the review pass moves the issue to `Done`; S2 findings become follow-up issues or are fixed in a polish pass.
7. **Waivers.** A severity override in the pass is a `waiver { reason, approvedBy, expires }` in the finding, in the comment, never a silent edit; S0 and security S1 go to Justin through a `Needs Justin` card.
8. **Calibration.** Reviews that missed a defect found later (a revert, a hotfix, a later gate) are added to `rubrics/calibration/` as a new case, so the set grows with the build.

This section is dated because PAP-81 replaces steps 1 to 6 with the automated gate; when it lands, this section is superseded by `docs/quality/review-agents.md` and the statuses `gate/2-*`.
