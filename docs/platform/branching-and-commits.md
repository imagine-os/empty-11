# Branching, commits and ref protection

**Status:** active convention, 2026-09-19 · **Issue:** [PAP-46](https://linear.app/paperos/issue/PAP-46) · **ADR:** [0010](../adr/0010-branching-and-commits.md) · **Owner:** Forge (Sentinel reviews, Atlas confirms the ownership map)

This is the rule set that lets up to twenty parallel Claude Code sessions commit into the same repositories without colliding: how refs are named, how one worktree per Linear issue is created and retired, what a commit message must contain, how work reaches `main`, and which protections the forges enforce. It applies to every PaperOS repository (`paperos-template` first, then every repo cloned from it) on **both** forges — Forgejo is primary, GitHub is the mirror and public front door (ADR 0002 / PAP-44).

Machine-applicable configuration lives next to this document:

| Artifact | Path | Applied by |
| --- | --- | --- |
| GitHub repository rulesets (branch, tag, signing) | `ops/forge/rulesets/github-*.json` | `scripts/apply-branch-policy.ts` (follow-up, see §11) |
| Forgejo branch and tag protections | `ops/forge/rulesets/forgejo-*.json` | same script |
| Apply order + endpoints | `ops/forge/rulesets/index.json` | same script |
| Forge parity map (GitHub-only features) | `ops/forge/rulesets/parity.json` | same script (`--print-parity`) |
| Commit-message enforcement | `ops/forge/commitlint.config.cjs` | commitlint via lefthook `commit-msg` + CI (follow-up, see §11) |

---

## 1. Two modes, and which one you are in

The PaperOS plan specifies a **PR-gated** flow: nothing reaches `main` except through a reviewed pull request with green checks. The 2026-09-19 autopilot build loop runs under Justin's org-wide **git-only, no-PRs** policy instead (see `docs/decisions/0001-build-pilot-operating-mode.md` in the plan repo): builders rebase and push straight to `main`. Both are written down here so the document never silently contradicts the loop that is actually running.

| | **Target state** (plan default, PAP-46 spec) | **Build-loop mode** (active 2026-09-19 →) |
| --- | --- | --- |
| Active when | `ops/forge/rulesets/*` are applied to the repo and bot identities exist (PAP-48) | Justin's git-only policy is in force and no ruleset has been applied |
| Issue branch | `<character>/PAP-<n>-<slug>` — e.g. `forge/PAP-46-branch-policy` | `feat/PAP-<n>-<slug>` — e.g. `feat/PAP-46-branching-and-commits` |
| Worktree root | `../paperos-worktrees/PAP-<n>` | `/workspace/wt/PAP-<n>` |
| Commit scope | package or app — `feat(core): …` | issue key — `feat(PAP-46): …` |
| Linear reference | `Linear: PAP-<n>` trailer (mandatory) | carried by the scope `(PAP-<n>)`; the trailer stays legal and preferred |
| Attribution trailers | `Character: <Name>`, optional `Sub-Agent:`, `Co-Authored-By:` | the two `Co-Authored-By:` / `Claude-Session:` lines the builder brief fixes verbatim; no model identifier anywhere else in the repo |
| Reaching `main` | PR → `ci / check` green → review → squash via merge queue | `git fetch && git rebase origin/main` → full check green → `git push origin HEAD:main`, up to 5 retries on non-fast-forward |
| Direct push to `main` | rejected by the forge | permitted **only** as a fast-forward after a green check; never `--force` |
| Review | Sentinel's gates on the PR before merge | separate review pass after the push, which moves the issue to `Done` |

Everything in §§2-9 holds in **both** modes except the rows above. Switching modes is a one-line change here plus applying or removing the rulesets; no Linear structure changes.

> **Build-loop mode is an exception, not a relaxation.** The three properties the PR flow exists to guarantee still hold: `main` is always green (§5 — the full check passes after the rebase, before the push), history stays linear (§5, §6), and every commit is traceable to one Linear issue and one character (§4).

---

## 2. Ref namespace

| Ref | Pattern | Who may create | Notes |
| --- | --- | --- | --- |
| Default branch | `main` | nobody creates it twice | Protected. Linear history only. In `paperos-template`, PAP-13 creates it. |
| Issue branch | `<character>/PAP-<n>-<slug>` (target) · `feat/PAP-<n>-<slug>` (build-loop) | any session, for its own issue | Exactly one live branch per Linear issue. `<character>` is a lowercase lead name from the roster: `atlas`, `forge`, `iris`, `quill`, `sentinel`, `nova`, `ledger`, `beacon`, `scout`. |
| Work-package branch | `<parent-branch>/wp<k>-<slug>` | the session owning the parent issue | For a folded work package inside one issue (plan convention). |
| Release branch | `release/<yyyy-mm-dd>` | Atlas (`bot-atlas`) or the release workflow | Cut from a green `main`. Protected like `main`; only `fix`, `docs`, `ci`, `chore` land on it. |
| Hotfix branch | `hotfix/PAP-<n>` | Atlas only, and only with a `Needs Justin` comment on PAP-\<n\> naming the risk | The one path that may merge while `main` is red. |
| Spike branch | `spike/<slug>` | any session | Never merged; deleted or pushed as an artifact only. |
| Tag | `<component>-v<semver>` — e.g. `web-v0.4.0` | the release identity only (§7) | Component tags per PAP-52. |

**Slug rules.** Lowercase kebab-case, `[a-z0-9]` with single `-` separators, derived from the Linear issue title, **max 40 characters**, truncated at a `-` boundary and never ending in `-`. `PAP` is uppercase in the ref; `n` has no leading zeros. One ref, one issue: if you need a second branch for the same issue, it is a work-package branch.

**Reserved.** `refs/mirror/*` and any ref a mirror job writes (PAP-47) are off-limits to sessions. Never delete or force-push a branch you did not create; never rewrite another session's commits.

---

## 3. One worktree per issue

A session never `git checkout`s in a shared clone — another session is working there. It adds a worktree:

```sh
git -C <clone> fetch origin main
git -C <clone> worktree add <worktree-root>/PAP-<n> -b <issue-branch> origin/main
```

`<worktree-root>` is `../paperos-worktrees` (target) or `/workspace/wt` (build-loop). Work only inside your own worktree. When the issue is finished and pushed, the worktree is removed and the branch deleted locally (`git worktree remove`, then `git branch -D` once the work is on `main`).

### 3.1 `scripts/worktree.sh` CLI contract

The helper is consumed by PAP-96 (orchestrator) and PAP-93 (issue contract) and must behave exactly as follows. *(The script itself is a follow-up — see §11. This section is its contract, frozen here.)*

```
scripts/worktree.sh new  PAP-<n> [--base <branch>[,<branch>...]] [--character <name>] [--root <dir>]
scripts/worktree.sh done PAP-<n> [--root <dir>]
scripts/worktree.sh list
```

`new`:
1. refuses (exit 2) if a worktree for `PAP-<n>` already exists, printing its path;
2. `git fetch origin main`, creates `<worktree-root>/PAP-<n>` on a new branch named per §2 (character from `--character`, else the issue's Agent line, else `feat`);
3. merges each `--base` branch in order (dependent-branch tooling, PAP-528) and writes `.paperos/branch.json` `{ "issue": "PAP-<n>", "bases": [{ "branch": "...", "tip": "<sha>" }] }`;
4. copies `.env.example` to `.env` if absent, runs `pnpm install --offline` when the store allows it and otherwise `pnpm install`;
5. installs the session git config (PAP-533) when the credential-broker socket exists — otherwise leaves git config untouched and prints one line saying so;
6. runs `stack up` (PAP-42) when a compose stack is defined.

`done`:
1. refuses (exit 2) on uncommitted or unpushed changes, printing the worktree path and `git status --short`;
2. removes the worktree, prunes the admin dir, deletes the local branch if it is contained in `origin/main`;
3. `stack down` for that issue's stack.

Exit codes: `0` success · `2` refusal (dirty worktree, worktree exists, unknown issue key) · `1` unexpected error. Every refusal prints the path it refused to touch, on one line, so the orchestrator can parse it.

---

## 4. Conventional Commits

Conventional Commits 1.0.0. One logical change per commit; small, validated commits over one large one.

```
<type>(<scope>)<!>: <subject>

<body — optional, wrapped at 100 columns, explains why>

<trailers>
```

**Types** (the only nine allowed): `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`.
Bump semantics consumed by PAP-52: `feat` → minor, `fix`/`perf` → patch, `feat!` or a `BREAKING CHANGE:` trailer → major (pre-1.0: minor).

**Scope** — required. Either
* a package or app directory name: `core`, `ui`, `views`, `spec`, `agents`, `web`, `api`, `desktop`, `mobile`, `pm`, `forge`, `contract-<module>`, `config-ts`, `config-biome`, `ops`, `docs`; **or**
* a Linear issue key `PAP-<n>` (build-loop mode, §1).

**Subject** — imperative mood, lowercase first letter, no trailing period, ≤ 72 characters; header line ≤ 100 characters total.

**Trailers** (RFC-822 style, one per line, at the end of the message):

| Trailer | Target state | Build-loop mode |
| --- | --- | --- |
| `Linear: PAP-<n>` | **mandatory** | optional (the scope carries the key); preferred when the scope is a package |
| `Character: <Name>` | **mandatory** — a roster lead name, capitalised | optional |
| `Sub-Agent: <Name>` | optional — the sub-character that did the work | optional |
| `Co-Authored-By: <name> <email>` | optional | **two mandatory lines** fixed verbatim by the builder brief (`Co-Authored-By:` + `Claude-Session:`) |
| `BREAKING CHANGE: <text>` | when the change breaks a published contract | same |
| `Refs: PAP-<n>[, PAP-<m>]` | optional — issues touched but not closed | same |

Trailers must sit in the **last paragraph** of the message (one blank line after the body); parsers and commitlint both read only that paragraph. A revert is committed as `fix(<scope>): revert <what>` with a `Reverts: <sha>` trailer, because `revert` is not one of the nine types.

**The one invariant both modes share:** every commit resolves to exactly one Linear issue, either through a `Linear:` trailer or through a `PAP-<n>` scope. A commit with neither is rejected (§9).

Examples:

```
feat(core): add uuidv7 id helper and updated_at stamping

Linear: PAP-302
Character: Forge
```

```
docs(PAP-46): branching, commit and ref-protection conventions

Co-Authored-By: <the brief's exact line>
Claude-Session: <the brief's exact line>
```

### 4.1 Grammar for consumers

Parsers (PAP-52 release notes, PAP-133 changelog, PAP-97 Linear status, PAP-114 session attribution) may rely on this and nothing else:

```abnf
header    = type [ "(" scope ")" ] [ "!" ] ": " subject
type      = "feat" / "fix" / "docs" / "chore" / "refactor" / "test" / "perf" / "ci" / "build"
scope     = issue-key / 1*( ALPHA / DIGIT / "-" / "/" )
issue-key = "PAP-" 1*DIGIT
trailer   = token ": " value        ; last paragraph of the message
```

Extraction rule: the issue key is the first match of `PAP-[0-9]+` in (a) the `Linear:` trailer, else (b) the scope, else (c) the `Refs:` trailer. Never parse it out of the subject text.

---

## 5. Getting work onto `main`

**Both modes.** Rebase, never merge, onto `origin/main`; run the repo's full check (`pnpm check` = lint + typecheck + test + build) and see it green **after** the rebase; only then publish. `main` is append-only: no force-push, ever, by anyone, on either forge.

**Target state.** Push the issue branch, open a PR (template PAP-49), let `ci / check` and the gate checks run, get the required review, and let the merge queue squash-merge it. The merge queue re-runs `ci / check` on the queue branch, so the tip of `main` is green by construction. A dependent PR never merges before its bases (PAP-528).

**Build-loop mode.**

```sh
git fetch origin main && git rebase origin/main
pnpm check                        # must be green
git push origin HEAD:main         # fast-forward only
```

On a non-fast-forward rejection: fetch, rebase, re-check, push again, up to 5 attempts. On a `pnpm-lock.yaml` conflict during the rebase: keep the upstream lockfile, `pnpm install --lockfile-only`, `git add pnpm-lock.yaml`, `git rebase --continue`. If the check cannot be made green, push the **branch** (`git push origin HEAD:<issue-branch>`) and report — never a red `main`.

**Conflict avoidance (the reason parallel sessions work at all).**
* Touch only the paths your issue owns; a root-file change is a reported follow-up, not an edit.
* `CHANGELOG.md` is never edited directly: add `docs/changelog/unreleased/PAP-<n>.md` (2-6 lines: what landed, paths, ADR). PAP-133 assembles them.
* ADR numbers are pre-assigned per issue; two sessions never claim one number.
* New packages under `packages/*` or `apps/*` need no root edit — workspace globs and the `@paperos/*` alias are generic.

---

## 6. Protection rules

Applied from `ops/forge/rulesets/` (the table at the top of this document). What each ref class enforces:

| Rule | `main` | `release/*` | `hotfix/*` | tags `*-v*` |
| --- | --- | --- | --- | --- |
| Deletion blocked | ✔ | ✔ | — (so it can be cleaned up) | ✔ |
| Force-push (non-fast-forward) blocked | ✔ | ✔ | ✔ | ✔ |
| Pull request required | ✔ target · off in build-loop | ✔ | ✔ | n/a |
| Required approvals | 1 (code-owner review required) | 1 | 1 (Atlas) | n/a |
| Required status check `ci / check` | ✔ (strict: branch must be up to date) | ✔ | ✔ | n/a |
| Linear history required | ✔ | ✔ | — | n/a |
| Branch-name pattern enforced | n/a | ✔ `release/<yyyy-mm-dd>` | ✔ `hotfix/PAP-<n>` | ✔ `<component>-v<semver>` |
| Merge queue (squash, max 5) | ✔ target only | — | — | n/a |
| Allowed merge methods | squash | squash | squash | n/a |
| Commit-message pattern (`PAP-<n>` present) | ✔ | ✔ | ✔ | n/a |
| Creation restricted to the release identity | — | Atlas / release workflow | Atlas | ✔ |
| Signed commits | **preferred now, required after PAP-48** | preferred | preferred | required after PAP-48 |

**Signed commits.** The spec says *preferred*, so `required_signatures` ships as a separate, **disabled** ruleset (`github-signing.json`, `forgejo-*.json` `require_signed_commits: false`). Turning it on is gated on PAP-48 provisioning per-character SSH signing keys and an `allowed_signers` file; enabling it earlier would lock every agent out of every branch. The flip is one enforcement flag plus one boolean, recorded in §11 as a follow-up.

**Bypass actors.** Every shipped ruleset has `bypass_actors: []` so the files are directly importable and safe by default. Exactly three identities are meant to bypass, and they are resolved by id at apply time from `ops/forge/rulesets/bypass-actors.example.json`:
* the mirror token (PAP-47) — so mirroring never fights protection;
* `bot-atlas` (PAP-48) — merges and release cuts;
* `bot-forge` / the `paperos-agents` GitHub App (PAP-48, PAP-521) — release tagging.
In build-loop mode no bypass actor exists and no ruleset is applied; see the Needs Justin note in §11.

---

## 7. Tags and releases

* Tags are `<component>-v<semver>` (`web-v0.4.0`), created by release automation (PAP-52), never by hand.
* **Tag protection:** refs matching `*-v*` may be created, updated or deleted **only** by the release identity — `bot-forge` on Forgejo, the `paperos-agents` App on GitHub. Humans and all other bots are rejected. This is the round-4 amendment to PAP-46 and is enforced by `github-tags.json` / `forgejo-tags.json`.
* A release branch `release/<yyyy-mm-dd>` is cut from a green `main`, takes only `fix`/`docs`/`ci`/`chore` commits, and is merged back to `main` (squash) so no fix exists only on the release line.
* A hotfix is `hotfix/PAP-<n>`, Atlas-only, allowed while `main` is red, and requires a `Needs Justin` comment on the issue stating what is being bypassed and why.

---

## 8. Ownership and cross-owner changes

`CODEOWNERS` (GitHub, at `.github/CODEOWNERS`) is the single source of truth and is mirrored verbatim to `.forgejo/CODEOWNERS`. One line per glob, owner is the character's bot account:

```
# <glob>            @<bot-account>   # <Character>
/packages/core/     @bot-forge       # Forge
/packages/ui/       @bot-iris        # Iris
/docs/              @bot-quill       # Quill
```

`ownership.json` is **generated** from it (never hand-edited) with the schema the orchestrator's file-lock hints consume:

```json
{ "paths": [ { "glob": "/packages/core/", "owner": "Forge" } ] }
```

Round-trip rule: `CODEOWNERS → ownership.json → CODEOWNERS` is byte-identical modulo comments and ordering; the generator's test asserts it.

**Cross-owner rule.** A change touching two characters' globs needs either both owners' bot reviews, or the `cross-owner` label applied by Atlas with a one-line reason. In build-loop mode there is no PR to label: the session names every foreign glob it touched in its final report, and the review pass checks it.

> **Drift note (2026-09-19).** The PAP-46 spec names PAP-102 as `ownership.json`'s consumer. Live PAP-102 is the PM board/list/timeline viewer; the file-lock-hint consumer is the parallel-session issue (PAP-99) and the orchestrator (PAP-96). The schema above is unchanged; only the consumer name was corrected. Raised as a comment on PAP-46.

---

## 9. Enforcement: where each rule actually bites

| Rule | Local (`commit-msg` hook) | CI (`ci / check`) | Forge (ruleset) |
| --- | --- | --- | --- |
| Type / scope / subject shape | commitlint | commitlint over the push range | commit-message pattern (coarse) |
| Linear reference present | commitlint (`paperos/linear-reference`) | ✔ | ✔ regex `PAP-[0-9]+` |
| `Character:` trailer | commitlint (error in target mode, warning in build-loop) | ✔ | — |
| Branch name shape | `worktree.sh` creates it | `pr-lint` (PAP-49) | branch-name pattern |
| Green before merge | `pnpm check` by hand | ✔ | required status check |
| Linear history | rebase workflow | — | ✔ |

Three layers deliberately overlap: a human or a session that skips the hook is still caught by CI with a message naming the missing trailer, and a push that skips CI is still caught by the forge. Two of the three layers are configuration-only until the follow-ups in §11 land — see §10.

---

## 10. Not wired yet

Per org policy, anything that does not work yet says so. Today, in this repository:

* **Rulesets are files, not live policy.** Nothing in `ops/forge/rulesets/` is applied to `imagine-os/*`; applying them changes GitHub org settings, which is a **Needs Justin** action (NJ, §11). Until then the protections in §6 are documented intent.
* **commitlint is not installed.** `ops/forge/commitlint.config.cjs` is complete and self-contained but unreferenced: the root `package.json` / `lefthook.yml` wiring is a follow-up owned by the root-file owner (PAP-13 / PAP-78).
* **`scripts/worktree.sh` and `scripts/apply-branch-policy.ts` do not exist.** Their contracts are frozen in §3.1 and `ops/forge/README.md`; sessions create worktrees with the two `git` commands in §3 in the meantime.
* **Bot identities do not exist** (PAP-48), so bypass actors, signed commits and code-owner review are all inert.

## 11. Follow-ups and Needs Justin

**Needs Justin (NJ):** apply `ops/forge/rulesets/*` to `imagine-os/empty-11` (`paperos-template`) and to the Forgejo twin — GitHub org/repo settings and Forgejo admin are irreversible external actions no session performs. The ask: run `scripts/apply-branch-policy.ts --repo imagine-os/empty-11 --apply` once bot identities exist, or import the five GitHub ruleset JSON files by hand. Blocked on: PAP-45 (Forgejo host), PAP-48 (bot accounts). Note that applying the `main` ruleset **ends build-loop mode for that repo** — required PRs and no direct pushes — so it lands together with the mode switch in §1, not before.

**Follow-ups (not done here, by design — these paths belong to other issues):**

1. Root wiring: add `@commitlint/cli` + `@commitlint/config-conventional` devDependencies and `"commitlint": "commitlint --config ops/forge/commitlint.config.cjs"` to the root `package.json`, and a `lefthook.yml` `commit-msg` hook calling it. (PAP-13 / PAP-78 own root files.)
2. `scripts/apply-branch-policy.ts` implementing `index.json` + `parity.json` (idempotent, `--dry-run` diff, `--print-parity`), with the empty-dry-run-diff integration test.
3. `scripts/worktree.sh` per §3.1, with `bats` coverage (new, done, dirty refusal, long-slug truncation).
4. `.github/CODEOWNERS` + `.forgejo/CODEOWNERS` + the `ownership.json` generator and round-trip test; Atlas confirms the map.
5. `scripts/__tests__/commitlint.test.ts` fixtures (valid, missing trailer, wrong type, long subject) and a CI step running commitlint over the push range.
6. Link this document from the template `README.md` (root file, PAP-13).
7. Append §12 to `docs/reference/surfaces.md` when that file exists (PAP-210's surfaces pass owns it).

## 12. Surfaces (for `docs/reference/surfaces.md`)

| Kind | Ability | Contract |
| --- | --- | --- |
| CLI | `scripts/worktree.sh new\|done\|list` | §3.1; exit 0 / 2 / 1 |
| CLI | `scripts/apply-branch-policy.ts [--dry-run\|--apply\|--print-parity] --repo <slug>` | `ops/forge/README.md` |
| CLI | `commitlint --config ops/forge/commitlint.config.cjs` | §4, §9 |
| API (GitHub) | `POST/PUT /repos/{owner}/{repo}/rulesets` | `ops/forge/rulesets/index.json` |
| API (Forgejo) | `POST /repos/{owner}/{repo}/branch_protections`, `.../tag_protections` | same |
| Data | commit-message grammar + trailer names | §4.1 |
| Data | `ownership.json` `{ paths: [{ glob, owner }] }` | §8 |
| Data | required check name `ci / check` | §6 |

No MCP/WebMCP tool and no UI action is introduced by this issue.
