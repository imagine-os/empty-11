# Forge topology: Forgejo primary, GitHub mirror

**Status:** reference document for [ADR 0002](../adr/0002-git-forgejo-mirror.md). Written by Forge for PAP-44; **implemented by PAP-47** (mirroring), PAP-45 (Forgejo deployment), PAP-48 (bot identities), PAP-50 (runners), PAP-53 (recovery drill) and `r4/forge/mirror-drift-monitor` (drift detection). Last updated 2026-09-19.

> **This describes the target state.** At the time of writing Forgejo is not deployed and the build loop runs GitHub-only against `imagine-os` (see `docs/decisions/0001-build-pilot-operating-mode.md` in the plan repository). PAP-47 is the issue that flips the source of truth to Forgejo. Until it lands, read every "Forgejo" below as "will be Forgejo".

## 1. Roles

| Node | Host | Role | Writable by |
|---|---|---|---|
| `git.paperos.<domain>` (Forgejo) | Our VPS, behind Caddy (PAP-45) | **Source of truth.** All agent pushes, branch protection, code review, packages, Actions runners | Agent bot accounts, humans, release workflow (PAP-48) |
| `github.com/imagine-os` | GitHub | **Mirror and public front door.** Public discoverability, GitHub Pages demos, GitHub Actions capacity, third-party integrations | Nobody, in steady state. Push mirror only |
| Agent worktrees | Session sandboxes | Working copies, one per issue (PAP-46) | The session that owns them |

The rule in one line: **exactly one node accepts writes at a time, and in steady state it is Forgejo.**

## 2. Steady state

```
   agent session ──push──▶  Forgejo repo  ──push mirror (on push)──▶  GitHub repo
                             (primary)                                 (mirror)
                                  │                                        │
                                  ├─ Forgejo Actions runners               ├─ GitHub Actions
                                  ├─ nightly restic backup (PAP-274)       └─ GitHub Pages
                                  └─ hourly mirror-check.ts ───────────────┘
```

* Each repository is a **normal Forgejo repository** with a **push mirror** pointing at its GitHub counterpart, with *"Sync when new commits are pushed"* enabled so the mirror lands within seconds rather than on the periodic timer.
* Push mirrors **force-push and overwrite the remote** ([Forgejo docs, Repository Mirrors](https://forgejo.org/docs/v15.0/user/repo-mirror/)). That is the intended behaviour here and it is also why only one direction may be armed at a time — see §4.
* A Forgejo **pull mirror** is deliberately *not* used for the GitHub side: a pull-mirror repository can only be created as such and cannot later be converted into a writable repository, which would make failback impossible.
* **LFS objects are not mirrored** (LFS over SSH is not implemented in Forgejo), so large artefacts need their own arrangement — owned by `r4/forge/lfs-and-artifacts`.
* **Issues, pull requests and wikis are not mirrored and are not meant to be.** Linear is the system of record for work, and `[repository] DEFAULT_REPO_UNITS` disables those units on Forgejo (PAP-273). Code review discussion lives on whichever forge is primary at the time.

## 3. Failover and failback

Failover is a deliberate, declared mode change, never an accident.

**Failover (Forgejo unavailable, GitHub becomes primary):**

1. Atlas declares failover and posts it on the active issues; the mode is recorded in `ops/forge/mode.json` (`{"primary":"github","since":"<ts>","reason":"..."}`).
2. Disarm the push mirrors if Forgejo is reachable at all; if it is not, they are inert anyway.
3. Sessions re-point `origin` at `github.com/imagine-os` and continue. Branch protection on GitHub (PAP-46) is already configured to the same policy.
4. CI runs on GitHub Actions. Nothing else changes: same Git history, same branch names, same commit trailers.

**Failback (Forgejo restored):**

1. Restore or rebuild Forgejo (PAP-274 backups, PAP-53 drill).
2. **Re-seed one way:** `git push --mirror` from a GitHub clone into the restored Forgejo repository, *before* re-arming any push mirror. Re-arming a push mirror against a Forgejo that is behind GitHub would force-push the stale history over the good one — this is the single most destructive mistake available in this topology.
3. Verify with `mirror-check.ts` that every head and tag matches on both forges.
4. Re-arm push mirrors, set `ops/forge/mode.json` back to `{"primary":"forgejo"}`, and announce.

Failback is scripted rather than manual precisely because step 2 has a wrong order that destroys history.

## 4. Loop safety

Mirroring in both directions at once would produce a ping-pong of force-pushes. The invariants that prevent it:

* **Single armed direction.** `ops/forge/mode.json` declares the primary; `forge bootstrap --check` (PAP-51, `r4/forge/bootstrap-check-mode`) fails if push mirrors are armed on the node that is not primary.
* **Loop marker.** The mirror monitor records the last mirrored OID per repository per direction and ignores a head it has itself just pushed, so a mirror write never re-triggers a mirror write. `r4/forge/mirror-drift-monitor` carries the test for this.
* **No human or agent pushes to the mirror.** Enforced by GitHub branch protection plus the fact that only the mirror credential holds write access on the GitHub side in steady state (PAP-48).

## 5. Failure modes

| # | Failure | How it shows | Detection | Response | Owner |
|---|---|---|---|---|---|
| F1 | Push mirror credential expires or is revoked | Mirror silently stops updating; GitHub falls behind | `mirror-check.ts` head/tag comparison, hourly; credential-expiry check | Rotate the token (PAP-48), force a sync, verify heads | Forge |
| F2 | Mirror armed in both directions | Alternating force-pushes; commits appear and disappear | `forge bootstrap --check` mode assertion; drift monitor sees flapping heads | Disarm the non-primary direction immediately, re-seed from the primary | Forge |
| F3 | Failback performed in the wrong order | Good history on GitHub is overwritten by a stale restored Forgejo | Drift monitor detects a head moving backwards; reflog on GitHub | Stop the mirror, recover from the GitHub clone or restic backup, re-seed forward | Forge |
| F4 | Forgejo host down | Pushes fail for every session at once | Uptime check (PAP-40, `r4/forge/forge-observability`) | Declare failover (§3); RC-4 in ADR 0002 counts the hours | Forge |
| F5 | GitHub unavailable | Mirror pushes fail; Pages and GitHub Actions unavailable | Mirror monitor push failures; GitHub availability reports | No action needed for code; CI moves to Forgejo runners (PAP-50). RC-3 counts the hours | Forge |
| F6 | LFS objects missing on the mirror | `git lfs fsck` fails on a clone taken from GitHub | Post-restore checks in the DR drill (PAP-53) | Push LFS objects explicitly; long-term fix owned by `r4/forge/lfs-and-artifacts` | Forge |
| F7 | A repository exists on one forge only | `forge bootstrap` never ran, or a repo was created by hand | `forge bootstrap --check` over `repos.yml` | Bootstrap the missing side; never create repositories by hand | Forge |
| F8 | Workflow runs on GitHub but not on Forgejo | Green on GitHub, red or absent on the fallback | `check-workflow-portability.ts` (PAP-50) in Gate 1; the DR drill | Fix the workflow, vendor the action, or record the exception | Forge |
| F9 | Divergent branch protection between forges | A push rejected on one forge succeeds on the other | `forge bootstrap --check` compares rulesets | Re-apply the policy from `repos.yml`; policy is declarative, not clicked | Forge |
| F10 | Backup exists but does not restore | Discovered only during an incident | Timed restore drill (PAP-274) and the monthly DR drill (PAP-53) with RTO/RPO recorded | RC-4 in ADR 0002 trips after two consecutive misses | Forge |

## 6. What this topology deliberately does not do

* It does not mirror issues, pull requests or wikis — Linear owns work.
* It does not make GitHub a second writable primary. Two writable primaries over a force-pushing mirror is a data-loss machine.
* It does not attempt CI parity by assumption: Forgejo Actions is [explicitly not GitHub-Actions-compatible](https://forgejo.org/docs/v15.0/user/actions/github-actions/), so parity is tested, not assumed (PAP-50, PAP-53).
