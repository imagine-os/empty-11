---
id: "0027"
title: "Dependency licence policy, tiered by usage context and enforced in CI"
status: Proposed
date: 2026-09-19
deciders: ["Scout", "Sentinel", "Atlas"]
issue: PAP-211
supersedes: []
supersededBy: null
tags: ["license", "security", "ci", "library"]
reviewDate: 2027-03-19
---

# 0027. Dependency licence policy, tiered by usage context and enforced in CI

* Status: Proposed
* Date: 2026-09-19
* Issue: [PAP-211](https://linear.app/paperos/issue/PAP-211)
* Deciders: Scout (Library Evaluator, decision), Sentinel (Security Auditor, review), Atlas (plan)
* Review date: 2027-03-19

## Context

PaperOS is a template every customer app is cloned from, shipped three ways — a web bundle, a
Tauri desktop app and a mobile app — plus an API process on our own VPS. Four decisions already
made depend on licence tiers that did not exist yet, and all four had to write "under PAP-211's
draft policy":

* [ADR 0006](0006-canvas-and-editor-libraries.md) rejected `tldraw` because its licence text
  changed between `3.15.6` (watermarked production use permitted) and `4.x`+ (Development
  Environments only without a paid key). The deciding fact was a licence, found by reading, and
  no gate would have caught it because `SEE LICENSE IN LICENSE.md` is not an SPDX id.
* [ADR 0008](0008-crm-marketing-stack.md) turned on whether AGPL-3.0 products (Twenty, Postiz,
  Listmonk, Dub) could be run, forked or only borrowed from, and its Licence review section
  answers in tiers the policy had not defined.
* [`docs/platform/library-rubric.md`](../platform/library-rubric.md) (PAP-209, ADR 0009) gives
  the `license` criterion 20 of 100 points and a hard gate `licenseTier`, and falls back to a
  `draftTiers` block inside `packages/agents/src/rubric/library-rubric.json`, printing
  "license policy: draft (PAP-211 unmerged)" on every run.
* PAP-215's spike lockfiles are named in both surveys as the first place an AGPL dependency
  could arrive without anyone deciding to let it.

The constraints that shape the answer: the same licence is acceptable in one place and not in
another (a GPL build tool is not a GPL bundle); sixteen builder sessions rebase on one lockfile,
so a new root dependency is expensive; the repo's own licence is undecided (NJ-7); `Cargo.lock`
does not exist yet; and the gate has to fit inside a 90-second CI budget beside everything else.

Scoring libraries is PAP-209's job and vulnerability scanning is PAP-80's. This ADR is only
about which licences may enter, where, and what happens when one does.

## Decision

We adopt a **context-tiered licence policy, written once as data and enforced by a
dependency-free checker**.

* **The source of truth is [`ops/licenses/policy.yaml`](../../ops/licenses/policy.yaml).** Tiers,
  contexts, per-context rules and standing exceptions live there. The prose
  ([`docs/platform/license-policy.md`](../platform/license-policy.md)) explains it; the rubric,
  the registry (PAP-216) and the Renovate delta (PAP-217) read the YAML. Nothing keeps a second
  copy of a tier.
* **Four usage contexts, derived from the lockfile, not declared:** `bundled` (the production
  closure of `apps/web|desktop|mobile`, walked through the workspace packages they import),
  `server` (`apps/api` and deployed `ops/` tooling), `dev` (everything nothing shippable
  reaches) and `service` (a product we run beside PaperOS, declared by hand). The strictest
  context a package appears in decides, and a production dependency no app reaches yet is judged
  as `bundled`, because it ships the moment an app imports its owner.
* **Three tiers.** Allow: MIT, MIT-0, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense, CC0-1.0,
  Zlib, BlueOak-1.0.0, Python-2.0, MPL-2.0, Artistic-2.0, BSL-1.0, plus OFL-1.1 and CC-BY for
  assets. Review (ADR + unexpired waiver): LGPL and GPL in `server`, `dev` and `service`;
  **AGPL-3.0 in `service` and `dev` only**; BUSL-1.1, Elastic-2.0, FSL, EUPL, CDDL, EPL, OSL,
  WTFPL and any `SEE LICENSE IN` text. Deny everywhere: SSPL-1.0, Commons Clause as a `WITH`
  rider, the JSON licence, `UNLICENSED`, a missing licence, an SPDX id nobody has tiered, and
  **any copyleft in `bundled`** — matched by family prefix, so an unlisted copyleft still fails.
* **`OR` takes the most permissive branch, `AND` the strictest**, parentheses nest, `+` means
  `-or-later`, and a malformed expression is `deny`.
* **The LICENSE file beats the `license` field**, and a textual difference is reported only when
  it changes the tier — so the gate stays quiet about 0BSD-declared-as-ISC and loud about
  AGPL-declared-as-MIT.
* **Waivers are dated promises** in [`ops/licenses/waivers.yaml`](../../ops/licenses/waivers.yaml):
  package, version range, licence, context, reason, ADR, approver, expiry. Atlas may approve a
  `review` tier; a `deny` tier needs Justin and an Atlas signature on one is itself a violation.
  An expired waiver fails. An unwaived `review` tier fails by default
  (`reviewWithoutWaiver: fail`), because an unanswered decision is not a green build.
* **The checker is `node ops/licenses/check.mjs`**: it reads `pnpm licenses list --json`,
  `--json --prod` and `pnpm ls -r --depth Infinity --json --prod`, classifies every package,
  writes `reports/licenses.json` (plus SARIF and a Markdown summary on request) and exits `1` on
  a violation, `2` when it cannot run. A lockfile newer than the last install is a fast fail, not
  a scan. It imports nothing outside `node:*`.
* **`THIRD_PARTY_NOTICES.md` is generated** by `node ops/licenses/notices.mjs` from the report's
  production closure, with a `--check` mode so it cannot go stale.
* **Rust mirrors the same allow list** in [`ops/licenses/deny.toml`](../../ops/licenses/deny.toml)
  for `cargo-deny`, skipping cleanly until a `Cargo.lock` exists; a test fails if the two lists
  drift apart.
* **We do not decide the licence of PaperOS's own code.** That is NJ-7 (below). `LICENSE` and the
  root `license` field are untouched.

## Consequences

**Positive.** The four ADRs above stop saying "draft". `tldraw@5.4.2` and a seeded SSPL package
both come back `deny / bundled` with the package, tier, context and reason named — verified, not
asserted ([`docs/evidence/PAP-211/seeded-violation-run.txt`](../evidence/PAP-211/seeded-violation-run.txt)).
The live workspace is clean: 228 packages, 0 violations, 0 warnings, 8 production notices, in
about four seconds against a 90-second budget. A GPL dev tool promoted to an app dependency
turns the build red in the same commit that promotes it, which is the failure mode this exists
to catch.

**Negative.** We now own an SPDX parser, a YAML subset reader and a licence-text detector —
roughly 600 lines of code that upstream libraries would have given us. The detector is a
heuristic and will occasionally return `null` for an unusual text; it is written so that `null`
flags nothing rather than flagging wrongly, which means a manifest that lies about an
unrecognised text can still get through on the field alone. The context derivation trusts
`pnpm ls`; a package reached only through an optional peer or a dynamic import is classified by
what the lockfile says, not by what the bundler emits. And the policy is strict enough that it
will eventually block something someone wants, which is the cost of it being worth having.

**Neutral.** The `licenses` CI job is not wired here: `.github/workflows/ci.yml` belongs to
PAP-78, so the steps are specified and left on that issue —
(1) `pnpm install --frozen-lockfile`, (2) `pnpm vitest run --config ops/licenses/vitest.config.mjs`,
(3) `node ops/licenses/check.mjs --sarif reports/licenses.sarif --markdown $GITHUB_STEP_SUMMARY`,
(4) `node ops/licenses/notices.mjs --check`, (5) upload `reports/licenses.json` as an artefact,
(6) `cargo deny --config ops/licenses/deny.toml check licenses` when a `Cargo.lock` exists. The
job name is `licenses` and it should become a required status once PAP-217 reads its delta.
Root `package.json` aliases (`pnpm licenses:check`, `pnpm licenses:notices`) are PAP-13's to add;
until then the commands are the `node …` forms above.

## Alternatives rejected

**`license-checker` / `license-checker-rborn` as the scanner.** The npm-ecosystem standard, and
it would have saved the SPDX parser. Rejected because it reads a flat `node_modules` tree and has
no notion of *context* — it cannot tell a dev tool from a bundled dependency, which is half of
this policy. It would change the answer if it grew per-importer attribution.

**`spdx-expression-parse` + `spdx-satisfies` as dependencies.** The correct libraries, and the
spec named them. Rejected on cost, not quality: adding them touches the root `package.json` and
`pnpm-lock.yaml`, which PAP-13 owns and sixteen parallel sessions rebase on, and it makes the
gate unable to run before an install. Forty lines of grammar is the cheaper side of that trade.
It would change the answer the day the policy needs full SPDX licence-list validation, which is
a data problem (the official list) rather than a parsing one.

**A single global allow list with no contexts.** Simplest thing that could work, and what most
projects do. Rejected because it forces one answer for GPL: either ban it and lose useful build
tools, or allow it and eventually ship it. The context split is the whole reason ADR 0008 could
say "borrow, don't run" and mean something checkable.

**Warn on `review` instead of failing.** Gentler, and it keeps the build green while a decision
is pending. Rejected as the default because a warning nobody must answer is a warning nobody
reads; it survives as a policy switch (`reviewWithoutWaiver: warn`) and a `--review-warn` flag
for exploratory branches, and the report records which mode produced it.

**Deciding the template's own licence here.** Tempting, since the default is known. Rejected:
it is Justin's call, an ADR is not a Needs Justin card, and a wrong guess committed to `LICENSE`
is harder to walk back than an open question.

## Re-open criteria

- **Date.** `reviewDate` 2027-03-19 passes while the status is `Accepted`.
- **Fact.** A dependency we actually want lands in `review` or `deny` and the team's judgement is
  that the tier is wrong; or a licence in the allow list changes upstream (the same event that
  moved `tldraw` out of reach); or `pnpm licenses list --json` changes shape.
- **Budget.** The scan exceeds 90 s on the real workspace.
- **Scope.** Rust arrives (PAP-19) and `cargo-deny` shows the mirrored list is not expressive
  enough, or PAP-215 declares a `service` product and the `service` context stops being empty.
- **Ownership.** PAP-80 merges SARIF, or PAP-78 wires the job differently from the step list
  above; either means this ADR's Consequences section is out of date.

## References

- Linear issue: PAP-211 (blocks PAP-216, PAP-497, PAP-759, PAP-762; informs PAP-217)
- Policy: [`ops/licenses/policy.yaml`](../../ops/licenses/policy.yaml),
  [`ops/licenses/waivers.yaml`](../../ops/licenses/waivers.yaml),
  [`ops/licenses/deny.toml`](../../ops/licenses/deny.toml)
- Prose: [`docs/platform/license-policy.md`](../platform/license-policy.md);
  gate README: [`ops/licenses/README.md`](../../ops/licenses/README.md)
- Evidence: [`docs/evidence/PAP-211/`](../evidence/PAP-211/) — live run, seeded-violation run,
  SARIF, notices snapshot, test output
- Rubric: [`docs/platform/library-rubric.md`](../platform/library-rubric.md) §2.1 and §6 (PAP-209,
  ADR 0009); machine-readable `packages/agents/src/rubric/library-rubric.json`
- Prior decisions this makes checkable: [ADR 0006](0006-canvas-and-editor-libraries.md) (tldraw),
  [ADR 0008](0008-crm-marketing-stack.md) §Licence review (AGPL products)
- Needs Justin: **NJ-7** — licence of the template code itself; MIT, Apache-2.0 or proprietary;
  default Apache-2.0 after 48 h. Nothing in this ADR waits on it.
