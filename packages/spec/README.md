# @paperos/spec

Page spec schema, parser, validator and migration skeleton. Owner: spec-builder (Quill), PAP-114
(ADR 0015); PAP-115 adds the CLI and rule engine, PAP-116 / PAP-119 / PAP-121 replace the interim
`access`, `data` and `integrations` shapes, PAP-117 adds `app.spec.yaml`.

```ts
import { parseSpec, validatePageSpec, PageSpecSchema, pageActions } from '@paperos/spec';

const result = parseSpec(yamlText, { filename: 'customer-invoices.spec.yaml', knownRoutes });
if (!result.ok) for (const issue of result.error) console.log(issue.code, issue.path, issue.line, issue.hint);
else console.log(pageActions(result.value)); // WebMCP / voice registry entries
```

| Path | Holds |
| -- | -- |
| `src/schema/page.ts` | `PageSpecSchema`, section schemas, `PAGE_SPEC_KEYS`, `RESERVED_KEYS` |
| `src/schema/refs.ts` | reference grammars (`RouteRef`, `ComponentRef`, `MessageRef`, ...) and their regexes |
| `src/schema/{access,data,integrations}.ts` | interim section shapes, extended in place by their owners |
| `src/schema/filter.ts` | local `FilterTree` alias; `TODO(PAP-279)` names the import to switch to |
| `src/parse.ts`, `src/validate.ts` | `parseSpec` (positions, anchors, duplicates) and `validatePageSpec` (gate and reference rules) |
| `src/issues.ts` | `SpecIssue`, `SPEC_CODES` registry (source of the doc's code table) |
| `src/registry.ts` | `pageActions`, `notWiredComponents` |
| `src/migrate/` | `SPEC_VERSIONS`, `Codemod`, `migrateSpec` skeleton |
| `schema/page.spec.schema.json` | **generated** JSON Schema (`pnpm gen:schemas`), drift-tested |
| `fixtures/valid`, `fixtures/invalid` | test corpus; each invalid fixture has an `.expected.json` with codes, line and col |
| `scripts/gen-schemas.ts` | writes the JSON Schema and `docs/platform/page-spec.md` |

Scripts: `gen:schemas` (also `schema:build`), `gen:schemas:check`, `parse <file>`, `test`, `lint`, `typecheck`.
Reference: [`docs/platform/page-spec.md`](../../docs/platform/page-spec.md).
