# `ops/forge` — forge policy as configuration

Everything in this folder configures the two forges (Forgejo primary, GitHub mirror — ADR 0002) rather than the product. It is owned by Forge. The prose that explains *why* each value is what it is lives in [`docs/platform/branching-and-commits.md`](../../docs/platform/branching-and-commits.md); this README is the operator's page.

| Path | What it is |
| --- | --- |
| `rulesets/index.json` | Manifest: which artifact goes to which forge endpoint, in which mode, in what order. Read this first. |
| `rulesets/github-main.json` | Repository ruleset protecting the default branch (PRs, `ci / check`, linear history, merge queue, commit-message patterns). |
| `rulesets/github-release.json` | Ruleset for `release/*`: PRs, `ci / check`, linear history, `release/<yyyy-mm-dd>` name pattern. |
| `rulesets/github-hotfix.json` | Ruleset for `hotfix/*`: Atlas-only creation, PR + `ci / check`, `hotfix/PAP-<n>` name pattern; deletion deliberately allowed. |
| `rulesets/github-tags.json` | Tag ruleset: `*-v*` creatable/updatable/deletable only by the release identity. |
| `rulesets/github-signing.json` | `required_signatures` overlay for all refs. **Ships with `enforcement: "disabled"`.** |
| `rulesets/forgejo-main.json`, `forgejo-release.json`, `forgejo-hotfix.json` | Forgejo branch-protection bodies (same intent, Forgejo field names). |
| `rulesets/forgejo-tags.json` | Forgejo tag protection for `*-v*`. |
| `rulesets/bypass-actors.example.json` | The three identities allowed to bypass, by slug. Shipped rulesets have **empty** bypass lists so the JSON is directly importable and safe by default. |
| `rulesets/parity.json` | The GitHub features Forgejo cannot express, and what stands in for each. Printed on every apply. |
| `commitlint.config.cjs` | Commit-message enforcement (types, scope shape, `Linear:`/`Character:`/session trailers). |

Nothing here is applied automatically. See "Not wired yet" below.

## Applying the rulesets

### With the script (once it exists — follow-up)

```sh
pnpm tsx scripts/apply-branch-policy.ts --repo imagine-os/<repo> --dry-run      # print the diff, change nothing
pnpm tsx scripts/apply-branch-policy.ts --repo imagine-os/<repo> --apply
pnpm tsx scripts/apply-branch-policy.ts --print-parity                          # GitHub-only features and mitigations
```

Contract the script must honour:

* **Idempotent.** Match existing policy by `matchBy` from `index.json` (`name` on GitHub, `rule_name` / `name_pattern` on Forgejo); create when absent, update in place when present. Never delete a rule it did not create.
* **`--dry-run` prints a diff and exits 0**; after a successful `--apply`, a `--dry-run` diff must be empty. That is the integration test.
* **Mode aware.** Skip artifacts whose `modes` do not include the active mode (`PAPEROS_FORGE_MODE`, default `build-loop`). Applying `github-main.json` / `forgejo-main.json` ends build-loop mode for that repo; the script must say so and require `--end-build-loop-mode` to proceed.
* **Bypass actors** are resolved from slugs to ids at apply time from `bypass-actors.json` (gitignored) or `--bypass-actors <file>`; an unresolvable slug is a warning, not a failure, and the rule is applied without that actor.
* **Parity gaps degrade gracefully**: print the `parity.json` list, never fail an apply because Forgejo lacks a feature.
* **Never** widens protection bypasses silently: any bypass it adds is echoed on stdout.

### By hand (GitHub, no script needed)

```sh
gh api -X POST /repos/imagine-os/<repo>/rulesets --input ops/forge/rulesets/github-main.json
gh api -X POST /repos/imagine-os/<repo>/rulesets --input ops/forge/rulesets/github-release.json
gh api -X POST /repos/imagine-os/<repo>/rulesets --input ops/forge/rulesets/github-hotfix.json
gh api -X POST /repos/imagine-os/<repo>/rulesets --input ops/forge/rulesets/github-tags.json
gh api -X POST /repos/imagine-os/<repo>/rulesets --input ops/forge/rulesets/github-signing.json
```

### By hand (Forgejo)

```sh
curl -X POST "$FORGEJO_URL/api/v1/repos/imagine-os/<repo>/branch_protections" \
  -H "Authorization: token $FORGEJO_ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d @ops/forge/rulesets/forgejo-main.json
# release, hotfix the same; tags go to .../tag_protections with forgejo-tags.json
```

Also set, once per repo, what Forgejo cannot express per branch: `PATCH /repos/imagine-os/<repo>` with `{"allow_merge_commits": false, "allow_rebase": true, "allow_squash_merge": true}` — the stand-in for `required_linear_history` (see `parity.json`).

## Wiring commitlint (follow-up, root files)

`commitlint.config.cjs` is complete and unreferenced today. To wire it, the owner of the root files adds:

```jsonc
// package.json
"devDependencies": {
  "@commitlint/cli": "^19",
  "@commitlint/config-conventional": "^19"
},
"scripts": {
  "commitlint": "commitlint --config ops/forge/commitlint.config.cjs"
}
```

```yaml
# lefthook.yml
commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}
```

and one CI step in `ci / check`:

```sh
pnpm commitlint --from "origin/${GITHUB_BASE_REF:-main}" --to HEAD
```

`PAPEROS_COMMIT_MODE=target` switches the `Character:` trailer from warning to error and drops the session-trailer requirement; the default (`build-loop`) is what the autopilot loop needs.

## Not wired yet

* No ruleset in this folder is applied to any live repository. Applying them touches GitHub org/repo settings and Forgejo admin — irreversible external actions that are a **Needs Justin** item (`rulesets/index.json` → `needsJustin`), blocked on PAP-45 (Forgejo host) and PAP-48 (bot accounts).
* `scripts/apply-branch-policy.ts` and `scripts/worktree.sh` do not exist yet; their contracts are frozen above and in the platform doc §3.1.
* Signed commits stay off until PAP-48 provisions per-character SSH signing keys and an `allowed_signers` file. Enabling them earlier locks every agent out of every branch.
* Bot identities (`bot-atlas`, `bot-forge`, …) do not exist, so code-owner review and bypass actors are inert.
