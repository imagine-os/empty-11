/**
 * `outbox_event` and `event_subscription` — the storage half of the domain event contract
 * (PAP-555, ADR 0013). The pure half is `@paperos/core/events`.
 *
 * `outbox_event` is **range-partitioned by month on `occurred_at`**. Postgres requires every
 * unique constraint on a partitioned table to contain the partition key, so:
 *
 * * the primary key is `(id, occurred_at)`, not `id` alone;
 * * the idempotency index is created **per partition**, which makes idempotency a within-month
 *   guarantee. The idempotency window is 24 hours (Contracts section 4), so the only exposure is
 *   a key replayed across a month boundary; ADR 0013 records it.
 *
 * Drizzle cannot express `PARTITION BY` yet, so the table objects below are for queries and
 * `eventsSchemaSql()` is the DDL of record until the PAP-32 migrations land.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const outboxEvent = pgTable(
  'outbox_event',
  {
    /** UUIDv7 from the publisher; subscribers are idempotent on it. */
    id: uuid('id').notNull(),
    /** `null` for platform events that belong to no tenant. */
    tenantId: uuid('tenant_id'),
    topic: text('topic').notNull(),
    version: integer('version').notNull().default(1),
    /** Database `now()`, never the process clock. */
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    actorId: uuid('actor_id').notNull(),
    actorKind: text('actor_kind').notNull(),
    actorCharacter: text('actor_character'),
    actorOnBehalfOf: uuid('actor_on_behalf_of'),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    requestId: text('request_id'),
    causationId: uuid('causation_id'),
    correlationId: uuid('correlation_id'),
    idempotencyKey: text('idempotency_key'),
    payload: jsonb('payload').notNull(),
    /** `null` until the dispatcher (PAP-556) has fanned the event out. */
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.occurredAt] }),
    index('outbox_event_unpublished_idx').on(t.occurredAt),
    index('outbox_event_subject_idx').on(t.subjectId, t.occurredAt),
    index('outbox_event_topic_idx').on(t.topic, t.occurredAt),
  ],
);

export type OutboxEventRowSelect = typeof outboxEvent.$inferSelect;
export type OutboxEventRowInsert = typeof outboxEvent.$inferInsert;

export const SUBSCRIPTION_KINDS = ['inproc', 'job', 'webhook', 'live'] as const;

export const eventSubscription = pgTable('event_subscription', {
  /** Stable subscriber name, also the dead-letter label. */
  name: text('name').primaryKey(),
  topics: text('topics').array().notNull(),
  kind: text('kind').notNull(),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type EventSubscriptionRow = typeof eventSubscription.$inferSelect;

/* ------------------------------------------------------------------ partitions */

export interface MonthlyPartition {
  /** `outbox_event_2026_09`. */
  readonly name: string;
  /** Inclusive lower bound, `2026-09-01T00:00:00.000Z`. */
  readonly from: string;
  /** Exclusive upper bound, the first instant of the next month. */
  readonly to: string;
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

/** The partition a timestamp falls in. December rolls the year: `2026-12` then `2027_01`. */
export function monthlyPartition(parent: string, date: Date): MonthlyPartition {
  const from = startOfMonthUtc(date);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const month = `${from.getUTCMonth() + 1}`.padStart(2, '0');
  return {
    name: `${parent}_${from.getUTCFullYear()}_${month}`,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

/** `count` consecutive monthly partitions starting with the one `start` falls in. */
export function monthlyPartitions(parent: string, start: Date, count: number): MonthlyPartition[] {
  const first = startOfMonthUtc(start);
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    monthlyPartition(
      parent,
      new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1)),
    ),
  );
}

/**
 * DDL creating one partition and its local indexes. The idempotency index is local because a
 * partitioned parent cannot carry a unique index that omits the partition key.
 */
export function createMonthlyPartitionSql(parent: string, partition: MonthlyPartition): string {
  return [
    `create table if not exists ${partition.name} partition of ${parent}`,
    `  for values from ('${partition.from}') to ('${partition.to}');`,
    `create unique index if not exists ${partition.name}_idempotency_uq`,
    `  on ${partition.name} (tenant_id, idempotency_key) where idempotency_key is not null;`,
    `create index if not exists ${partition.name}_unpublished_idx`,
    `  on ${partition.name} (occurred_at) where published_at is null;`,
  ].join('\n');
}

/** Partitions older than `days` are archived to object storage and dropped (Contracts section 3). */
export const OUTBOX_RETENTION_DAYS = 90;

export function retentionCutoff(now: Date, days: number = OUTBOX_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Partitions of `parent` that are entirely older than the retention cutoff. */
export function expiredPartitions(
  parent: string,
  now: Date,
  oldest: Date,
  days: number = OUTBOX_RETENTION_DAYS,
): MonthlyPartition[] {
  const cutoff = retentionCutoff(now, days);
  const months = Math.max(
    0,
    (now.getUTCFullYear() - oldest.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - oldest.getUTCMonth()) +
      1,
  );
  return monthlyPartitions(parent, oldest, months).filter((p) => new Date(p.to) <= cutoff);
}

/* ------------------------------------------------------------------ schema DDL */

const OUTBOX_PARENT_DDL = `
create table if not exists outbox_event (
  id uuid not null,
  tenant_id uuid,
  topic text not null,
  version integer not null default 1,
  occurred_at timestamptz not null default now(),
  actor_id uuid not null,
  actor_kind text not null,
  actor_character text,
  actor_on_behalf_of uuid,
  subject_type text not null,
  subject_id uuid not null,
  request_id text,
  causation_id uuid,
  correlation_id uuid,
  idempotency_key text,
  payload jsonb not null,
  published_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  constraint outbox_event_pkey primary key (id, occurred_at),
  constraint outbox_event_actor_kind_ck
    check (actor_kind in ('human', 'agent', 'service', 'anonymous')),
  constraint outbox_event_version_ck check (version >= 1)
) partition by range (occurred_at);

create index if not exists outbox_event_subject_idx on outbox_event (subject_id, occurred_at);
create index if not exists outbox_event_topic_idx on outbox_event (topic, occurred_at);
create index if not exists outbox_event_tenant_idx on outbox_event (tenant_id, occurred_at);
`.trim();

const SUBSCRIPTION_DDL = `
create table if not exists event_subscription (
  name text primary key,
  topics text[] not null,
  kind text not null,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_subscription_kind_ck check (kind in ('inproc', 'job', 'webhook', 'live')),
  constraint event_subscription_topics_ck check (cardinality(topics) > 0)
);
`.trim();

/**
 * The full events DDL: both tables plus `months` partitions starting the month before `now`,
 * so a publish at a month boundary always lands in an existing partition.
 */
export function eventsSchemaSql(now: Date = new Date(), months = 3): string {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const partitions = monthlyPartitions('outbox_event', start, months)
    .map((p) => createMonthlyPartitionSql('outbox_event', p))
    .join('\n\n');
  return `${OUTBOX_PARENT_DDL}\n\n${partitions}\n\n${SUBSCRIPTION_DDL}\n`;
}
