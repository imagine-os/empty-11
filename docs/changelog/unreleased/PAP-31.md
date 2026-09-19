### Added — PAP-31: local-first sync engine decision

- Evaluated ElectricSQL + PGlite, Zero, PowerSync, Replicache and a TanStack Query baseline against
  a ten-criterion weighted rubric with four hard criteria.
- **ADR 0004 accepted:** ElectricSQL 1.8.1 + PGlite 0.5.8 for read-path sync, `proxy` permission
  path, our own oRPC `_outbox` for writes. PowerSync 1.26.1 is the named runner-up (70-95 h
  migration); Zero and Replicache eliminated on hard criteria (no offline writes; archived).
- Paths: `docs/research/local-first-sync.md`, `spikes/PAP-31-sync-eval/` (rubric, per-engine
  scores with dated citations, PGlite bench, generated `results/summary.json` + `results/table.md`).
- New risks recorded for PAP-270/PAP-271/PAP-272: Electric bypasses Postgres RLS on the read path,
  and Tauri resets IndexedDB/OPFS across app updates, so the local DB is a cache and the outbox must
  be durable outside it.
- ADR: [0004-local-first-sync](../../adr/0004-local-first-sync.md)
