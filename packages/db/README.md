# @paperos/db

Owner: **data-layer** (PAP-32 onwards). Drizzle schema-as-code for the PaperOS Postgres database:
schema, column helpers, RLS policies and migrations, plus the adapters that let the pure packages
talk to it. Nothing here imports React or an app.

| Path | What | Issue |
| -- | -- | -- |
| `src/schema/_shared.ts` | shared column helpers (`money`, `actorRef`, `actorRefCheck`, `entityRef`), the Postgres spelling of `@paperos/core/types` | PAP-302 |
| `src/schema/events.ts` | `outbox_event` (monthly partitions), `event_subscription`, the partition helper and the raw DDL the migration emits | PAP-555 |
| `src/outbox-driver.ts` | the `OutboxDriver` `@paperos/core/events` publishes through — the only file that knows both Drizzle and the envelope | PAP-555 |
| `src/subscriptions.ts` | syncs the in-process subscribers registered with `on()` into `event_subscription` at boot | PAP-555 |
| `src/testing/pglite.ts` | an in-process Postgres (PGlite) with the events schema applied, for integration tests and `examples/events.ts` | PAP-555 |

This package is a stub of the one PAP-32 (Drizzle setup) builds out. It exists early because
PAP-555 needs somewhere to put the outbox tables and PAP-302 somewhere to put the column helpers;
both extend it rather than replacing it.

## Shared column helpers (PAP-302, ADR 0011)

| Export | Emits |
| -- | -- |
| `money('amount')` | `amount_minor bigint NOT NULL`, `currency char(3) NOT NULL` |
| `actorRef('actor')` | `actor_id uuid`, `actor_kind text NOT NULL`, `actor_character text` |
| `actorRefCheck('actor', table)` | `CHECK ((actor_kind = 'anonymous') = (actor_id is null))` |
| `entityRef('subject')` | `subject_type text NOT NULL`, `subject_id uuid NOT NULL` |

These are the Postgres spelling of the value types in
[`@paperos/core/types`](../core/src/types/index.ts). The TypeScript and JSON spellings, and the
table that ties all three together, are in [`docs/platform/types.md`](../../docs/platform/types.md).
The helpers are pure column builders and their tests assert the generated column definitions.

## Migrations

Migrations are not wired yet (PAP-32). `eventsSchemaSql()` is the DDL of record until they are;
`applyEventsSchema(client)` runs it against any `exec`-capable Postgres client. PAP-32 adds the
tenancy columns, the tables, the RLS policies and the migration runner.
