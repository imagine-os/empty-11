# Local-first sync engines: Zero, ElectricSQL, PowerSync, Replicache

**Issue:** PAP-31 · **Status:** complete, 2026-09-19 · **Researcher:** Scout, paired with Forge ·
**Decision:** [ADR 0004](../adr/0004-local-first-sync.md) ·
**Evidence:** [`spikes/PAP-31-sync-eval/`](../../spikes/PAP-31-sync-eval/)

The Blueprint decided "ElectricSQL shapes + PGlite for local-first reads and an offline write queue"
before any of these engines was measured. PAP-31 exists to test that decision against the state of
the world in September 2026 and either confirm it or say what would change it. It does both: the
decision **holds**, but three of its premises moved and one of them is a new risk the implementation
issues have to absorb.

## 1. What changed since the Blueprint was written

| Premise in the Blueprint | State on 2026-09-19 | Consequence |
| --- | --- | --- |
| "ElectricSQL 1.x HTTP shapes" | Server `electricsql/electric` **1.8.1** (2026-09-07), client `@electric-sql/client` **1.5.28** (2026-09-09), Apache-2.0 | Pin the real versions in the ADR decision block. |
| "PGlite 0.3" | **0.5.8** (2026-08-26), Apache-2.0 | Two minor versions of drift; PAP-271 pins 0.5.x. |
| Electric is an independent open-source vendor | **Electric joined Databricks on 2026-08-11.** Everything already open-sourced (Postgres Sync, PGlite, TanStack DB, Durable Streams) stays open source; **Electric Cloud is winding down**; future work goes into Databricks/Neon Lakebase. | We self-host, so the Cloud wind-down costs us nothing today. Stewardship becomes a re-open trigger (§6). |
| Zero is a credible alternative | Zero reached **1.0 on 2026-06-08** (`@rocicorp/zero` 1.9.0, Apache-2.0) and is excellent — but it **does not support offline writes** and its own docs say it "is not local-first. It's a client-server system with an authoritative server." | Eliminated on a hard criterion, not on points. |
| Replicache is a credible alternative | **Repository archived 2026-06-10**, maintenance mode, no new features, vendor tells users to migrate to Zero; last npm release 2025-07-02. | Eliminated. |
| (not in the Blueprint) PowerSync | Service **1.26.1** (2026-09-14) under FSL-1.1-ALv2, web SDK **2.3.1** (2026-09-10) Apache-2.0, plus a **native Tauri SDK (alpha, 2026-03)**. | Scores marginally *above* Electric on the rubric and becomes the named runner-up (§5). |

## 2. Rubric

Ten criteria, weights summing to 100, scored 0-5 (`0` fails the requirement outright, `5` native fit
with no known gap). Four are **hard criteria**: a 0 eliminates the engine whatever the total says.
Machine-readable in [`spikes/PAP-31-sync-eval/rubric.json`](../../spikes/PAP-31-sync-eval/rubric.json); every score
carries a note and a citation key, and the render script refuses to build the table if a score cites
a source that is not in `citations.json`.

Hard criteria: self-hosts in Docker on the VPS; licence acceptable under PAP-212 (OSI, or
source-available with a recorded re-open trigger); runs in the Tauri 2 WebView on desktop and
Android; does not need Postgres superuser and does not force RLS off the source database.

## Rubric scores (0-5 per criterion, weighted to 100)

| Criterion | Weight | ElectricSQL shapes + PGlite | PowerSync (self-hosted Open Edition) | Zero (Rocicorp) + zero-cache | Replicache + oRPC push/pull | Baseline: TanStack Query + hand-rolled outbox |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Postgres-native change capture | 10 | 5 | 5 | 5 | 1 | 0 |
| Tenant-scoped partial sync | 12 | 5 | 4 | 5 | 3 | 2 |
| Offline writes and conflict model † | 15 | 3 | 5 | 0 | 4 | 3 |
| Permission path / RLS story † | 12 | 3 | 2 | 3 | 4 | 5 |
| Bundle and local-store footprint | 6 | 3 | 4 | 3 | 4 | 5 |
| Browser and Tauri WebView support † | 10 | 3 | 4 | 3 | 3 | 5 |
| Self-host and licence † | 12 | 5 | 3 | 4 | 4 | 5 |
| Maturity and governance | 10 | 3 | 5 | 4 | 0 | 5 |
| TypeScript ergonomics | 8 | 4 | 4 | 5 | 3 | 4 |
| Cost of exit | 5 | 5 | 3 | 2 | 4 | 5 |
| **Weighted total** | **100** | **77.2** | **78.8** | **66.4** | **60** | **75.2** |
| Hard-criterion failures | | none | none | **offlineWrites** | none | none |

† hard criterion: a 0 eliminates the engine regardless of total.

## Measured numbers

| Engine | initial sync (2k rows) | incremental p50 | incremental p95 | replay 200 writes | heap | cold start |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ElectricSQL shapes + PGlite | 44.1 ms | 2.79 ms | 3.64 ms | 79.6 ms | 33.6 MB | 167.1 ms |
| PowerSync (self-hosted Open Edition) | n/m | n/m | n/m | n/m | n/m | n/m |
| Zero (Rocicorp) + zero-cache | n/m | n/m | n/m | n/m | n/m | n/m |
| Replicache + oRPC push/pull | n/m | n/m | n/m | n/m | n/m | n/m |
| Baseline: TanStack Query + hand-rolled outbox | n/m | n/m | n/m | n/m | n/m | n/m |

`n/m` = not measured in this spike; see `results/README.md` for why and what it would take.

## Sources

- `electric-1.0` — Electric 1.0 released, 2025-03-17. https://electric.ax/blog/2025/03/17/electricsql-1.0-released
- `electric-databricks` — Electric is joining Databricks, 2026-08-11. https://electric.ax/blog/2026/08/11/electric-joining-databricks
- `electric-auth` — Electric docs: Auth guide (proxy and gatekeeper patterns), accessed 2026-09-19. https://electric.ax/docs/sync/guides/auth
- `electric-writes` — Electric docs: Writes guide (four write patterns), accessed 2026-09-19. https://electric.ax/docs/sync/guides/writes
- `electric-deployment` — Electric docs: Deployment (Postgres requirements, Docker), accessed 2026-09-19. https://electric.ax/docs/sync/guides/deployment
- `electric-rls-discussion` — electric-sql/electric discussion #1587: RLS support, accessed 2026-09-19. https://github.com/electric-sql/electric/discussions/1587
- `electric-pglite-docs` — PGlite docs: Sync using Electric, accessed 2026-09-19. https://pglite.dev/docs/sync
- `npm-electric` — npm registry: @electric-sql/client 1.5.28 (Apache-2.0), @electric-sql/pglite 0.5.8, @electric-sql/react 1.0.57; Docker Hub electricsql/electric 1.8.1, queried 2026-09-19. https://registry.npmjs.org/@electric-sql/client
- `zero-1.0` — InfoQ: Zero Reaches 1.0, Marking the First Stable Release of Rocicorp's Web Sync Engine, 2026-06-08. https://www.infoq.com/news/2026/06/zero-version-1/
- `zero-when-to-use` — Zero docs: When To Use Zero, accessed 2026-09-19. https://zero.rocicorp.dev/docs/when-to-use
- `zero-permissions` — Zero docs: Permissions, accessed 2026-09-19. https://zero.rocicorp.dev/docs/permissions
- `zero-roadmap` — Zero docs: Roadmap, accessed 2026-09-19. https://zero.rocicorp.dev/docs/roadmap
- `npm-zero` — npm registry: @rocicorp/zero 1.9.0, Apache-2.0, queried 2026-09-19. https://registry.npmjs.org/@rocicorp/zero
- `powersync-protocol` — PowerSync docs: PowerSync protocol (buckets, checkpoints, upload queue), accessed 2026-09-19. https://docs.powersync.com/architecture/powersync-protocol
- `powersync-fsl` — PowerSync Functional Source License (FSL-1.1-ALv2), accessed 2026-09-19. https://powersync.com/legal/fsl
- `powersync-oss` — PowerSync open-source packages, accessed 2026-09-19. https://powersync.com/open-source
- `powersync-tauri` — PowerSync: Introducing the PowerSync Tauri SDK (alpha) - native SQLite because IndexedDB/OPFS reset on Tauri app updates, 2026-03. https://releases.powersync.com/announcements/introducing-the-powersync-tauri-sdk-alpha
- `powersync-sqlite-web` — PowerSync: The Current State Of SQLite Persistence On The Web, 2026-05. https://powersync.com/blog/sqlite-persistence-on-the-web
- `powersync-releases` — PowerSync product updates: PowerSync Service releases; Docker Hub journeyapps/powersync-service 1.26.1, queried 2026-09-19. https://releases.powersync.com/announcements/powersync-service
- `replicache-status` — Replicache: maintenance mode, open-sourced, no longer charged for; repository archived 2026-06-10; migrate to Zero, archived 2026-06-10. https://github.com/rocicorp/replicache
- `npm-replicache` — npm registry: replicache 15.3.0, last published 2025-07-02, queried 2026-09-19. https://registry.npmjs.org/replicache
- `npm-tanstack-db` — npm registry: @tanstack/db 0.9.2 (MIT, 2026-09-14), queried 2026-09-19. https://registry.npmjs.org/@tanstack/db
- `bench-pglite` — spikes/PAP-31-sync-eval/results/pglite-local.raw.json (this spike, 2x3 runs, median reported), 2026-09-19. spikes/PAP-31-sync-eval/results/pglite-local.raw.json
- `contracts-doc` — PaperOS interface-and-data-contracts.md sections 1-4 (RLS context, oRPC conventions), 2026-09-17. docs/interface-and-data-contracts.md
## 3. Findings per engine

### 3.1 ElectricSQL 1.8.1 + PGlite 0.5.8 — chosen

*Change capture.* Electric reads Postgres logical replication, creating its own publication
(`electric_publication_default`) and slot (`electric_slot_default`). Postgres 14+; the connecting
role needs the `REPLICATION` attribute, **not superuser**; it must connect directly rather than
through a pooler (pgBouncer 1.23+ excepted). PAP-30 already provisions an `electric` role, so this
is a configuration detail, not a migration.

*Partial sync.* A Shape is a root table plus an optional `WHERE` clause and column projection,
served over plain HTTP. Client-sent subset filters are combined with the server's main `WHERE` using
`AND`, so a client can only ever narrow its own shape, never widen it. That is exactly the shape of
PAP-270's proxy: the proxy sets table and `WHERE tenant_id = <principal tenant>` server-side and
allowlists tables.

*Writes.* Electric is explicit: "Electric does not do write-path sync. It doesn't provide (or
prescribe) a built-in solution for getting data back into Postgres from local apps and services."
It documents four patterns in increasing order of complexity — online writes, optimistic state,
shared persistent optimistic state, and through-the-database sync with an embedded database. PaperOS
needs the fourth, which is precisely the `_outbox` design already specified in PAP-272. **This is
the single biggest cost of the decision and it is a cost we were already paying**: our writes have
to go through oRPC anyway for idempotency keys (§4 of the contracts doc), `X-PaperOS-Reason`, the
audit log (PAP-38) and the outbox events (PAP-303). No engine that owns the write path can honour
those without being wrapped.

*Permissions.* Electric does **not** use Postgres RLS, and cannot: it replicates as a `REPLICATION`
role, which bypasses row-level security. Its documented answer is the proxy or gatekeeper pattern —
"You *don't* have to codify your auth logic into a database rule system" — with the warning that the
proxy must set the table name, the main `WHERE` and the queryable columns server-side, because
"letting clients specify the table allows access to any table". Upstream has an open discussion
about evaluating RLS-style rules on an `electric.shapes` table, but nothing shipped.
**Consequence for PaperOS: the read path gets a second enforcement point beside PAP-34 RLS**, and
that point is application code. §4 says how we keep the two from drifting.

*Local store.* PGlite is a real Postgres 17 compiled to WASM, so the local database speaks the same
SQL as the server: one Drizzle schema, one filter compiler (PAP-279/PAP-163), one set of types.
Measured on this container (2 x 3 runs, medians; local half only, no server or network):

| Measure | Median |
| --- | ---: |
| Load a 2,000-row tenant shape into the local DB | **44.1 ms** |
| Incremental message + the 50-row list query the UI runs, p50 / p95 | **2.79 ms / 3.64 ms** |
| Replay 200 queued offline writes out of `_outbox` | **79.6 ms** |
| Close and reopen the persisted datadir, first query | **167.1 ms** |
| JS heap after 10,000 rows | **33.6 MB** |
| Process RSS after 10,000 rows | **572.7 MB** |

Correctness held: all 200 replayed writes landed and the md5 checksum of the replayed rows was
identical on every run. The number that matters is the last one — **RSS, not heap**. PGlite reserves
a large WASM arena, and while ~570 MB of mostly-untouched virtual memory is nothing on a desktop, it
is the number to watch on a mid-range Android WebView. That test could not be run here (§6).

*Licence and self-host.* Apache-2.0 across server, client and PGlite; one Docker container plus a
disk for the shape log, with the vendor's own priority order "fast disk I/O → memory → CPU".

*Governance.* 1.0 GA since 2025-03-17 and still shipping weekly, but the Databricks acquisition
(2026-08-11) redirects the team's roadmap toward Lakebase and Neon. The open-source commitment is
explicit and the protocol is plain HTTP, which caps our exposure — but this is why maturity scores
3 rather than 5, and why §6 records a re-open trigger.

### 3.2 PowerSync 1.26.1 — runner-up

Technically the strongest offline story of the four: durable local SQLite, an upload queue, and
write checkpoints that order the server's acknowledgement against the sync stream, with per-bucket
checksums to detect divergence. It is also the only engine with a **native Tauri SDK** — announced
in March 2026 specifically because IndexedDB and OPFS reset on every Tauri app update, which the
web SDK could not work around. That SDK is still alpha.

Three things keep it in second place despite the marginally higher rubric total:

1. **The local store is SQLite, not Postgres.** Every part of PaperOS that generates SQL — the
   Drizzle schema (PAP-32), the FilterTree compiler (PAP-279), the tables compiler (PAP-163), the
   data dictionary (PAP-41) — would need a second dialect, and our types (`uuid`, `citext`,
   `jsonb`, `timestamptz`, `bigint` money) would need a projection with its own rounding and
   collation rules. That is a permanent tax on the module system, not a one-time integration.
2. **Sync rules are a third policy language.** Authorisation lives in a YAML bucket definition
   parameterised from JWT claims, alongside PAP-34 RLS and PAP-59 `can()`. Electric's proxy at least
   expresses its filter in the same SQL predicate our RLS policies use.
3. **Licence.** The service is FSL-1.1-ALv2: source-available, free to self-host under the Open
   Edition, converting to Apache-2.0 two years after each release. Acceptable under PAP-212 with a
   trigger, but strictly worse than Apache-2.0 today.

### 3.3 Zero 1.9.0 — eliminated on a hard criterion

Zero is the best developer experience of the four, ZQL synced queries are genuinely better than
shapes, and it is Apache-2.0 and self-hostable. It is also, by its own documentation, the wrong
category of product for PaperOS: "Zero doesn't support offline writes"; Zero "is not local-first.
It's a client-server system with an authoritative server". Writes are rejected while disconnected
and only queued during a brief reconnect. PaperOS's offline edit demo (PAP-36) and the offline queue
semantics in PAP-148 are not optional, so this is elimination, not a low score.

Two further notes for the record: permissions are "filter-based" checks inside server-side query and
mutator handlers — "Zero does not have (or need) a first-class permission system like RLS" — and the
docs recommend datasets under about 100 GB. Worth re-reading if the product ever drops the offline
requirement; it is the engine we would pick in that world.

### 3.4 Replicache 15.3.0 — eliminated

Archived on 2026-06-10, in maintenance mode, free but no longer developed, with the vendor directing
users to Zero. Last npm release 2025-07-02. Its push/pull design is the closest of the four to our
own oRPC contracts — it is effectively the architecture PAP-272 builds by hand — but adopting a
dead dependency to get there would be strictly worse than writing the outbox ourselves.

### 3.5 Baseline: TanStack Query + hand-rolled outbox

Scored as the control, and it scores well (75.2) because it is the security and simplicity ceiling:
nothing bypasses the API, so RLS and `can()` remain the only policy homes, there is no extra service
on the VPS and no WASM. What it does not give is instant local reads, live queries or partial-sync
streaming, and building those ourselves is the work Electric already does. `@tanstack/db` 0.9.2
(MIT, 2026-09-14) is the interesting middle ground and is now maintained in the same orbit as
Electric; PAP-271 should treat it as an optional collection layer over the shape stream, not as a
replacement for PGlite.

## 4. Coexistence with the rest of the platform

**RLS (PAP-34).** Electric bypasses RLS on the read path by construction. The mitigation is
structural, not a promise:

* Only the proxy at `GET /api/sync/shape` (PAP-270) may talk to Electric; Electric's HTTP port is
  never exposed outside the compose network.
* The proxy sets `table`, the main `WHERE` (`tenant_id = <principal tenant>`) and the column list
  from a server-side shape registry. A request naming an unregistered table returns
  `SHAPE_FORBIDDEN` (403).
* The shape registry's `WHERE` for every table must be derivable from the same tenant predicate the
  RLS policy uses, and PAP-270 owns a test that asserts a cross-tenant shape request fails for every
  registered shape. That test is the real boundary; treat it as a security test, not a unit test.
* Writes never take the sync path: they go through oRPC, where RLS, idempotency, audit and reason
  headers all still apply.

**Yjs / CRDTs (PAP-139, PAP-140).** No overlap and no conflict. Documents and canvases are Yjs rooms
over Hocuspocus with their own `yjs_document` / `yjs_updates` tables; records are relational rows
synced by Electric. The two only meet where a record row references a document (`entity:<type>:<id>`
room names), which is a foreign key, not shared state. Do **not** put Yjs update blobs into a shape:
they are large, binary and already have a transport. The conflict model therefore differs by data
kind — CRDT merge for documents, last-write-wins plus a 409 with `{ code: 'CONFLICT', server: row }`
for records (contracts §4) — and PAP-143 owns the UX for the second.

**Event bus (PAP-303) and jobs (PAP-43).** Electric is a read-path transport, not an event bus. The
outbox stays the source of truth for domain events; a shape may deliver the row change to a client
faster than the event pipeline delivers the notification, so no UI may assume ordering between the
two.

**Tauri (PAP-271) — new risk.** PGlite in the Tauri WebView can only persist to IndexedDB or OPFS,
and Tauri resets both across app updates; PowerSync shipped a native SDK specifically because of
this. PAP-271's schema-hash reset already treats the local database as disposable, which is the
right instinct, but two things must be true for that to be safe:

1. The local database is a **cache**. Anything durable — the `_outbox` in particular — must survive
   a reset, so on Tauri it belongs in a store the WebView does not own (Tauri fs/SQLite plugin), or
   the outbox must be drained before an update is applied.
2. If Android WebView memory proves unworkable (the ~570 MB RSS reservation measured above), the
   fallback is to run PGlite in a Rust sidecar or to fall back to the shape stream plus TanStack DB
   in memory on that target only. The shape protocol is plain HTTP, so this is a client-side choice
   per target, not a re-architecture.

## 5. Migration cost, winner to runner-up

If a re-open trigger fires, moving from Electric + PGlite to PowerSync costs roughly **70-95
engineer-hours**, spread as:

| Work | Hours |
| --- | ---: |
| Replace the Electric service and shape proxy with `powersync-service` + sync rules, including the tenant parameterisation and its cross-tenant test (PAP-270 rewritten) | 16-20 |
| Port the local schema and generated types from Postgres SQL to SQLite, including the type projection for `uuid`, `citext`, `jsonb`, `timestamptz` and `bigint` money (PAP-271 rewritten) | 24-32 |
| Replace `_outbox` with the PowerSync upload queue and write the backend connector endpoint, keeping idempotency keys and reason headers (PAP-272 partially rewritten) | 16-22 |
| Second SQL dialect in the filter and tables compilers (PAP-279, PAP-163) | 8-12 |
| Licence review and re-approval under PAP-212, plus docs and ADR supersession | 6-9 |

The reverse direction (PowerSync back to Electric) is cheaper, about 40-55 hours, because the
Postgres-dialect work is not thrown away. This asymmetry is itself an argument for starting on
Electric.

## 6. Confidence, unknowns and re-open triggers

The spec's rule is "unknowns become rubric penalties", and they did: Electric's `targets` and
`bundle` scores are 3 rather than 4-5 precisely because the browser and Android numbers could not be
produced here (no Docker daemon, no browser binaries, no Android SDK on the build container —
`spikes/PAP-31-sync-eval/results/README.md` lists each gap and what it needs). Every performance row except
the PGlite local-store block is `n/m`, and `summary.json` carries `null`, never `0`.

Because of that, the two totals (Electric 77.2, PowerSync 78.8) are **inside the noise of this
evaluation** and the decision is not made on 1.6 points. It is made on the three structural grounds
in §3.2 — one SQL dialect, one fewer policy language, and Apache-2.0 — plus the fact that PaperOS
owns its write path either way.

Re-open ADR 0004 if any of these becomes true:

1. **Governance.** Electric's open-source repositories go six months without a release, or the
   licence of the server, the client or PGlite changes from Apache-2.0.
2. **Android.** PGlite cannot hold a 2,000-row shape in a mid-range Android WebView within the
   device matrix budget (PAP-14), and neither the Rust-sidecar nor the in-memory fallback in §4 is
   acceptable.
3. **Durability.** The Tauri IndexedDB/OPFS reset cannot be contained to the cache — i.e. we cannot
   keep the outbox durable across app updates.
4. **Scale.** A tenant shape routinely exceeds 10,000 rows and the pagination strategy (shape
   `WHERE` narrowing plus per-view shapes) stops being enough; re-measure before assuming PowerSync
   buckets are better.
5. **Offline stops being a requirement.** Then Zero is the better product and this ADR should be
   superseded rather than amended.

## 7. Registry entry draft (for PAP-216)

```yaml
- id: electric-sql
  name: ElectricSQL (Postgres Sync)
  category: sync
  version: "1.8.1"          # electricsql/electric, Docker
  client: "@electric-sql/client@1.5.28"
  licence: Apache-2.0
  selfHosted: true
  evaluatedIn: PAP-31
  adr: docs/adr/0004-local-first-sync.md
  evaluatedOn: 2026-09-19
  reopenTriggers: [governance, android-memory, tauri-durability, shape-scale, offline-dropped]
  runnerUp: powersync@1.26.1
- id: pglite
  name: PGlite (Postgres 17 in WASM)
  category: local-store
  version: "0.5.8"
  licence: Apache-2.0
  selfHosted: true
  evaluatedIn: PAP-31
  adr: docs/adr/0004-local-first-sync.md
  evaluatedOn: 2026-09-19
  notes: local store is a cache, not durable storage; see ADR 0004 consequence C4
```

## 8. Sources

All dated; the machine-readable copy is `spikes/PAP-31-sync-eval/citations.json`, and the generated table in
§2 repeats them inline. Primary sources were read directly (vendor docs, vendor blog posts, the npm
registry and Docker Hub tag listings queried on 2026-09-19); no score rests on a secondary summary
alone except Zero's bundle size, which is quoted from the InfoQ 1.0 report of Marmelab's measurement.
