---
id: "0023"
title: "Review rubrics, severity taxonomy and finding schema"
status: Accepted
date: 2026-09-19
deciders: ["Sentinel", "Atlas"]
issue: PAP-79
supersedes: []
supersededBy: null
tags: ["quality", "review", "contract"]
reviewDate: null
---

# 0023. Review rubrics, severity taxonomy and finding schema

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-79](https://linear.app/paperos/issue/PAP-79)
* Deciders: Sentinel (decision), Atlas (contract owner), Iris, Forge, Ledger (review)

## Context

PaperOS has one human. Review is done by agents: three Gate 2 reviewers (PAP-81), a docs reviewer (PAP-677), a vision inspector (PAP-84), an edge-case hunter (PAP-85), an accessibility audit (PAP-73), scanners (PAP-80), and Justin reading a digest (PAP-89). Each of these needs to say how bad a finding is, which check produced it, and what to do about it, and the orchestrator needs to turn those statements into a merge decision without a person in the loop. Without shared names, "blocker" in one reviewer is "major" in another, findings cannot be counted or trended, and the calibration loop (PAP-241) has nothing to measure against. The gate artefact contract (PAP-239) and the quality module contract (PAP-462) both depend on the finding shape being fixed first. The build runs at 16 concurrent sessions with the module boundary rule (`docs/module-system.md`), so the machine-readable form has to live in a contract package other modules may import, and the human docs have to stay in step with it without manual copying.

## Decision

We will use one severity taxonomy, one checklist id scheme and one finding shape everywhere:

- **Severities** `S0 blocker`, `S1 major`, `S2 minor`, `S3 nit` plus the non-defect kinds `question` and `praise`, defined by consequence (data loss, security, broken build, access-rule violation for S0; user-visible bug, missing declared state, serious a11y for S1), not by fix size. **Gate rule:** any S0 blocks; more than 3 S1 block; S2 and S3 never block; a defect under confidence 0.5 posts as `question`; an unexpired waiver counts as `question`. Caps: generated files S2, third-party code S3. Overrides are waivers `{ reason, approvedBy, expires }`, never silent edits.
- **Checklist ids** `RUB-<DOMAIN>-<nn>` in eight domains (`COR`, `SEC`, `SPEC`, `VIS`, `A11Y`, `PERF`, `DOC`, `AGENT`), sequential within a domain and never renumbered; each item carries a one-line test, typical severity, verification note and false-positive note. Reviewers emit `rubricCoverage` (`checked` | `n/a` | `skipped`) per item.
- **`Finding`** `{ id, reviewer, rubricId, severity, title, body, file?, line?, endLine?, suggestion?, evidence[], confidence, autofixable, waiver? }` with `id = sha1(reviewer ␟ rubricId ␟ file ␟ normalizedTitle)[:10]` (U+001F between fields, title lower-cased with collapsed whitespace and trailing punctuation dropped), so re-reviews update instead of duplicate and ids never collide on field boundaries.
- **Home.** The JSON rubrics, the Zod 4 schemas, the id function, the gate rule, the Markdown renderer and the calibration scorer live in `packages/contracts/quality` (`@paperos/contract-quality`), the directory `docs/module-system.md` §2 assigns to the quality contract; PAP-239 adds the gate artefact schemas beside them and PAP-462 publishes the package. JSON Schemas are generated (`schemas/*.schema.json`, `docs/quality/rubrics/finding.schema.json`) and the eight domain docs under `docs/quality/rubrics/` are generated from the JSON; a drift test fails when either is stale.
- **Calibration** is a folder of cases `docs/quality/rubrics/calibration/<case>/{input.md, expected.json}`; agreement is per case (every expected S0..S2 present at the same severity, no unexpected S0/S1, expected S3 optional) with the 0.8 threshold from PAP-81.

## Consequences

**Positive.** One vocabulary across agents, scanners and Justin; gate decisions are a pure function of findings; the calibration loop has a fixed target; prompts embed rubrics by id instead of prose that drifts; non-TypeScript consumers (orchestrator, webhooks) read the same JSON Schema.

**Negative.** Changing a rubric item's meaning is a contract change (new item id, never a rewrite in place) and needs a changelog fragment and, for severity rules, a superseding ADR. The `SEC-*` control ids beyond `SEC-API-01` and `SEC-DB-02` are expected areas until PAP-219 publishes `controls.yaml`, and must be re-pointed then. Reviewers must fill `rubricCoverage`, which costs tokens.

**Neutral.** `question` and `praise` sit in the severity enum (as PAP-239 specifies) rather than a separate `kind` field; `isDefect()` separates them where it matters. The root alias `pnpm rubrics:calibrate` is a one-line root edit owed to PAP-13's owner; the package script is the same command.

## Alternatives rejected

**Numeric severity (P0..P4 or 1..5).** Familiar, but invites averaging and re-scoring; consequence-defined names with a fixed blocking rule are what a script and a human can both apply the same way. Would change if a consumer needed ordinal maths beyond "most severe governs".

**Severity per domain (a11y critical, security high, and so on).** Lets each reviewer keep its native scale, but the gate then needs a mapping table per reviewer and Justin has to learn six scales. PAP-80 already maps scanner scales into this taxonomy at the edge, which is the right place for mappings.

**Hand-written rubric docs with a separate JSON.** Two sources drift within a week at this build's pace; generating the docs from JSON with a drift test costs one script and removes the failure mode. Would change if the docs needed prose the JSON cannot carry (then the prose moves into the JSON, not the other way).

**Hash of the full body for the finding id.** Stable ids across wording tweaks matter more than detecting body edits; the id covers what identifies the defect (who, which check, where, what), and the body may improve between rounds.

**Placing the code under `packages/agents` or `tools/`.** The finding shape crosses the module boundary (orchestrator, digest, forge posting), so it belongs in a contract package per `docs/module-system.md` §2, not in an implementation package.

## Re-open criteria

- **Fact.** PAP-241's weekly calibration shows agreement under 0.8 for two consecutive weeks on a rubric after prompt tuning: the rubric wording, not the reviewer, is the suspect.
- **Fact.** PAP-239 or PAP-462 needs a field the `Finding` shape lacks (for example a bounding box for vision findings): additive fields are a minor version, a changed meaning is a superseding ADR.
- **Budget.** `rubricCoverage` pushes a reviewer past its cost cap (PAP-244 $2, PAP-677 $1 per PR): coverage moves to a compact form.
- **Date.** None; this is not a library adoption.

## References

- Linear issue: PAP-79; consumers PAP-81, PAP-84, PAP-85, PAP-73, PAP-80, PAP-239, PAP-241, PAP-462, PAP-89
- Docs: `docs/quality/rubrics/README.md`, `docs/quality/rubrics/severity.md`, `docs/quality/review-rubrics.md`
- Code: `packages/contracts/quality/src/{finding,rubrics,render,calibrate}.ts`, `packages/contracts/quality/src/rubrics/*.json`, `schemas/*.schema.json`
- Module system: `docs/module-system.md` §2 (contract packages at `packages/contracts/<module>`)
- Threat model: Security & Threat Model §3 (boundaries cited by the security rubric), §6 (untrusted tiers cited by the agent-behaviour rubric)
