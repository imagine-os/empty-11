# Documentation map (start here)

Everything the repo knows about itself lives under `docs/`. If a rule is not written down here,
it is not a rule.

| Folder | Holds | Rule |
| -- | -- | -- |
| `adr/` | Architecture Decision Records, `<nnnn>-<slug>.md`, Nygard style | Append-only; supersede, never rewrite. Register: [`adr/README.md`](adr/README.md) |
| `changelog/unreleased/` | one fragment per issue, `PAP-<n>.md` | Never edit `CHANGELOG.md` by hand; add a fragment |
| `platform/` | generated and hand-written platform reference (dependency map, compat matrix) | Generated files are never hand-edited |
| `reference/surfaces.md` | every MCP / WebMCP, CLI and API ability | Append a row in the same pass that adds the ability |
| `research/` | `<slug>.md` library and option evaluations behind ADRs | Dated; superseded research says so at the top |
| `pm/` | plans, schedules, kanban snapshots, prompts and replies | Numbered files are append-only |
| `security/` | threat model, secrets handling, review notes | |
| `evidence/PAP-<n>/` | screenshots and artefacts proving a Definition of Done | One folder per issue |

Other maps: the folder map and the day-to-day commands are in the root [`CLAUDE.md`](../CLAUDE.md);
package ownership is in each package's `README.md`.
