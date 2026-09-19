# spikes/PAP-31-sync-eval — PAP-31 local-first sync evaluation

Evidence behind [ADR 0004](../../docs/adr/0004-local-first-sync.md) and
[docs/research/local-first-sync.md](../../docs/research/local-first-sync.md).

This is a **spike**: it is deliberately outside the pnpm workspace and outside `turbo build`,
has no `@paperos/*` dependencies, and nothing in `apps/` or `packages/` may import it.
It runs on plain Node 22 with no install at all except the one benchmark below.

## Layout

| Path | What it is |
| --- | --- |
| `rubric.json` | The ten criteria and their weights (sum 100), the 0-5 scale, and the four hard criteria. |
| `scores/<engine>.json` | One file per engine: versions, licence, a 0-5 score per criterion, each with a note and a `cite` key. |
| `citations.json` | Every `cite` key resolved to a title, URL and date. `render.mjs` fails if a score cites a key that is not here. |
| `measurements.json` | What was actually executed. `null` means *not measured*, never zero. |
| `bench/pglite-local.mjs` | The one benchmark this container could run: the local-store half of an Electric + PGlite client. |
| `scripts/render.mjs` | Scores the rubric and writes `results/summary.json` + `results/table.md`. `--check` fails when they are stale. |
| `results/` | Generated. `summary.json` is the contract PAP-147 reuses as a load-test baseline. |

## Running it

```bash
cd spikes/PAP-31-sync-eval
node scripts/render.mjs          # regenerate the table and summary (no install needed)
node scripts/render.mjs --check  # CI-style staleness check

npm install                      # only needed for the benchmark (@electric-sql/pglite)
npm run bench:electric           # ~90 s, 3 runs, prints per-run and median JSON
```

`bench:electric` creates a 10,000-row `tasks` table across five `tenant_id`s in PGlite, loads a
2,000-row tenant shape, applies 500 incremental shape messages each followed by the list query the
UI would run, queues 200 offline writes into an `_outbox` table and replays them, then closes and
reopens the datadir to time a cold start. It asserts that all 200 writes land and that the md5
checksum of the replayed rows is identical across runs.

## What this spike does *not* prove

No Docker daemon, no browser and no Android emulator were available on the build container, so the
Electric server, `zero-cache`, `powersync-service`, Playwright heap traces and the Android cold start
could not be executed. Those rows are `n/m` in the table and `null` in `summary.json`, and
`results/README.md` lists exactly what each one needs. The scores for those criteria are desk
research against dated primary sources, which the rubric scale treats as evidence but the spec's
"unknowns become rubric penalties" rule also penalises (see the research doc's *Confidence* section).
