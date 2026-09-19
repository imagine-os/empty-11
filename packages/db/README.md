# @paperos/db

Drizzle schema-as-code for the PaperOS Postgres database, plus the adapters that let the pure
packages talk to it. Nothing here imports React or an app.

| Path | What | Issue |
| -- | -- | -- |
| `src/schema/events.ts` | `outbox_event` (monthly partitions), `event_subscription`, the partition helper and the raw DDL the migration emits | PAP-555 |
| `src/outbox-driver.ts` | the `OutboxDriver` `@paperos/core/events` publishes through — the only file that knows both Drizzle and the envelope | PAP-555 |
| `src/subscriptions.ts` | syncs the in-process subscribers registered with `on()` into `event_subscription` at boot | PAP-555 |
| `src/testing/pglite.ts` | an in-process Postgres (PGlite) with the events schema applied, for integration tests and `examples/events.ts` | PAP-555 |

This package is a stub of the one PAP-32 (Drizzle setup) and PAP-302 (`src/schema/_shared.ts`
column helpers) build out. It exists early because PAP-555 needs somewhere to put the outbox
tables; both issues extend it rather than replacing it.

Migrations are not wired yet (PAP-32). `eventsSchemaSql()` is the DDL of record until they are;
`applyEventsSchema(client)` runs it against any `exec`-capable Postgres client.
