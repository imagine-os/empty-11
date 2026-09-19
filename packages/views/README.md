# @paperos/views

View model, view compiler, field types and automations. Owner: tables (Nova), PAP-161..PAP-174.

| Folder | Holds | Issue |
| -- | -- | -- |
| `src/model/` | `ViewSpec`, `FieldDef`, `DatasetRef`, `migrateViewSpec`, JSON Schema builders | PAP-161 (ADR 0016) |
| `src/registry/` | `registerDataset()` / `getDataset()` on the `DatasetRegistryPort` | PAP-161 |
| `src/parity/` | Views parity checklist data and report | PAP-162 |
| `schema/` | **Generated** JSON Schema (`pnpm --filter @paperos/views gen:schemas`); never hand-edit | PAP-161 |
| `fixtures/` | Ten golden `ViewSpec`s (one per kind), two datasets, invalid and migration fixtures | PAP-161 |
| `scripts/` | `gen-schemas.ts`, `print-spec.ts` | PAP-161 |

```sh
pnpm --filter @paperos/views test                                   # ~60 tests, under 5 s
pnpm --filter @paperos/views gen:schemas                            # regenerate schema/*.json
pnpm --filter @paperos/views gen:schemas -- --check                 # exit 1 when a committed schema is stale
pnpm --filter @paperos/views print-spec fixtures/kanban.view.json   # parsed spec + JSON Schema verdict
pnpm --filter @paperos/views parity:report                          # PAP-162 checklist validation
```

Reference: [`docs/platform/view-model.md`](../../docs/platform/view-model.md). Other modules do
not import this package; they import `@paperos/contract-tables` (PAP-483), which re-exports the
types and ports from here.
