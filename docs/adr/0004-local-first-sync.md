# 0004. Local-first sync engine

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-31](https://linear.app/paperos/issue/PAP-31)
* Deciders: Scout (library evaluation), Forge (data layer); reviewed by Atlas and Nova
* Implemented by: [PAP-36](https://linear.app/paperos/issue/PAP-36) (PAP-270, PAP-271, PAP-272)
* Evidence: [docs/research/local-first-sync.md](../research/local-first-sync.md),
  [`spikes/PAP-31-sync-eval/`](../../spikes/PAP-31-sync-eval/)
* Supersedes: nothing. Confirms, with amendments, the Blueprint's provisional ElectricSQL + PGlite
  choice.

## Context

PaperOS needs instant reads and offline-capable writes on web, desktop and mobile, over a
multi-tenant Postgres whose tenancy is enforced by row-level security (PAP-34) and whose writes must
carry idempotency keys, actor and reason headers, an audit trail and an event outbox (contracts §3-4,
PAP-38, PAP-303, PAP-304). The Blueprint named ElectricSQL shapes plus PGlite before any engine had
been measured. PAP-31 tested that against Zero, PowerSync, Replicache and a TanStack Query baseline
on a ten-criterion rubric, with a spike that measured what this build container could actually run.

Four facts moved since the Blueprint was written, all dated in the research doc: Electric is at
1.8.1 and PGlite at 0.5.8 (not 0.3); **Electric joined Databricks on 2026-08-11** and Electric Cloud
is winding down while the open-source projects stay open source; **Zero reached 1.0 but does not
support offline writes**; and **Replicache was archived on 2026-06-10**.

Weighted totals: PowerSync 78.8, ElectricSQL + PGlite 77.2, TanStack baseline 75.2, Zero 66.4
(hard-criterion failure: offline writes), Replicache 60.0 (hard-criterion failure: maturity). The
top two are inside the noise of an evaluation whose performance rows are mostly unmeasured, so the
decision is made on structure, not on 1.6 points.

## Decision

**PAP-36 copies this block verbatim. Do not re-litigate it; if a re-open trigger fires, supersede
this ADR.**

```yaml
decision:
  engine: electricsql
  role: read-path sync only; Electric never handles writes
  versions:
    server: electricsql/electric:1.8.1     # Docker, Apache-2.0
    client: "@electric-sql/client@^1.5.28" # Apache-2.0
    react: "@electric-sql/react@^1.0.57"
    localStore: "@electric-sql/pglite@^0.5.8" # Postgres 17 in WASM, Apache-2.0
  persistence:
    web: PGlite over IndexedDB (OPFS where available)
    tauriDesktop: PGlite over OPFS; local DB is a cache, never durable storage
    tauriAndroid: PGlite over OPFS behind a device-matrix check; fall back to an in-memory
      shape cache on devices that fail it
    durableClientState: the _outbox and _sync_meta tables must survive a local-DB reset;
      on Tauri they live outside the WebView-owned store
  permissionPath: proxy
  permissionRules:
    - Electric's HTTP port is never exposed outside the compose network
    - only GET /api/sync/shape (PAP-270) may reach Electric
    - the proxy sets table, the main WHERE (tenant_id = <principal tenant>) and the column
      list from a server-side shape registry; client subset filters may only narrow (AND)
    - an unregistered table returns SHAPE_FORBIDDEN (403)
    - every registered shape has a cross-tenant denial test; it is a security test
  postgres:
    version: ">=14 (we run 17)"
    walLevel: logical
    role: electric, with the REPLICATION attribute; NOT superuser
    connection: direct, not through a pooler
    creates: publication electric_publication_default, slot electric_slot_default
  writePath:
    engine: none — Electric does no write-path sync
    design: oRPC mutations through a local _outbox (PAP-272), replayed with backoff
    conflictModel: last-write-wins per row, server wins, surfaced as 409
      { code: 'CONFLICT', server: row } (contracts §4); CRDT merge applies to Yjs
      documents only (PAP-139/PAP-140), never to records
  knownLimits:
    - RLS is bypassed on the read path (Electric replicates as a REPLICATION role);
      the proxy is the only tenant boundary for reads
    - no built-in write path, offline queue or conflict UI; all three are ours
    - PGlite reserves a large WASM arena (~570 MB RSS measured with 10k rows in Node);
      unverified on mid-range Android WebView
    - IndexedDB/OPFS reset across Tauri app updates
    - shapes above ~10k rows need narrowing or per-view shapes; no server-side pagination
  runnerUp:
    engine: powersync
    versions: { service: "1.26.1 (FSL-1.1-ALv2)", web: "@powersync/web@2.3.1" }
    migrationCostHours: "70-95"
```

## Consequences

**C1 — The shape proxy is a security boundary, not plumbing.** Because Electric bypasses RLS,
PAP-270's proxy is the only thing standing between a client and another tenant's rows on the read
path. Its allowlist and server-set `WHERE` are covered by tests that must be treated as security
tests (Sentinel's gate, PAP-219 threat model), and its shape predicates must be derivable from the
same tenant predicate the RLS policies use so the two cannot drift.

**C2 — We own the write path, deliberately.** No engine that owns writes can honour our idempotency
keys, reason headers, audit rows and outbox events without being wrapped, so choosing an engine that
declines to own writes costs us nothing we were not already building. PAP-272's `_outbox` is the
canonical write path for every module; nothing may write to Postgres from a client by another route.

**C3 — One SQL dialect.** PGlite is real Postgres, so the Drizzle schema, the FilterTree compiler
(PAP-279), the tables compiler (PAP-163) and the data dictionary (PAP-41) emit one dialect for both
server and client. This is the main reason the runner-up lost, and it becomes a constraint: nothing
in the local store may rely on a Postgres extension PGlite does not ship.

**C4 — The local database is a cache.** It can be wiped at any time (schema-hash mismatch, Tauri app
update, storage eviction) and the app must be correct afterwards. Durable client state is the outbox
alone, and on Tauri it lives outside the WebView-owned store.

**C5 — A dated governance risk.** Electric's stewardship moved to Databricks on 2026-08-11 and its
roadmap now points at Lakebase/Neon. The protocol is HTTP over unmodified Postgres and we own the
write path, so our exposure is capped, but the research doc records five re-open triggers and the
library registry entry (PAP-216) carries them.

**C6 — Unmeasured rows stay unmeasured.** The Electric server, zero-cache, powersync-service, the
browser heap traces at 375/1280 and the Android cold start could not run on the build container.
PAP-270 inherits the job of re-running `spikes/PAP-31-sync-eval` against its compose file and filling
`results/summary.json`, which PAP-147 then reuses as a load-test baseline.

## Alternatives rejected

**PowerSync 1.26.1 (runner-up, 78.8).** Best offline story and the only native Tauri SDK, but the
local store is SQLite — a second dialect for every SQL-generating part of the platform — sync rules
add a third policy language beside RLS and `can()`, and the service is FSL source-available rather
than OSI open source. Kept as the named fallback with a 70-95 hour migration estimate.

**Zero 1.9.0 (66.4, hard fail).** The best developer experience of the four and Apache-2.0, but
its own documentation states it does not support offline writes and is "not local-first". PaperOS's
offline edit demo and offline queue (PAP-36, PAP-148) are requirements, so this is elimination on a
hard criterion. Revisit only if offline is dropped as a product requirement.

**Replicache 15.3.0 (60.0, hard fail).** Archived 2026-06-10, maintenance mode, vendor directs users
to Zero. Its push/pull architecture is close to what PAP-272 builds by hand, which is the point:
we can have that architecture without the dead dependency.

**TanStack Query + hand-rolled outbox (75.2, the baseline).** The simplest and most secure option —
nothing bypasses the API — but no live queries, no instant local reads and no partial-sync
streaming, all of which we would then build ourselves. `@tanstack/db` (MIT) is retained as an
optional collection layer above the shape stream in PAP-271, not as a replacement for PGlite.
