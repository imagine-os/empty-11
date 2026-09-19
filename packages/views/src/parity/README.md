# Views parity data (PAP-162)

`checklist.json` is the source of truth for the views parity audit. Everything else is derived:

| File | Role |
|---|---|
| `checklist.json` | Rows, formula functions, gaps, categories and the dated source list. |
| `linear-ids.json` | Static allowlist of team PAP identifiers, snapshotted 2026-09-19, used to reject unknown `paperos_issue` values. Replace with a live Linear export when one exists. |
| `parity-report.mjs` | Validator, coverage report and CSV emitter. No dependencies beyond Node 22. |

```sh
node packages/views/src/parity/parity-report.mjs            # validate + coverage, exit 1 on any error
node packages/views/src/parity/parity-report.mjs --emit     # regenerate both CSVs under docs/research/
node packages/views/src/parity/parity-report.mjs --selftest # rejection fixtures + coverage maths
```

Edit `checklist.json`, then run with `--emit`; never hand-edit the CSVs. The prose checklist at
`docs/research/views-parity-checklist.md` is regenerated from the same JSON.

This directory holds data and one script; it exports nothing, so there is no barrel entry. When
`packages/views/package.json` exists (PAP-161), add `"parity:report": "node src/parity/parity-report.mjs"`
so the demo runs as `pnpm --filter views parity:report`.
