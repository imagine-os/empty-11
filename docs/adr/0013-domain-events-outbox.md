# 0013. Domain events on a Postgres transactional outbox

* Status: Accepted
* Date: 2026-09-19
* Issue: [PAP-555](https://linear.app/paperos/issue/PAP-555) (first half of PAP-303)
* Deciders: Forge (build), Sentinel (PII refinement), Atlas (catalogue completeness)

## Context

Twenty issues need one way to say "something happened" before any of them can start. PAP-28 makes
cross-module coupling legal only through an event (`emit('invoice.paid')`); PAP-136 notifications,
PAP-174 automation triggers, PAP-195 segment enter/exit, PAP-222 tenant webhooks and PAP-97's
orchestrator receiver are all subscribers that cannot be written against a bus that does not
exist. Today the only in-process emitter is the orchestrator's.

The hard requirement is not throughput, it is **truthfulness**: an event must never describe a row
change that did not commit, and a committed row change must never lose its event. Everything else
— fan-out, retries, dead-letter, replay — is a delivery concern that can be added behind the same
envelope later (the sibling issue PAP-556).

The platform is already Postgres-first (PAP-30, PAP-32, RLS in PAP-34) and self-hosted on one
Hetzner box for the foreseeable future. Interface & Data Contracts section 3 already fixed the
envelope shape and the initial topic list; this ADR records how it is implemented and what the
implementation costs.

## Decision

**A transactional outbox in Postgres. No broker.**

| Concern | Choice |
| -- | -- |
| Envelope | Zod object in `@paperos/core/events`, exactly Contracts section 3: `id`, `topic`, `version`, `occurredAt`, `tenantId`, `actor`, `subject`, `requestId?`, `causationId?`, `correlationId?`, `idempotencyKey?`, `payload` |
| Ids | UUIDv7 from the publisher, so the outbox is time-ordered on its primary key |
| Topics | `defineTopic(name, payloadSchema, { version, description, producer })`, registered at **import time**; duplicates, bad names, PII keys and non-JSON-representable schemas throw before the process serves traffic |
| Storage | `outbox_event`, range-partitioned monthly on `occurred_at`; `event_subscription` for the subscriber list |
| Write path | `publish(tx, event)` — a **transaction handle is required**; `occurred_at` is the column default `now()`, so no process clock is ever trusted |
| Delivery (today) | `on()` + `drainInProcess(tx)` after commit, at-least-once, handlers idempotent on `event.id` |
| Delivery (next) | the `events.dispatch` job with `FOR UPDATE SKIP LOCKED`, fan-out to jobs, live events, webhooks and the orchestrator — PAP-556, behind the same envelope |
| Catalogue | `docs/platform/events.md` generated from the registry; `--check` drift mode runs in Gate 1 |

**`@paperos/core` stays pure.** The envelope, the registry and `publish()` have no database
dependency: `publish()` writes through an `OutboxDriver` port that `@paperos/db` registers at boot
(`installOutboxDriver()`), and tests use the in-memory driver behind `collectEvents()`. The only
file that knows both Drizzle and the envelope is `packages/db/src/outbox-driver.ts`.

**PII is a boot-time failure, not a review note.** `defineTopic()` converts the payload schema to
JSON Schema and rejects any property on the denylist in `packages/core/src/events/pii.json`
(exact keys plus suffixes, so `billingEmail` is caught and `jobName` is not); `publish()` re-scans
the concrete payload, which catches keys that escape a `z.record()`, and rejects payloads over
64 KB. The denylist is static until PAP-559 derives it from Drizzle column annotations.

**`publish(db, ...)` is a lint error.** The runtime guard (`NotInTransactionError`) is the
backstop; the check that catches it before it runs is
`findPublishOutsideTransaction()` in `@paperos/config-biome/events`, run over the whole repository
by a Vitest fixture test with a good and a bad fixture.

## Consequences

* One fewer service to run, back up and monitor. The outbox is read with the same credentials,
  the same RLS and the same backup as everything else.
* Ordering is per `subject` only and delivery is at-least-once. Every handler is idempotent on
  `event.id` and declares it in its options; there is no `idempotent: false`.
* Partitioning forces the primary key to `(id, occurred_at)`, and Postgres requires a unique index
  on a partitioned table to contain the partition key. The idempotency index is therefore
  **local to each monthly partition**: a duplicate `idempotencyKey` replayed across a month
  boundary would insert twice. The idempotency window is 24 hours (Contracts section 4), so the
  exposure is one boundary minute per month; a global index is the fix if it ever bites.
  A `null` `tenantId` does not dedupe at all (SQL NULLs are distinct) — the idempotency rule is
  per tenant by definition.
* Throughput is bounded by one Postgres. The trigger to revisit is a sustained dispatcher backlog:
  if `events.dispatch` cannot drain 10,000 events in 60 s on the production box (the PAP-303
  bench), or `outbox_event` writes start showing up in slow-query traces, move fan-out to a broker
  **behind the same envelope** — nothing above `publish()` and `on()` changes.
* The generated catalogue means a payload change without a `version` bump fails the gate: the
  schema fingerprint is in the doc.
* Tests that only care about what was published need no database, which keeps the unit suite fast.

## Alternatives rejected

* **Kafka, NATS or Redis Streams.** The right answer at a scale PaperOS is nowhere near. Every one
  of them reintroduces the dual-write problem the outbox exists to solve, and adds a service to a
  single-box deployment.
* **`LISTEN`/`NOTIFY` as the delivery path.** No durability, no redelivery, a payload limit, and
  messages are dropped when nobody is listening. It stays what Contracts section 3 says it is: a
  wake-up hint for the dispatcher (PAP-174 debounces it).
* **Logical decoding / Debezium off the WAL.** Genuinely exactly-once-ish and zero write overhead,
  but it publishes *row changes*, not domain events: the topic, the actor and the intent are gone.
  It also needs a replication slot, which complicates the self-hosted backup and restore story.
* **Emitting events from application code after commit.** One line shorter and wrong: any crash
  between commit and emit loses the event silently. That failure is invisible in tests and obvious
  in production.
* **A real Biome rule instead of the scanner.** Biome 2.5.14's plugin surface is GritQL patterns,
  which can match the call shape — the pattern is committed at
  `packages/config-biome/plugins/no-publish-outside-transaction.grit` — but plugins are loaded by
  path from the root `biome.json`, a file this issue does not own, and cannot be resolved from a
  package subpath. The Vitest scanner enforces the same rule today with a fixture proving it
  catches `publish(db, …)`; wiring the plugin is a one-line follow-up for the root owner.
* **Generating the payload types by hand into a `TopicMap`.** Forty-four hand-written lines that
  drift. The map is derived from the catalogue object with one declaration merge instead.
* **Keeping the outbox tables in `packages/core`.** It would have saved creating `packages/db`
  early, but it would put Drizzle inside the contract-zero package. `packages/db` is where PAP-32
  and PAP-302 were going to put the schema anyway.
