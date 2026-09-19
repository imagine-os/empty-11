/**
 * `publish(tx, event)` — the only way an event enters PaperOS.
 *
 * It **requires a transaction handle** so an event can never be written without the row change
 * that caused it: the outbox row and the business row commit together or not at all. Passing the
 * connection-level `db` handle instead is the mistake the guard below and the
 * `no-publish-outside-transaction` lint check exist to catch.
 *
 * `@paperos/core` is pure TypeScript with no database dependency, so the insert itself is done by
 * an `OutboxDriver` that `@paperos/db` registers at boot (`installOutboxDriver()`); tests use the
 * in-memory driver from `./testing.js`. The driver is the only place that knows Drizzle.
 */
import type { DomainEvent, PublishInputBase } from './envelope.js';
import { publishInputBaseSchema } from './envelope.js';
import { uuidv7 } from './refs.js';
import type { TopicMap, TopicName, TopicPayload } from './registry.js';
import { requireTopic } from './registry.js';
import { enqueuePending } from './subscribe.js';

/** An opaque database transaction handle. The driver decides what a valid one looks like. */
export type Tx = object;

/** The flat row written to `outbox_event`. Column names are the Drizzle field names. */
export interface OutboxEventRow {
  readonly id: string;
  readonly tenantId: string | null;
  readonly topic: string;
  readonly version: number;
  readonly actorId: string;
  readonly actorKind: string;
  readonly actorCharacter: string | null;
  readonly actorOnBehalfOf: string | null;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly requestId: string | null;
  readonly causationId: string | null;
  readonly correlationId: string | null;
  readonly idempotencyKey: string | null;
  readonly payload: unknown;
}

export interface OutboxInsertResult {
  /** The stored id: the new one, or the existing one when `idempotencyKey` already existed. */
  readonly id: string;
  /** `occurred_at` as the database assigned it, ISO-8601 UTC. */
  readonly occurredAt: string;
  /** `true` when the unique partial index turned the insert into a no-op. */
  readonly deduplicated: boolean;
}

/** The port `@paperos/db` implements. One per process. */
export interface OutboxDriver {
  readonly name: string;
  /** `false` for a connection-level handle: what makes `publish(db, ...)` fail loudly. paperos-allow-publish-handle */
  isTransaction(handle: unknown): boolean;
  insert(tx: Tx, row: OutboxEventRow): Promise<OutboxInsertResult>;
}

export class NoOutboxDriverError extends Error {
  override readonly name = 'NoOutboxDriverError';
  constructor() {
    super(
      'no outbox driver registered — call installOutboxDriver() from @paperos/db at boot, or use collectEvents() from @paperos/core/events/testing in a test',
    );
  }
}

export class NotInTransactionError extends Error {
  override readonly name = 'NotInTransactionError';
  constructor(readonly topic: string) {
    super(
      `publish('${topic}') was given a connection handle, not a transaction — wrap the row change and the publish in db.transaction(async (tx) => ...) (or withTenant) so they commit together`,
    );
  }
}

export class TopicVersionMismatchError extends Error {
  override readonly name = 'TopicVersionMismatchError';
  constructor(topic: string, asked: number, registered: number) {
    super(
      `publish('${topic}') asked for version ${asked} but the registry holds version ${registered}; upcasting between versions lands with PAP-436`,
    );
  }
}

let driver: OutboxDriver | undefined;

export function setOutboxDriver(next: OutboxDriver | undefined): void {
  driver = next;
}

export function getOutboxDriver(): OutboxDriver {
  if (driver === undefined) throw new NoOutboxDriverError();
  return driver;
}

export function hasOutboxDriver(): boolean {
  return driver !== undefined;
}

/** What a producer passes: the envelope minus `id` and `occurredAt`, plus the typed payload. */
export type PublishInput<T extends TopicName> = PublishInputBase & {
  readonly topic: T;
  readonly payload: TopicPayload<T>;
};

/**
 * Write one event to the outbox inside the caller's transaction.
 *
 * ```ts
 * await db.transaction(async (tx) => {
 *   const [invoice] = await tx.update(invoiceTable).set({ status: 'paid' }).returning();
 *   await publish(tx, {
 *     topic: 'invoice.paid',
 *     tenantId, actor, subject: { type: 'invoice', id: invoice.id },
 *     payload: { invoiceId: invoice.id, amountMinor: '19900', currency: 'USD', paidAt },
 *   });
 * });
 * ```
 */
export async function publish<T extends TopicName>(
  tx: Tx,
  input: PublishInput<T>,
): Promise<DomainEvent<TopicMap[T]>> {
  const topic = requireTopic(input.topic);
  const activeDriver = getOutboxDriver();

  if (!activeDriver.isTransaction(tx)) throw new NotInTransactionError(input.topic);

  const version = input.version ?? topic.version;
  if (version !== topic.version) {
    throw new TopicVersionMismatchError(input.topic, version, topic.version);
  }

  const payload = topic.schema.parse(input.payload) as TopicMap[T];
  const meta = publishInputBaseSchema.parse({
    tenantId: input.tenantId,
    actor: input.actor,
    subject: input.subject,
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
    ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
    ...(input.id === undefined ? {} : { id: input.id }),
    version,
  });

  const id = meta.id ?? uuidv7();
  const row: OutboxEventRow = {
    id,
    tenantId: meta.tenantId,
    topic: topic.name,
    version,
    actorId: meta.actor.id,
    actorKind: meta.actor.type,
    actorCharacter: meta.actor.character ?? null,
    actorOnBehalfOf: meta.actor.onBehalfOf ?? null,
    subjectType: meta.subject.type,
    subjectId: meta.subject.id,
    requestId: meta.requestId ?? null,
    causationId: meta.causationId ?? null,
    correlationId: meta.correlationId ?? null,
    idempotencyKey: meta.idempotencyKey ?? null,
    payload,
  };

  const stored = await activeDriver.insert(tx, row);

  const event: DomainEvent<TopicMap[T]> = Object.freeze({
    id: stored.id,
    topic: topic.name,
    version,
    occurredAt: stored.occurredAt,
    tenantId: meta.tenantId,
    actor: meta.actor,
    subject: meta.subject,
    ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
    ...(meta.causationId === undefined ? {} : { causationId: meta.causationId }),
    ...(meta.correlationId === undefined ? {} : { correlationId: meta.correlationId }),
    ...(meta.idempotencyKey === undefined ? {} : { idempotencyKey: meta.idempotencyKey }),
    payload,
  });

  if (!stored.deduplicated) enqueuePending(tx, event as DomainEvent);
  return event;
}
