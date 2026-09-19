# ADR register

One file per decision, `docs/adr/<nnnn>-<slug>.md`, Nygard style (Status, Context, Decision,
Consequences, Alternatives rejected). **Append-only**: a decision that changes gets a new ADR that
supersedes the old one, and the old one's Status becomes `Superseded by <nnnn>`.

Numbers are pre-assigned by the plan; take yours, do not renumber.

| # | Slug | Issue | Status |
| -- | -- | -- | -- |
| 0001 | [monorepo-stack](0001-monorepo-stack.md) | PAP-13 | Accepted |
| 0002 | git-forgejo-mirror | PAP-44 | Planned |
| 0003 | auth-library | PAP-56 | Planned |
| 0004 | local-first-sync | PAP-31 | Planned |
| 0005 | crdt-library | PAP-139 | Planned |
| 0006 | canvas-and-editor-libraries | PAP-127 | Planned |
| 0007 | payroll-provider | PAP-176 | Planned |
| 0008 | [crm-marketing-stack](0008-crm-marketing-stack.md) | PAP-188 | Proposed |
| 0009 | library-evaluation-rubric | PAP-209 | Planned |
| 0010 | branching-and-commits | PAP-46 | Planned |
| 0011 | shared-value-types | PAP-302 | Planned |
| 0012 | filter-grammar | PAP-279 | Planned |
| 0013 | domain-events-outbox | PAP-555 | Planned |
| 0014 | module-manifest | PAP-433 | Planned |
| 0015 | page-spec-schema | PAP-114 | Planned |
| 0016 | view-model | PAP-161 | Planned |
| 0017 | audience-model | PAP-55 | Planned |
| 0018 | design-tokens | PAP-66 | Planned |
| 0019 | input-events | PAP-150 | Planned |
| 0020 | character-schema | PAP-103 | Planned |
| 0021 | mcp-catalog | PAP-210 | Planned |
| 0022 | device-matrix | PAP-14 | Planned |
| 0023 | review-rubrics | PAP-79 | Planned |
| 0024 | threat-model-baseline | PAP-219 | Planned |
| 0025 | compose-smoke-workflow | PAP-754 | Planned |

The ADR template lands with PAP-209 at `docs/adr/template.md`; until then copy 0001's headings.
