# Licence policy

**Issue:** [PAP-211](https://linear.app/paperos/issue/PAP-211) · **Decision:** [ADR 0027](../adr/0027-license-policy.md) ·
**Machine-readable:** [`ops/licenses/policy.yaml`](../../ops/licenses/policy.yaml) ·
**Gate:** `node ops/licenses/check.mjs` ([`ops/licenses/README.md`](../../ops/licenses/README.md))

The goal is narrow and worth stating: **no licence surprises**. Not "we are compliant" — that is
a lawyer's word and this is not legal advice — but that nobody discovers, three days before a
release, that something in the bundle cannot ship. Every dependency is tiered before it lands,
the tiers are data rather than prose, and the build goes red when the data says no.

> This document is the prose. `ops/licenses/policy.yaml` is the source of truth. If they
> disagree, the YAML is right and this file has a bug. PAP-209's rubric, PAP-216's registry and
> PAP-217's Renovate delta all read the YAML, never this page.

## 1. Context is half the answer

The same licence can be fine in one place and impossible in another, so the policy asks *where*
before it asks *what*. Four contexts, derived from the lockfile rather than declared by hand:

| Context | What it is | How the checker decides |
| -- | -- | -- |
| `bundled` | Ships inside something a customer runs: the web bundle, the Tauri app, the mobile app. | Production dependency closure of `apps/web`, `apps/desktop`, `apps/mobile`, walked **through** the workspace packages they import. |
| `server` | Runs on our machines and answers over a network. | Production closure of `apps/api` and of `ops/` tooling deployed to the VPS. |
| `dev` | Build, test, lint. Never reaches a customer or a server. | Everything installed that no shippable tree reaches. |
| `service` | A whole product we run *beside* PaperOS, unmodified, talking to us over its own API. | Declared by hand in `servicePackages`. A lockfile cannot know this. |

Two rules keep this honest:

* **The strictest context wins.** A package that is both a dev tool and an app dependency is
  judged as `bundled`. Precedence: `bundled` > `server` > `service` > `dev`.
* **A production dependency no app reaches yet is judged as `bundled`** (`unreachedProdContext`).
  It is a `dependency` of a workspace package, so it ships the moment an app imports that
  package. Waiting for the import to happen is how a licence problem arrives late.

This is what catches the edge case the spec calls out: a GPL CLI in `devDependencies` is allowed
with a note; move it to `dependencies` of an app and the tree walk puts it in `bundled`, where
GPL is denied, and the build turns red in the same PR that moved it.

## 2. The tiers

**Allow** — ship it; the only obligation is attribution in `THIRD_PARTY_NOTICES.md`:

> MIT · MIT-0 · Apache-2.0 (and `WITH LLVM-exception`) · BSD-2-Clause · BSD-3-Clause ·
> BSD-3-Clause-Clear · ISC · 0BSD · Unlicense · CC0-1.0 · Zlib · BlueOak-1.0.0 · Python-2.0 ·
> PSF-2.0 · MPL-2.0 · Artistic-2.0 · BSL-1.0 · OFL-1.1 and CC-BY-4.0 / CC-BY-3.0 for assets

MPL-2.0 is allow because its copyleft is per-file: we owe the modified files back, not the
application. If we ever patch an MPL file in place, that is a `review` conversation, not a
silent one — the ADR that adopts an MPL library says so.

**Review** — an ADR plus an unexpired waiver, and only in a context that permits it:

> LGPL-2.1/3.0 · GPL-2.0/3.0 · AGPL-3.0 · EUPL-1.2 · CDDL-1.0/1.1 · EPL-2.0 · OSL-3.0 ·
> BUSL-1.1 · Elastic-2.0 · FSL-1.1-\* · WTFPL · `SEE LICENSE IN <file>`

**Deny** — never, in any context, without a decision only Justin can make:

> SSPL-1.0 · Commons Clause (as a `WITH` rider on anything) · the JSON licence ·
> `UNLICENSED` · a package with no licence at all · **any copyleft in `bundled`**

Per context, in full:

| | `bundled` | `server` | `dev` | `service` |
| -- | -- | -- | -- | -- |
| Permissive (MIT, Apache-2.0, BSD, ISC, 0BSD, MPL-2.0, …) | allow | allow | allow | allow |
| LGPL, GPL | **deny** | review | allow | review |
| AGPL-3.0 | **deny** | **deny** | review | review |
| BUSL-1.1, Elastic-2.0, FSL | **deny** | review | review | review |
| `SEE LICENSE IN <file>` | **deny** | review | review | review |
| Other copyleft (EUPL, OSL, CDDL, EPL, CPAL, CeCILL) | **deny** | review | review | review |
| SSPL, Commons Clause, JSON, `UNLICENSED`, missing | **deny** | **deny** | **deny** | **deny** |
| An SPDX id nobody has tiered | **deny** | **deny** | **deny** | **deny** |

Three things about that table are deliberate:

* **AGPL is `service`-first.** Its network clause reaches anyone our customers talk to, so an
  AGPL product is something we *run unmodified beside* PaperOS, never something inside
  `apps/api`. ADR 0008 reached the same place from the other direction: Twenty, Postiz, Listmonk
  and Dub are all AGPL-3.0, and all four are `reject` or `borrow`, so v0.1 carries no AGPL
  obligation and no waiver.
* **`bundled` has no `denyFamilies` escape hatch.** A copyleft id the list has never heard of
  (say `GPL-4.0-only`) still fails in `bundled`, because the family prefix matches. Unknown is
  not a pass, anywhere.
* **`SEE LICENSE IN` is never allow.** It means "a human reads this text", which is exactly what
  happened with tldraw: `3.15.6` allowed watermarked production use, `4.x` and later allow
  Development Environments only ([ADR 0006](../adr/0006-canvas-and-editor-libraries.md)). A
  policy that auto-passed a bespoke text would have shipped that.

## 3. Compound expressions

`OR` takes the most permissive branch, `AND` the strictest, parentheses nest, and `+` reads as
`-or-later`:

| Expression | `bundled` | Why |
| -- | -- | -- |
| `(MIT OR Apache-2.0)` | allow | either branch is fine, so take one |
| `MIT OR GPL-3.0-only` | allow | we may use it under MIT |
| `(GPL-3.0-only AND MIT)` | deny | both obligations apply, so the GPL one does |
| `Apache-2.0 WITH Commons-Clause` | deny | the rider removes the right to sell; the base licence is irrelevant |

A malformed expression is `deny`, never a pass.

## 4. The file beats the field

`package.json`'s `license` is a claim; the LICENSE file is the grant. When they disagree, the
**file wins** and the finding is flagged. Detection is conservative on purpose — a signature has
to be a phrase from the canonical text, and only the first few thousand characters are read,
because many packages append the licences of everything they bundle.

A difference is only reported when it **changes the tier**. A package whose 0BSD text is
declared `ISC` is a typo, and reporting 24 of those trains people to ignore the gate. A package
whose AGPL text is declared `MIT` is the reason the rule exists.

## 5. Waivers

A waiver is a dated promise, not a mute button. Eight required fields, in
[`ops/licenses/waivers.yaml`](../../ops/licenses/waivers.yaml):

```yaml
- package: tldraw
  versionRange: "3.15.6"     # `*`, an exact version, `^x.y.z`, `~x.y.z` or `x.y.*`
  license: SEE-LICENSE-IN
  context: bundled
  reason: watermarked free production path under the 3.x text, pinned exactly
  adr: docs/adr/0006-canvas-and-editor-libraries.md
  approvedBy: Justin         # Atlas may approve `review`; `deny` is Justin's alone
  expires: "2027-03-01"      # an expired waiver FAILS, it does not lapse quietly
```

* **No ADR, no waiver.** The ADR is where the reasoning lives; the waiver only points at it.
* **`review` is Atlas's, `deny` is Justin's.** A deny-tier waiver signed by Atlas is itself a
  violation (`waiver-approver`), so the gate cannot be talked around inside the build loop.
* **Expiry is mandatory.** The date is the promise to look again; `never` is not a value.
* An unwaived `review` tier **fails** by default (`reviewWithoutWaiver: fail`). An unanswered
  decision is not a green build. An exploratory branch can flip that to `warn` in the policy or
  pass `--review-warn`, and the report records which mode produced it.

Nothing is waived today. ADR 0006 rejected tldraw rather than waiving it; ADR 0008 rejected
every AGPL product rather than running one modified.

## 6. What the gate produces

`reports/licenses.json` is the contract PAP-216 and PAP-217 read:

```jsonc
{
  "status": "pass",                 // or "fail"
  "scanned": 228,
  "generatedAt": "2026-09-19T…",
  "policy": { "version": 1, "issue": "PAP-211", "reviewWithoutWaiver": "fail" },
  "counts": { "violations": 0, "warnings": 0, "notices": 7 },
  "violations": [ /* { package, version, license, context, tier, kind, waiver?, reason } */ ],
  "warnings":   [ /* same shape: waived tiers and tier-changing mismatches */ ],
  "notices":    [ /* { package, version, license, context, homepage } — what we ship */ ]
}
```

Also written on request: SARIF 2.1.0 (`--sarif`, so findings land as inline annotations once
PAP-80 merges SARIF) and a Markdown summary (`--markdown`, for the job summary).

`THIRD_PARTY_NOTICES.md` is generated from `notices` — the production closure only, because
attribution is owed for what we ship, not for the test runner. `node ops/licenses/notices.mjs
--check` fails when it is stale, so a new production dependency cannot land without its line.

## 7. Rust

[`ops/licenses/deny.toml`](../../ops/licenses/deny.toml) mirrors the allow list for
`cargo-deny`. There is no `Cargo.lock` yet (the Tauri shell is PAP-19), so the CI step skips
cleanly rather than failing, and starts working the day Rust lands. A test
(`__tests__/policy.test.mjs`) fails if the two allow lists drift apart, so the mirror cannot rot
quietly.

## 8. Running it

```bash
node ops/licenses/check.mjs --markdown -     # ~4 s on the current workspace; budget is 90 s
node ops/licenses/notices.mjs --check
pnpm vitest run --config ops/licenses/vitest.config.mjs
```

A stale lockfile is a **fast fail**, not a scan: if `pnpm-lock.yaml` is newer than the last
install, the checker exits `2` and says to install, rather than classifying data that no longer
describes the tree.

The `licenses` CI job is PAP-78's to add (it owns `.github/workflows/ci.yml`); the step list is
in ADR 0027 §Consequences and on PAP-78. Until it is wired, the gate is a local command and the
evidence of a real run lives in [`docs/evidence/PAP-211/`](../evidence/PAP-211/).

## 9. The licence of PaperOS's own code — open

The repository's `LICENSE` is a placeholder that grants nothing ("unpublished and proprietary
while the license is being decided", decision owner Justin) and `package.json` says
`"license": "UNLICENSED"`. Those two are consistent and correct for today, and PAP-211 changed
**neither** — deliberately, because the choice is Justin's:

> **NJ-7 — the licence of the template code itself.** MIT, Apache-2.0 or proprietary.
> **Default after 48 h: Apache-2.0.** Owner: Justin. Filed by PAP-211.

Nothing waits on it. This policy governs the licences of our *dependencies*; our own grant is a
separate question, and the gate's own `UNLICENSED`-is-deny rule never applies to the workspace's
private packages (they are skipped, `skipPrivateWorkspacePackages`). When Justin decides, the
change is three lines — `LICENSE`, the root `license` field, and a note here — and
`THIRD_PARTY_NOTICES.md` needs no change either way.

Recommendation on the record, so the default is not a coin toss: **Apache-2.0**. Every PaperOS
app is cloned from this template, so customers and future contributors receive the code; a
permissive licence with an explicit patent grant and an explicit `NOTICE` mechanism fits a
platform that is handed over, and it is already the most common allow-tier licence in our own
dependency tree. MIT is the same answer without the patent grant; proprietary closes the
template to the clone-and-own workflow that `docs/new-app-in-ten-minutes.md` is built around.
