# docs/platform

Platform reference. Two kinds of file live here and they are treated differently:

* **Generated, never hand-edited** — `dependency-map.json` and its Mermaid rendering
  (`pnpm gen:dep-map`), `compat-matrix.md` / `compat-matrix.json` (CI job `compat`), and any
  JSON Schema emitted by `pnpm gen:schemas`. Editing one is a merge conflict waiting to happen and
  CI fails when the committed copy is stale.
* **Hand-written** — the swap playbook, the kernel walkthrough, runbooks.

* [`forge-topology.md`](forge-topology.md) — Forgejo/GitHub mirroring topology, failover and
  failure modes (PAP-44, hand-written; implemented by PAP-47).

The module-system issues (PAP-433 onwards) land the generated files.
