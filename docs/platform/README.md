# docs/platform

Platform reference. Two kinds of file live here and they are treated differently:

* **Generated, never hand-edited** — `dependency-map.json` and its Mermaid rendering
  (`pnpm gen:dep-map`), `compat-matrix.md` / `compat-matrix.json` (CI job `compat`), and any
  JSON Schema emitted by `pnpm gen:schemas`. Editing one is a merge conflict waiting to happen and
  CI fails when the committed copy is stale.
* **Hand-written** — the swap playbook, the kernel walkthrough, runbooks.

Here now:

* [`branching-and-commits.md`](branching-and-commits.md) — ref namespace, worktree-per-issue,
  Conventional Commits and ref protection for parallel agent sessions (PAP-46, ADR 0010).
  Configuration lives in [`ops/forge/`](../../ops/forge/README.md).
* [`library-rubric.md`](library-rubric.md) — the six-criterion library evaluation rubric, anchors,
  hard gates, verdict thresholds and scorecard shape (PAP-209, ADR 0009). Machine-readable copy:
  [`packages/agents/src/rubric/library-rubric.json`](../../packages/agents/src/rubric/library-rubric.json).
* [`forge-topology.md`](forge-topology.md) — Forgejo/GitHub mirroring topology, failover and
  failure modes (PAP-44, hand-written; implemented by PAP-47).

The module-system issues (PAP-433 onwards) land the generated files.
