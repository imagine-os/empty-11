# ops/licenses — the licence gate

The one place licence tiers are written down, and the check that enforces them.

| File | What it is |
| -- | -- |
| [`policy.yaml`](policy.yaml) | **Source of truth.** Tiers, usage contexts, per-context rules, standing exceptions. |
| [`waivers.yaml`](waivers.yaml) | Time-boxed per-package waivers. Same schema as `policy.yaml`'s `exceptions`. |
| [`check.mjs`](check.mjs) | The gate. Scans every installed package, classifies it, writes `reports/licenses.json`. |
| [`notices.mjs`](notices.mjs) | Generates `THIRD_PARTY_NOTICES.md` from the report's production closure. |
| [`deny.toml`](deny.toml) | The same tiers for `cargo-deny`, for when Rust arrives (PAP-19). |
| `lib/` | `yaml-lite` (the YAML subset), `spdx` (expression parser), `policy`, `inventory`, `text`, `classify`. |
| `fixtures/` | Captured pnpm JSON: a clean workspace, a seeded SSPL violation, a GPL dev tool. |
| `__tests__/` | 64 tests. `pnpm vitest run --config ops/licenses/vitest.config.mjs`. |

Prose and the reasoning: [`docs/platform/license-policy.md`](../../docs/platform/license-policy.md).
Decision: [ADR 0027](../../docs/adr/0027-license-policy.md). Issue: PAP-211.

## Commands

```bash
node ops/licenses/check.mjs                  # scan; exit 1 on a violation, 2 if it cannot run
node ops/licenses/check.mjs --markdown -     # ... and print the summary table
node ops/licenses/check.mjs --policy-only    # validate the two YAML files, scan nothing
node ops/licenses/check.mjs --sarif reports/licenses.sarif
node ops/licenses/notices.mjs                # write THIRD_PARTY_NOTICES.md
node ops/licenses/notices.mjs --check        # fail if the committed notices are stale
pnpm vitest run --config ops/licenses/vitest.config.mjs
cargo deny --config ops/licenses/deny.toml check licenses   # once a Cargo.lock exists
```

Exit codes are the contract: `0` pass (warnings allowed), `1` at least one violation,
`2` the check could not run (bad policy file, nothing installed, pnpm failed). `2` is never
treated as a pass.

## The one-minute version

A dependency is judged by **where it is used**, not only by what it is:

| Context | What it means | GPL / LGPL | AGPL | SSPL, Commons Clause, unlicensed |
| -- | -- | -- | -- | -- |
| `bundled` | ships inside a customer artefact | deny | deny | deny |
| `server` | runs on our machines | review | deny | deny |
| `dev` | build and test only | allow | review | deny |
| `service` | a product we run beside PaperOS | review | review | deny |

MIT, Apache-2.0, BSD-2/3, ISC, 0BSD, MPL-2.0, BlueOak and the asset licences (OFL-1.1,
CC-BY-4.0) are allow everywhere. A `review` tier needs an ADR and an unexpired waiver, or the
build is red. `SEE LICENSE IN <file>` is never allow: somebody reads the text (ADR 0006).

## Adding a waiver

1. Write the ADR that makes the call (a waiver with no ADR is just a mute button).
2. Add an entry to `waivers.yaml` with all eight fields, including a real `expires` date.
3. `review` tier is Atlas's to approve; `deny` tier is Justin's and nobody else's.
4. Re-run `node ops/licenses/check.mjs` — the package moves from violation to warning, and
   the waiver, its ADR and its expiry ride along in `reports/licenses.json`.

An expired waiver **fails**. That is the point: the expiry is a promise to look again.

## Why no dependencies

`check.mjs` imports nothing outside `node:*`. It has to run in a CI job before `pnpm install`
has necessarily succeeded, and adding `spdx-expression-parse`, `spdx-satisfies` and a YAML
parser to the root `package.json` would touch files PAP-13 owns and churn the lockfile that
sixteen parallel sessions rebase on. The SPDX grammar is 40 lines and the YAML subset is the
same one `scripts/security-controls.ts` (PAP-219) already established.
