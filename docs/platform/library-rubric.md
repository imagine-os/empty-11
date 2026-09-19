# The PaperOS library evaluation rubric

Status: v1, 2026-09-19. Owner: Scout (Library Evaluator). Issue: PAP-209.
Machine-readable copy: [`packages/agents/src/rubric/library-rubric.json`](../../packages/agents/src/rubric/library-rubric.json).
ADR of record: [ADR 0009](../adr/0009-library-evaluation-rubric.md). ADR body format: [`docs/adr/template.md`](../adr/template.md).

Every "should we adopt X" question in PaperOS is answered with this rubric and
nothing else. Twenty parallel sessions score the same way, so Atlas can lay two
ADRs from two characters side by side and compare the numbers. A library is
never adopted without a scorecard and an ADR.

Scope: npm packages, Rust crates, Docker images and whole OSS products or SaaS
that would sit inside a PaperOS deployment. Same six criteria, same gates; only
the facts differ by kind (§8).

---

## 1. The six criteria and their weights

| # | Id | Criterion | Weight | What it measures |
|---|---|---|---|---|
| 1 | `license` | License | 20 | Can we ship it, in this context, without a waiver or a lawyer? |
| 2 | `maintenance` | Maintenance | 20 | Will it still be here, and answer, in two years? |
| 3 | `bundle` | Bundle size | 15 | What it costs the user's download and parse budget, for the imports we actually use. |
| 4 | `a11y` | Accessibility | 15 | Keyboard, focus, screen reader, targets — out of the box, not after we fix it. |
| 5 | `ts` | TypeScript quality | 15 | Do the types describe the runtime, and do they survive `strict` and `exactOptionalPropertyTypes`? |
| 6 | `agent` | Agent-friendliness | 15 | Can a Claude session use it correctly on the first try, from its docs and types? |

Weights sum to **100**. They are not per-project knobs: changing a weight needs
an ADR that supersedes ADR 0009.

Each criterion is scored **0-4** against the anchors in §2. The weighted total is

```
total = Σ (score_i / 4) × weight_i        →  0 … 100, rounded to the nearest integer
```

### `n/a` and rescaling

A criterion that cannot apply is scored `n/a`, never `0`. `n/a` drops the
criterion and **rescales the remaining weights proportionally to 100**; the
rescaled weights are written onto the scorecard as `rescaledWeights` so the
total is reproducible.

> Example. A headless job queue has no UI, so `a11y` is `n/a`. The remaining 85
> points rescale by `100 / 85`: license 23.53, maintenance 23.53, bundle 17.65,
> ts 17.65, agent 17.65.

`n/a` needs a one-line reason in `evidence`. Allowed `n/a` cases are listed per
criterion in §2; anything else is a score, usually a low one. `license` is never
`n/a`.

---

## 2. Anchors

Scores are anchored, not vibes. Pick the highest anchor whose every clause is
true; if one clause fails, drop a level. `1` and `3` are the in-between rungs
and are spelled out so nobody has to invent them.

### 2.1 `license` — weight 20

Tiers come from the license policy, `ops/licenses/policy.yaml` (PAP-211); the
draft tiers in §6 apply until it merges. "Context" is `bundled`, `server`,
`dev` or `service`, derived the way the policy derives it.

| Score | Anchor |
|---|---|
| 4 | Allow-tier SPDX for the context we use it in (MIT, Apache-2.0, BSD-2/3, ISC, 0BSD, Unlicense, CC0-1.0, Zlib, BlueOak-1.0.0, MPL-2.0 unmodified; OFL-1.1 / CC-BY-4.0 for assets). `LICENSE` file text and the `license` field agree. No CLA, no field-of-use limit, no attribution burden beyond a notices file. |
| 3 | Allow tier, but with friction we must carry: a disagreement between file and field that resolves in our favour, a required attribution surface (About dialog, `/_public/licenses`), or MPL-2.0 where we may end up patching files. |
| 2 | Review tier in a context the policy allows with a waiver (LGPL/GPL in `dev` or `service`, AGPL-3.0 in `service`, BUSL-1.1, ELv2, a bespoke `SEE LICENSE IN` text such as tldraw's watermark clause). Waiver drafted, ADR written, expiry set. |
| 1 | Review tier where the waiver is plausible but unwritten, or an open-core product whose free tier is allow-licensed while the features we want are not (score the free tier, list the excluded features in `facts.excludedFeatures`). |
| 0 | Block tier or unknown: SSPL-1.0, Commons Clause, JSON license, `UNLICENSED`, missing license, or any copyleft in a `bundled` context. **Hard gate `licenseTier` fails — verdict `reject`.** |

`n/a`: never.

### 2.2 `maintenance` — weight 20

| Score | Anchor |
|---|---|
| 4 | A release in the last 90 days; 3+ active maintainers or a company/foundation behind it; median first response on issues under 14 days; a published release cadence or roadmap; breaking changes shipped with codemods or a migration guide. |
| 3 | A release in the last 180 days; 2+ maintainers; median first response under 30 days; issues triaged even when not fixed. |
| 2 | A release in the last 12 months; one maintainer, or a small team with visible backlog debt; median first response under 90 days. **A single-maintainer project is capped at 2 unless a company or foundation backs it** (paid maintainer, org account, funded OSS programme) — say which, with a link. |
| 1 | No release in 12 months but the repo is alive (commits, answered issues), or a healthy fork exists that we would have to follow. |
| 0 | Archived, or 18 months with no commit and no answered issue, or the maintainer has announced they are stopping. |

`n/a`: never (a vendored snapshot is still maintained by somebody — us; score it 1 and say so).

### 2.3 `bundle` — weight 15

Measured, not claimed: gzipped size of **the imports we actually use**, from an
esbuild metafile over a fixture entry point, recorded in `facts.gzipBytes` with
`facts.entryImports`. Vendor "minzipped" numbers from a marketing page are not
evidence.

| Score | Anchor |
|---|---|
| 4 | Under 10 KB gzipped for the used imports; tree-shakeable (ESM, `sideEffects: false` or accurate); no runtime CSS-in-JS cost; no polyfill pull-in. |
| 3 | 10-40 KB gzipped; tree-shakes correctly; peer dependencies we already ship. |
| 2 | 40-100 KB gzipped, or it tree-shakes only with a plugin/config we must maintain, or it drags in one heavyweight peer (moment-class) we would otherwise not ship. |
| 1 | 100-250 KB gzipped, or it is lazy-loadable only as one chunk behind a route, or it ships a WASM blob we must host. |
| 0 | Over 250 KB gzipped for the used imports, or unbundleable (CDN-only, no ESM). |

`n/a`: server-only, CLI-only, `dev`-only, Rust crate, Docker image or SaaS —
nothing reaches the browser bundle. Say which in `evidence`.

### 2.4 `a11y` — weight 15

Anchors approved with Iris (Design & Accessibility). Judged against the org
standard: keyboard, mouse, trackpad, touch and pen today; TV remote / gamepad
d-pad and voice next. Nothing hover-only or drag-only; 44 px targets; visible
focus; 360 → 3840 px.

| Score | Anchor |
|---|---|
| 4 | Correct roles and ARIA out of the box; full keyboard operation including a documented focus order and focus trapping/restore; visible focus it does not suppress; no hover-only or drag-only path (every drag has a keyboard equivalent); respects `prefers-reduced-motion` and forced-colors; targets meet 44 px or are configurable; a published a11y statement or APG conformance, and open a11y issues get answered; tested with a screen reader by upstream. |
| 3 | Correct roles and keyboard operation; one or two named gaps with open upstream issues; focus visible; reduced-motion honoured; drag has a keyboard equivalent even if clumsy. |
| 2 | Keyboard-operable with our wrapper: we supply roles, labels or focus management, and the work is bounded and named (put the hours in `migrationCostHours`). |
| 1 | Keyboard operation is possible only by replacing the library's interaction layer, or a core interaction is drag-only / hover-only with no keyboard path, or it sets `outline: none` globally. |
| 0 | Inaccessible by construction (canvas or div soup with no accessible tree, no focus model) and upstream says it is out of scope. **A UI library scoring 0 here cannot be adopted for a customer-facing surface**; only `trial` behind a flag, with a named remediation issue. |

`n/a`: no user interface at all (server library, CLI, codec, crate). A library
that renders anything is never `n/a`.

### 2.5 `ts` — weight 15

| Score | Anchor |
|---|---|
| 4 | Types written by hand and shipped in the package; correct ESM + CJS export map (`arethetypeswrong` clean, `publint` clean); passes under `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; generics and inference actually work (no `any` at the boundary); typed errors (discriminated unions or typed error classes), not stringly-typed throws. |
| 3 | Hand-written types, sound at our compiler settings; one or two `any`s at the edges; export map fine; errors typed but coarse. |
| 2 | `@types/*` from DefinitelyTyped, up to date with the runtime version we use; or shipped types with known drift that we work around in one place. |
| 1 | Generated or partial types that lie about the runtime, or types that force `skipLibCheck` / a `// @ts-expect-error`, or `@types/*` lagging a major behind. |
| 0 | No types at all and none on DefinitelyTyped. **Hard gate `noTypes` fails — verdict `reject`** (write our own `.d.ts` only under an explicit ADR exception). |

`n/a`: no JavaScript/TypeScript surface at all (a Docker image we only call over
HTTP, a Rust crate with no JS binding). If it has a JS client, score the client.

### 2.6 `agent` — weight 15

This is not a nice-to-have: twenty Claude sessions write most of this codebase,
and a library a session gets wrong on the first try costs more than its bundle.

| Score | Anchor |
|---|---|
| 4 | Markdown docs or an `llms.txt` / raw-markdown route; typed, copy-pasteable examples that compile; a small, orthogonal API surface (one obvious way to do a thing); typed errors with actionable messages; stable naming across versions; the library is well known to Claude (in-weights knowledge, so a session writes correct code without fetching docs); a Context7 or MCP docs source exists. |
| 3 | Good docs in Markdown or easily fetched HTML; examples mostly typed; moderate surface; Claude knows it but not the current major, so a session must check the changelog. |
| 2 | Docs are a generated API reference or a docs site that is hard to fetch; examples untyped or JS-only; the API has several ways to do the same thing; a session needs one doc fetch per non-trivial use. |
| 1 | Docs are a README plus source reading; or the current major renamed things the model still remembers by their old names (a known-wrong-answer trap); or the API depends on implicit global state a session will not guess. |
| 0 | No usable docs; the only reference is a Discord, a video course or a paywall. |

`n/a`: never.

---

## 3. Optional extras

Two standard extras exist (from PAP-755) and are scored when the facts are
available. They are **additive to the six**: each extra takes its weight out of
the base six, which rescale proportionally to `100 − Σ(extra weights)`, exactly
like `n/a` rescaling. Extras used must be listed in `scorecard.extras[]`.

| Id | Extra | Default weight | Facts | 4 | 0 |
|---|---|---|---|---|---|
| `security` | Supply-chain & advisories | 10 | OpenSSF Scorecard, deps.dev / npm advisories | Scorecard ≥ 7.0, no open advisory above `low`, signed releases or provenance | Scorecard < 4.0, or an open `high` advisory with no patched version |
| `packaging` | Packaging correctness | 5 | `publint`, `arethetypeswrong` | Both clean; correct `exports`, ESM + CJS, no dual-package hazard | Either tool reports an error class we would have to patch around |

**Domain extras.** The owning character may add at most **two** domain extras
(examples: `realtimeFps` for canvas libraries, `offlineStory` for sync
libraries, `i18n` for anything with UI strings, `selfHost` for OSS products).
Rules: weight 5 or 10 each; total weight of all extras ≤ 25; every extra ships
0-4 anchors written out in the ADR under *Alternatives rejected*; the same
extras with the same weights are applied to **every candidate in that
comparison** — an extra invented to make one candidate win is a review failure.
Extras never remove a hard gate.

---

## 4. Hard gates

Gates are boolean and evaluated before scoring. **Any gate failing forces
`verdict: reject`**, whatever the total says; the CLI refuses a scorecard whose
verdict disagrees. A gate can only be cleared by an ADR that records the waiver
and its expiry.

| Id | Fails when | Cleared by |
|---|---|---|
| `licenseTier` | The SPDX expression is outside the allow tier for the context and no waiver in `ops/licenses/waivers.yaml` covers it (unexpired). | Waiver + ADR; `block` tier needs Justin. |
| `noTypes` | No TypeScript types ship and none exist on DefinitelyTyped, for a candidate with a JS surface. | ADR exception naming who maintains the `.d.ts`. |
| `webviewIncompatible` | A UI candidate does not work in the Tauri WebViews we ship: `webkit2gtk` (Linux) and `WKWebView` (macOS/iOS). Chromium-only APIs, unsupported CSS, or a crash in the spike. | A tested fallback path, recorded with the spike artefact. |
| `vendorNoSelfHost` | A vendor cloud with no self-host path and no data export we can run on our own box. | Nothing — this one is structural; use a different candidate. |
| `openAdvisory` | An open **critical** advisory with no patched version (PAP-755). | Patched release, or a `pnpm patch` entry registered under the patch policy, with expiry. |

Gate results are recorded on the scorecard as
`gates: { <id>: pass | fail | waived, evidence }`. `waived` requires the ADR id.

---

## 5. Verdict thresholds

| Weighted total | Verdict | Meaning |
|---|---|---|
| ≥ 75 | `adopt` | Goes in the registry as `adopted`, gets a usage note, gets pinned. |
| 60 - 74 | `trial` | Allowed behind one module boundary or one feature flag, with a named re-evaluation date (≤ 90 days) in the ADR's `reviewDate`. |
| < 60 | `reject` | Not used. Recorded anyway, so the next session does not re-litigate it. |
| any total, gate failed | `reject` | Gates win. |

A `trial` that reaches its `reviewDate` without a second scorecard is an
automatic `reject`: the registry check (PAP-216) errors on it.

### Evidence rule

**A score of 3 or 4 requires a URL or a repo path in that criterion's
`evidence`.** No evidence, no high score: `pnpm lib score` exits non-zero and
names the criterion. Scores of 0-2 want evidence too and warn without it.
"The docs say it is fast" is not evidence; a metafile, a trace, a commit date,
an SPDX expression from the tarball or a linked issue is.

Never write a vendor claim as a measured fact. Unknown facts are written
`unknown` with one line on how to find out.

---

## 6. License policy hook

The `license` criterion and the `licenseTier` gate read their tiers from **one**
place so the rubric never drifts from CI:

```
ops/licenses/policy.yaml        # PAP-211, source of truth
docs/libraries/license-policy.md # the prose
```

`pnpm lib score` loads `ops/licenses/policy.yaml` when it exists and resolves
the candidate's SPDX expression against the tier list for the candidate's
context (`OR` passes if any branch is allowed; `AND` needs all branches).
Until PAP-211 merges, the CLI falls back to the **draft tiers** embedded in
`packages/agents/src/rubric/library-rubric.json` under `licensePolicy.draftTiers`
and prints `license policy: draft (PAP-211 unmerged)` on every run, and the
scorecard records `facts.licensePolicySource: draft`. A scorecard scored against
draft tiers is re-checked when PAP-211 lands; the registry drift check flags it.

Draft tiers (mirror of PAP-211's spec, do not edit here — edit PAP-211's policy):

- **allow**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense, CC0-1.0, Zlib, BlueOak-1.0.0, Python-2.0, MPL-2.0 (unmodified); OFL-1.1 and CC-BY-4.0 for assets.
- **review** (ADR + waiver): LGPL-*/GPL-* in `dev` and `service` only, AGPL-3.0 in `service` only, BUSL-1.1, ELv2, WTFPL, bespoke `SEE LICENSE IN` texts.
- **block**: SSPL-1.0, Commons Clause, JSON, `UNLICENSED`, missing, any copyleft in `bundled`.

---

## 7. Ties

Totals within **5 points** of each other are a tie. Break it, in this order:

1. **`migrationCostHours`** — the lower number wins. It is an estimate with a
   basis written next to it (files touched, call sites, from `pnpm lib census`
   once PAP-566/`import-census` lands).
2. **The owning character's written judgement**, recorded in the ADR under
   *Alternatives rejected* in prose, naming the deciding property.

**Never re-score to break a tie.** Nudging an anchor to move a total is a review
failure; Sentinel and Atlas look for it.

---

## 8. Facts, and the kinds of candidate

Facts are collected, not typed: `scripts/lib-facts.ts` writes `facts.json`
(cache `.cache/lib-facts/`, `GITHUB_TOKEN` honoured) and the scorecard embeds it.

| Field | Source |
|---|---|
| `downloadsWeekly`, `lastPublish`, `versionLatest`, `license`, `types` | npm registry + tarball |
| `stars`, `lastCommit`, `openIssues`, `medianFirstResponseDays`, `maintainers`, `archived` | GitHub API |
| `gzipBytes`, `entryImports`, `treeShakes` | esbuild metafile over a fixture entry |
| `scorecard`, `advisories` | OpenSSF Scorecard, deps.dev (PAP-755) |
| `publint`, `attw` | `publint`, `arethetypeswrong` (PAP-755) |
| `fps`, `bundleBytes` (measured) | `pnpm lib score --facts-from <dir>` reads a spike kit's `results/summary.json` |

Facts older than **7 days warn**, they do not fail (GitHub rate limits in CI are
not a reason to block a decision). A fact that could not be fetched is
`unknown`, never `0`.

**By kind:**

- **npm package** — all facts apply.
- **Monorepo library** — score **only the packages we import**; list them in
  `facts.entryImports` and size only those. Maintenance is scored on the repo.
- **Rust crate** — facts from crates.io and the repo; `bundle` is `n/a` unless
  it compiles to WASM we ship, in which case size the `.wasm` gzipped.
- **Docker image / OSS product** — facts from Docker Hub / the repo; `bundle`
  `n/a`; add the resource numbers (RSS, CPU) from the `compose-smoke` run to
  `facts`; the `vendorNoSelfHost` gate is the one that usually decides.
- **SaaS** — `bundle` `n/a`, `ts` scores the client SDK, `maintenance` scores
  status page + changelog cadence; `vendorNoSelfHost` almost always fails.
- **Open core** (tldraw watermark, AG Grid Enterprise) — score the **free
  tier**; list the paid-only features in `facts.excludedFeatures`; a feature we
  need being paid-only is a `license` score of at most 1 and a Needs Justin card
  before any adoption.

---

## 9. The scorecard

One YAML file per candidate in **`docs/libraries/scorecards/`** — the canonical
folder every research issue writes into, named `<candidate>@<version>.yaml`.

```yaml
candidate: "@tanstack/react-table"
version: "8.21.3"
evaluatedBy: Scout            # character
date: 2026-09-19
issue: PAP-292
kind: npm                      # npm | crate | image | oss-product | saas
context: bundled               # bundled | server | dev | service
facts: { }                     # embedded facts.json, or a path to it
scores:
  license:     { score: 4,  evidence: "https://github.com/TanStack/table/blob/main/LICENSE" }
  maintenance: { score: 4,  evidence: "https://github.com/TanStack/table/releases" }
  bundle:      { score: 3,  evidence: "spikes/tables/results/metafile.json#L1" }
  a11y:        { score: 2,  evidence: "headless: roles are ours; see docs/…" }
  ts:          { score: 4,  evidence: "https://arethetypeswrong.github.io/?p=%40tanstack%2Freact-table" }
  agent:       { score: 4,  evidence: "https://tanstack.com/table/latest/docs" }
extras: []                     # e.g. [{ id: security, weight: 10, score: 3, evidence: "…" }]
gates:
  licenseTier:         { result: pass, evidence: "MIT" }
  noTypes:             { result: pass, evidence: "ships types" }
  webviewIncompatible: { result: pass, evidence: "spikes/tables/results/summary.json" }
  vendorNoSelfHost:    { result: pass, evidence: "npm package" }
  openAdvisory:        { result: pass, evidence: "deps.dev, none" }
migrationCostHours: 6
verdict: adopt                 # adopt | trial | reject
```

`pnpm lib score <scorecard.yaml>` validates it against `ScorecardSchema`,
computes the rescaled weights and the total, enforces the evidence rule, the
gate rule and the verdict thresholds, and renders the Markdown table that the
ADR pastes under *Alternatives rejected*. `--facts-only` emits facts for
pre-scoring (PAP-218); `--facts-from <dir>` pulls measured numbers from a spike
kit's `results/summary.json`.

---

## 10. How a session uses this

1. Collect facts (`scripts/lib-facts.ts`, or `--facts-from` a spike).
2. Copy `docs/libraries/scorecard.template.yaml` per candidate into
   `docs/libraries/scorecards/`. Score the six, then the extras.
3. Run `pnpm lib score docs/libraries/scorecards/*.yaml`. Fix what it names.
4. Write the ADR from [`docs/adr/template.md`](../adr/template.md): paste the
   rendered table under *Alternatives rejected*, fill *Re-open criteria* with a
   date **and** a fact.
5. Register the result (PAP-216): `adopted`, `trialing`, `rejected`, `candidate`.
6. Comment on the issues that were waiting, with the scorecard and ADR paths.

**Time box.** Scoring is not research forever. When the issue's box runs out,
hand in the partial ADR with the default recommendation and the scores you have,
marking unknown facts `unknown`. A late decision is worse than a documented
provisional one.

---

## 11. Changing this rubric

Weights, anchors, gates and thresholds are a contract between twenty sessions.
A change needs an ADR that supersedes ADR 0009, Atlas's approval, and a note of
which existing scorecards must be recomputed. Adding a **domain extra** to one
comparison (§3) is not a rubric change and needs no ADR.
