# specs/

Page specs (`PageSpec`, `@paperos/spec`, ADR 0015). One file per page at `specs/pages/<id>.spec.yaml`;
`meta.id` equals the file name stem and the first line points editors at the JSON Schema:

```yaml
# yaml-language-server: $schema=../../packages/spec/schema/page.spec.schema.json
```

Every file here is parsed in CI (`packages/spec/src/fixtures.test.ts`, zero issues allowed).
Field reference: [`docs/platform/page-spec.md`](../docs/platform/page-spec.md). Check one file:
`pnpm --filter @paperos/spec parse specs/pages/<id>.spec.yaml`.

| File | Surface | Status | Shows |
| -- | -- | -- | -- |
| `pages/customer-invoices.spec.yaml` | customer | ready | live data, Stripe integration, actions registry, a `not-wired` placeholder, six states, external transition |
| `pages/staff-settings.spec.yaml` | staff | ready | four queries, five mutations, field-level access, nested component tree, modal transition |

`app.spec.yaml` (PAP-117) and `specs/components/*.json` (PAP-74) land later. Owner: spec-builder (Quill).
