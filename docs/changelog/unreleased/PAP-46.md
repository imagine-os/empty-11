### Added — PAP-46: branching, commit and ref-protection conventions

- Ref namespace, one worktree per Linear issue, Conventional Commits with `Linear:` / `Character:`
  trailers, rebase-then-publish merge strategy, tag and release-branch rules, CODEOWNERS and
  `ownership.json` schema — with the target (PR-gated) state and the current git-only build-loop
  exception written down side by side so neither is silently contradicted.
- Forge policy as importable configuration: GitHub rulesets and Forgejo protections for `main`,
  `release/*`, `hotfix/*` and `*-v*` tags, an apply manifest and a GitHub-Forgejo parity map.
  Nothing is applied to a live repository yet — that is a Needs Justin action.
- Commit-message enforcement `ops/forge/commitlint.config.cjs` (nine types, scope shape, trailer
  rules, revert rule), mode-switched by `PAPEROS_COMMIT_MODE`; not yet wired to a `commit-msg` hook.
- Paths: `docs/platform/branching-and-commits.md`, `ops/forge/README.md`,
  `ops/forge/commitlint.config.cjs`, `ops/forge/rulesets/*.json`.
- ADR: [0010-branching-and-commits](../../adr/0010-branching-and-commits.md)
