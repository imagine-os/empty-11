# PAP-211 evidence — licence policy and gate

Every file here was produced by running the gate on this branch, not written by hand.
Policy: [`ops/licenses/policy.yaml`](../../../ops/licenses/policy.yaml). Decision:
[ADR 0027](../../adr/0027-license-policy.md).

| File | What it shows |
| -- | -- |
| `live-run.txt` | `node ops/licenses/check.mjs --markdown -` against the real installed workspace: **228 packages, 0 violations, 0 warnings, 8 notices, exit 0**. |
| `licenses.json` | The report that run produced — the shape PAP-216 and PAP-217 consume. |
| `seeded-violation-run.txt` | The same real capture with two packages injected: a fake `seeded-sspl-dep@1.0.0` (SSPL-1.0) and `tldraw@5.4.2` (`SEE LICENSE IN LICENSE.md`, the ADR 0006 finding). Both come back **deny / bundled**, named with tier, context and reason, **exit 1**. |
| `seeded-violation.sarif` | SARIF 2.1.0 from the same run, so the findings can land as inline annotations once PAP-80 merges SARIF. |
| `THIRD_PARTY_NOTICES.snapshot.md` | `node ops/licenses/notices.mjs` output for the template as of this branch — the production closure only (8 packages; `culori` arrived with PAP-66 on the rebase and the generator picked it up unprompted). |
| `vitest.txt` | `pnpm vitest run --config ops/licenses/vitest.config.mjs` — **64 tests, 7 files, green**. |
| `pnpm-check.txt` | The repo gate on this branch. **`pnpm check` is red at `@paperos/agents#lint` for a reason that predates PAP-211**: `packages/tokens/biome.json` (PAP-66, commit `73ab731`) is a nested Biome 2.5.14 root configuration and needs `"root": false`. The file reproduces the same failure on a clean `origin/main` checkout with no PAP-211 file present, then shows `pnpm turbo lint typecheck test build --filter='!@paperos/agents'` green (39/39) and `@paperos/agents` typecheck and test green on their own. |

## Timing

The scan takes about four seconds on the current workspace against the policy's 90-second
budget, of which nearly all is the three `pnpm` invocations.

## What is NOT here, and why

* **A real CI run with an inline annotation.** `.github/workflows/ci.yml` belongs to PAP-78
  (brief rule 5: root files have one owner). The `licenses` job's step list is in ADR 0027
  §Consequences and on PAP-78; the seeded run above is the same command that job will execute,
  with the same exit code and the same SARIF. The screenshot the spec's Definition of done asks
  for is produced by that job's first red run.
* **A `pnpm licenses:check` alias.** Root `package.json` is PAP-13's; the alias is filed as a
  follow-up. The commands are the `node …` forms above.
* **A Rust run.** There is no `Cargo.lock` yet (PAP-19). `ops/licenses/deny.toml` is wired and
  the CI step skips cleanly until there is one; a test fails if its allow list drifts from the
  policy's.

## The open ask

**NJ-7 — the licence of the template code itself.** MIT, Apache-2.0 or proprietary; default
Apache-2.0 after 48 h; owner Justin. `LICENSE` and the root `license` field were deliberately
left untouched by PAP-211. Reasoning and the recommendation are in
[`docs/platform/license-policy.md`](../../platform/license-policy.md) §9.
