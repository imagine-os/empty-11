# docs/platform

Platform reference. Two kinds of file live here and they are treated differently:

* **Generated, never hand-edited** — `events.md`
  (`pnpm --filter @paperos/core run events:catalogue`), `dependency-map.json` and its Mermaid
  rendering (`pnpm gen:dep-map`), `compat-matrix.md` / `compat-matrix.json` (CI job `compat`), and
  any JSON Schema emitted by `pnpm gen:schemas`. Editing one is a merge conflict waiting to happen and
  CI fails when the committed copy is stale.
* **Hand-written** — the swap playbook, the kernel walkthrough, runbooks.

Here now:

* [`branching-and-commits.md`](branching-and-commits.md) — ref namespace, worktree-per-issue,
  Conventional Commits and ref protection for parallel agent sessions (PAP-46, ADR 0010).
  Configuration lives in [`ops/forge/`](../../ops/forge/README.md).
* [`input-events.md`](input-events.md) — the one input model every component handles: the
  `InputEvent` union for mouse, touch, pen, keyboard, wheel, gamepad, TV remote and voice,
  modality detection, spatial focus navigation, chords, thresholds and the actions registry
  (PAP-150, ADR 0019). Package: [`packages/input/`](../../packages/input/README.md).
* [`library-rubric.md`](library-rubric.md) — the six-criterion library evaluation rubric, anchors,
  hard gates, verdict thresholds and scorecard shape (PAP-209, ADR 0009). Machine-readable copy:
  [`packages/agents/src/rubric/library-rubric.json`](../../packages/agents/src/rubric/library-rubric.json).
* [`filter.md`](filter.md) — the shared filter and condition grammar `@paperos/core/filter`:
  shape, operator table per field type, null semantics, variables, encoding, extension hook
  (PAP-279, ADR 0012).
* [`events.md`](events.md) — the domain event catalogue: every topic, its version, producer,
  known consumers and payload fields. **Generated** from the `@paperos/core/events` registry
  (PAP-555, ADR 0013); `--check` drift mode runs in Gate 1.
* [`forge-topology.md`](forge-topology.md) — Forgejo/GitHub mirroring topology, failover and
  failure modes (PAP-44, hand-written; implemented by PAP-47).
* [`view-model.md`](view-model.md) — `ViewSpec`, `FieldDef`, `DatasetRef`, the dataset registry
  port, the Airtable / Notion / ClickUp equivalence column and the planned `dataset|field|record|view`
  tables (PAP-161, ADR 0016). Generated JSON Schema lives beside the code in
  `packages/views/schema/`.

* [`page-spec.md`](page-spec.md) — **generated** field reference and issue codes of `page.spec.yaml`
  v1 (`pnpm --filter @paperos/spec gen:schemas`, PAP-114, ADR 0015). Never hand-edited.
* [`page-spec-versioning.md`](page-spec-versioning.md) — the versioning skeleton that exists and what
  PAP-751 adds (PAP-114, hand-written).
* [`design-tokens.md`](design-tokens.md) — DTCG token source, the `--pos-*` naming grammar, theme
  switching, fluid type, sRGB fallback, and validation (`tokens:lint`/`tokens:check`/`build:check`)
  for `@paperos/tokens` (PAP-66, ADR 0018).

The module-system issues (PAP-433 onwards) land the generated files.
* [`character-schema.md`](character-schema.md) — the character schema every agent character is
  declared in: fields, scope registry, validation codes, inheritance, editor wiring (PAP-103,
  ADR 0020). Generated JSON Schema lives in `packages/agents/schema/`.
* [`license-policy.md`](license-policy.md) — which dependency licences may enter, in which usage
  context (bundled / server / dev / service), the waiver rules and the CI gate (PAP-211,
  ADR 0027). Source of truth: [`ops/licenses/policy.yaml`](../../ops/licenses/policy.yaml);
  gate: [`ops/licenses/README.md`](../../ops/licenses/README.md).
