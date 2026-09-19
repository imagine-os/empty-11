# 0010: Branching, commits and ref protection for parallel agent sessions

## Status

Accepted, 2026-09-19. Proposed by Forge under [PAP-46](https://linear.app/paperos/issue/PAP-46); Sentinel reviews, Atlas confirms the ownership map. Supersedes nothing. Referenced by PAP-49, PAP-52, PAP-78, PAP-96, PAP-99, PAP-133, PAP-527, PAP-528.

## Context

Up to twenty Claude Code sessions commit into the same handful of repositories at the same time, on two forges (Forgejo primary, GitHub mirror — ADR 0002). Without an agreed ref namespace and commit grammar, three failures are close to certain: two sessions check out the same clone and overwrite each other's work; `main` goes red and stays red because nobody can tell whose commit did it; and the downstream automation that reads commit history (release notes PAP-52, changelog PAP-133, Linear status PAP-97, session attribution PAP-114) has nothing reliable to parse.

Three constraints shape the answer:

1. **Agents, not humans, do the pushing.** Conventions that rely on someone reading a CONTRIBUTING file do not hold; they have to be machine-checked at commit time, in CI, and at the forge.
2. **Two forges with unequal features.** GitHub repository rulesets express merge queues, linear history and metadata patterns; Forgejo branch protection does not. A single policy has to apply to both and be honest about the gap.
3. **The build loop currently runs without pull requests.** Justin's org-wide policy is git-only, no PRs (build-pilot decision 0001), while the PAP-46 spec and the rest of the plan assume a PR-gated `main`. A policy document that describes only one of the two would be wrong on the day it was written.

## Decision

Adopt the conventions in [`docs/platform/branching-and-commits.md`](../platform/branching-and-commits.md), with configuration in `ops/forge/`:

1. **Ref namespace.** `main`; issue branches `<character>/PAP-<n>-<slug>` (target state) or `feat/PAP-<n>-<slug>` (build-loop mode), slug kebab-case, max 40 characters; `release/<yyyy-mm-dd>`; `hotfix/PAP-<n>`, Atlas only, with a Needs Justin comment; component tags `<component>-v<semver>`. Exactly one live branch per Linear issue.
2. **One git worktree per issue**, never a checkout in a shared clone, created and retired by `scripts/worktree.sh new|done PAP-<n>` whose CLI contract (exit 0 success, 2 refusal, 1 error; `--base` for dependent branches) is frozen in the document so PAP-96 and PAP-93 can code against it before the script exists.
3. **Conventional Commits 1.0.0**, nine types, required scope (a package/app name, or the issue key in build-loop mode), and trailers `Linear: PAP-<n>` and `Character: <Name>`. The invariant both modes share: **every commit resolves to exactly one Linear issue and one character.** Enforced by `ops/forge/commitlint.config.cjs` in the `commit-msg` hook, again in `ci / check`, and coarsely by a forge commit-message pattern.
4. **Rebase, never merge, onto `origin/main`; green check after the rebase; then publish.** `main` is append-only and linear on both forges; no force-push by anyone. In target state publishing is a squash merge through the merge queue; in build-loop mode it is a fast-forward `git push origin HEAD:main` after `pnpm check` is green, with up to five rebase retries.
5. **Protection as checked-in JSON**, not as clicks: `ops/forge/rulesets/*.json` with a manifest (`index.json`) naming each artifact's forge, endpoint and applicable mode, applied idempotently by `scripts/apply-branch-policy.ts` so every new repo (PAP-51) gets the same policy.
6. **Two modes, written down side by side.** The document carries a mode table at the top; build-loop mode is marked as an exception that preserves the three properties the PR flow exists to guarantee (green `main`, linear history, one issue plus one character per commit). Applying the `main` ruleset is the act that ends build-loop mode for a repository; the ruleset manifest says so and the apply script must require an explicit flag.
7. **Signed commits preferred, not required, today.** `required_signatures` ships as a disabled ruleset, flipped on only after PAP-48 provisions per-character SSH signing keys and `allowed_signers`.
8. **Tag protection.** `*-v*` may be created only by the release identity (`bot-forge` on Forgejo, the `paperos-agents` App on GitHub); humans and other bots are rejected.
9. **Ownership.** `.github/CODEOWNERS` is the source of truth, mirrored verbatim to `.forgejo/CODEOWNERS`, with `ownership.json` (`{ paths: [{ glob, owner }] }`) generated from it for the orchestrator's file-lock hints. Cross-owner changes need both owners' reviews or Atlas's `cross-owner` label.
10. **Parity is documented, not papered over.** `ops/forge/rulesets/parity.json` lists every GitHub-only feature with the Forgejo stand-in, and the apply script prints it on every run.

## Consequences

* A session can be handed one issue key and derive everything else — branch name, worktree path, commit scope, trailers — without asking anyone. That is what makes twenty parallel sessions tractable.
* The commit grammar becomes a contract. Changing a type, a trailer name or the scope rule breaks PAP-52, PAP-133, PAP-97 and PAP-114 and therefore needs a new ADR.
* Because commits are checked in three overlapping places, a session that skips the local hook is still caught by CI with a message naming the missing trailer; a push that skips CI is still caught by the forge. Today only the first two layers can be turned on without a human.
* The policy is repo-portable: PAP-51 applies the same JSON to every new repository, so no repo has hand-rolled protection.
* Build-loop mode is weaker than the target state in exactly one way — no second pair of eyes sees a diff before it lands on `main` — and the separate review pass plus `main` staying green is the accepted compensation. The switch back is one flag plus one apply.
* The rulesets do nothing until Justin (or a bot with org rights) applies them; until then §6 of the document is documented intent, and the document says so rather than implying protection exists.
* Forgejo will always be slightly less strict than GitHub (no merge queue, no per-branch linear-history rule, no metadata patterns). The mitigations are real but softer, so the mirror-side guarantee rests more on commitlint and CI than on the forge.

## Alternatives rejected

* **Branch per character instead of per issue** (`forge/work`). Rejected: two Forge sessions then collide on the same branch, which is the exact failure the convention exists to prevent, and the branch stops mapping to a Linear issue.
* **Free-form commit messages with a Linear key somewhere in them.** Rejected: release-note and changelog automation would have to guess at bump levels, and "somewhere" is unparseable. Conventional Commits gives the bump semantics for free.
* **Squash-merge only, with no local hook.** Rejected: the squash message is written by the merge tool, so per-commit attribution (`Character:`, `Sub-Agent:`) would be lost, and PAP-114's session attribution has nothing to read.
* **`required_signatures` on `main` from day one.** Rejected: no agent identity has a signing key until PAP-48, so it would lock every session out of every repository on the first push.
* **Click the protections into both forges by hand.** Rejected: not reproducible for the next repository, invisible in review, and impossible to diff. JSON in the repo is reviewable and reappliable.
* **Write only the target-state policy and let the build loop quietly violate it.** Rejected: a convention document that the running system contradicts trains every future session to ignore it. The exception is named, bounded, and has a stated end condition.
* **Drop the PR flow from the plan entirely, now that the loop does not use it.** Rejected: the git-only mode is Justin's current operating choice, reversible at any time; deleting the target state would throw away the merge-queue, review and gate design that PAP-527, PAP-49 and PAP-239 depend on.

## Links

* Document: `docs/platform/branching-and-commits.md`
* Configuration: `ops/forge/rulesets/`, `ops/forge/commitlint.config.cjs`, `ops/forge/README.md`
* Issue: PAP-46 · Consumers: PAP-49, PAP-52, PAP-78, PAP-96, PAP-99, PAP-133, PAP-527, PAP-528 · Related ADR: 0002 (git + Forgejo mirror, PAP-44)
* Build-pilot operating mode: `docs/decisions/0001-build-pilot-operating-mode.md` in the plan repository
