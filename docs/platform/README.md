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
* [`filter.md`](filter.md) — the shared filter and condition grammar `@paperos/core/filter`:
  shape, operator table per field type, null semantics, variables, encoding, extension hook
  (PAP-279, ADR 0012).
* [`mcp-catalog.md`](mcp-catalog.md) — the eleven MCP servers agents can reach, their scope
  classes, owners, broker placeholders and rubric scores (PAP-210, ADR 0021, hand-written).
  Source of truth is [`.claude/mcp/catalog.json`](../../.claude/mcp/catalog.json); the validator
  is `packages/agents/src/mcp/`.
* [`forge-topology.md`](forge-topology.md) — Forgejo/GitHub mirroring topology, failover and
  failure modes (PAP-44, hand-written; implemented by PAP-47).
* [`view-model.md`](view-model.md) — `ViewSpec`, `FieldDef`, `DatasetRef`, the dataset registry
  port, the Airtable / Notion / ClickUp equivalence column and the planned `dataset|field|record|view`
  tables (PAP-161, ADR 0016). Generated JSON Schema lives beside the code in
  `packages/views/schema/`.

The module-system issues (PAP-433 onwards) land the generated files.
