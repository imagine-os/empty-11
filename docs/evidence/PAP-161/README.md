# Evidence: PAP-161 view model

Definition-of-done evidence for [PAP-161](https://linear.app/paperos/issue/PAP-161) (ADR
[0016](../../adr/0016-view-model.md), reference [`docs/platform/view-model.md`](../../platform/view-model.md)).

## Checks run (2026-09-19, worktree `feat/PAP-161-view-model`)

| Check | Result |
| -- | -- |
| `pnpm --filter @paperos/views test` | 7 files, 97 passed, 1 todo (`PAP-279` strict filter shape), under 5 s |
| `pnpm --filter @paperos/views typecheck` | clean (`strict`, `exactOptionalPropertyTypes`, `expectTypeOf` assertions in `view.test.ts`, `field.test.ts`, `dataset-ref.test.ts`, `dataset-registry.test.ts`) |
| `pnpm --filter @paperos/views lint` | clean |
| `pnpm --filter @paperos/views gen:schemas -- --check` | three committed schema files up to date |
| `pnpm check` (root: lint, typecheck, test, build) | green before push (see the Session ended comment for the commit SHAs) |

Covered by the tests: every golden fixture parses strictly and rejects an unknown top-level key,
an unknown `options` key and a non-current `version`; the nine invalid fixtures fail for their
documented reason; 5 sorts / 3 groups accepted, 6 / 4 rejected; duplicate field ids and keys
rejected with paths; 500 fields accepted, 501 rejected; computed rule; `migrateViewSpec` v1 → v3
fixture; JSON Schema drift and Ajv validation of all fixtures; `memberships` entity exposed as a
dataset through `registerDataset()` / `getDataset()`.

Not in this pass (work package 2, gated on PAP-33 / PAP-34): the Drizzle migration for
`dataset|field|record|view`, the RLS harness and the PGlite integration test. Columns and indexes
are specified in `docs/platform/view-model.md` §8.

## Demo: `pnpm --filter @paperos/views print-spec fixtures/kanban.view.json`

Exit code 0. An invalid file (`fixtures/invalid/six-sorts.view.json`) prints the Zod and Ajv
reasons and exits 1.

```
# fixtures/kanban.view.json
zod: valid
{
  "id": "0192a000-0000-7000-8000-0000000000a2",
  "version": 3,
  "datasetRef": {
    "kind": "custom",
    "datasetId": "0192a000-0000-7000-8000-0000000000d1"
  },
  "name": "Board",
  "fields": [
    {
      "fieldId": "0192a000-0000-7000-8000-0000000000f1",
      "visible": true,
      "order": 0
    },
    {
      "fieldId": "0192a000-0000-7000-8000-0000000000f3",
      "visible": true,
      "order": 1
    },
    {
      "fieldId": "0192a000-0000-7000-8000-0000000000f4",
      "visible": true,
      "order": 2
    },
    {
      "fieldId": "0192a000-0000-7000-8000-0000000000f7",
      "visible": true,
      "order": 3
    }
  ],
  "filter": {
    "v": 1,
    "op": "and",
    "children": []
  },
  "sorts": [
    {
      "fieldId": "0192a000-0000-7000-8000-0000000000f7",
      "direction": "asc"
    }
  ],
  "groups": [
    {
      "fieldId": "0192a000-0000-7000-8000-0000000000f2",
      "direction": "asc",
      "expandMulti": false,
      "collapsed": false,
      "hideEmpty": false
    }
  ],
  "aggregations": [
    {
      "fieldId": "0192a000-0000-7000-8000-0000000000f6",
      "fn": "sum",
      "label": "Hours",
      "scope": "group"
    }
  ],
  "rowHeight": "medium",
  "visibility": "shared",
  "ownerUserId": "11111111-1111-4111-8111-111111111111",
  "permissions": {
    "canEditRecords": [
      "owner",
      "admin",
      "staff"
    ],
    "canEditView": [
      "owner",
      "admin"
    ]
  },
  "locked": false,
  "kind": "kanban",
  "options": {
    "stackByFieldId": "0192a000-0000-7000-8000-0000000000f2",
    "swimlaneFieldId": "0192a000-0000-7000-8000-0000000000f3",
    "coverFieldId": "0192a000-0000-7000-8000-0000000000f9",
    "cardFieldIds": [
      "0192a000-0000-7000-8000-0000000000f3",
      "0192a000-0000-7000-8000-0000000000f4",
      "0192a000-0000-7000-8000-0000000000f7"
    ],
    "hideEmptyStacks": false,
    "wipLimits": {
      "doing": 5
    },
    "stackOrder": [
      "todo",
      "doing",
      "done"
    ]
  }
}
json-schema (https://paperos.dev/schema/view/3): valid
```
