# ADR register

One file per decision, `docs/adr/<nnnn>-<slug>.md`, Nygard style (Status, Context, Decision,
Consequences, Alternatives rejected). **Append-only**: a decision that changes gets a new ADR that
supersedes the old one, and the old one's Status becomes `Superseded by <nnnn>`.

Numbers are pre-assigned by the plan; take yours, do not renumber.

| # | Slug | Issue | Status |
| -- | -- | -- | -- |
| 0001 | [monorepo-stack](0001-monorepo-stack.md) | PAP-13 | Accepted |
| 0002 | [git-forgejo-mirror](0002-git-forgejo-mirror.md) | PAP-44 | Accepted |
| 0003 | [auth-library](0003-auth-library.md) | PAP-56 | Accepted |
| 0004 | [local-first-sync](0004-local-first-sync.md) | PAP-31 | Accepted |
| 0005 | crdt-library | PAP-139 | Planned |
| 0006 | [canvas-and-editor-libraries](0006-canvas-and-editor-libraries.md) | PAP-127 | Accepted |
| 0007 | [payroll-provider](0007-payroll-provider.md) | PAP-176 | Proposed |
| 0008 | [crm-marketing-stack](0008-crm-marketing-stack.md) | PAP-188 | Proposed |
| 0009 | [library-evaluation-rubric](0009-library-evaluation-rubric.md) | PAP-209 | Accepted |
| 0010 | [branching-and-commits](0010-branching-and-commits.md) | PAP-46 | Accepted |
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
| 0022 | [device-matrix](0022-device-matrix.md) | PAP-14 | Accepted |
| 0023 | [review-rubrics](0023-review-rubrics.md) | PAP-79 | Accepted |
| 0024 | threat-model-baseline | PAP-219 | Planned |
| 0025 | [compose-smoke-workflow](0025-compose-smoke-workflow.md) | PAP-754 | Accepted |

The ADR template is [`template.md`](template.md) (PAP-209, ADR 0009): PAP-130 frontmatter over
ADR 0001's Nygard headings, plus the generated Alternatives table and Re-open criteria.
