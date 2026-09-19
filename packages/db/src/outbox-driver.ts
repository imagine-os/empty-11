/**
 * The Drizzle implementation of the `OutboxDriver` port that `@paperos/core/events` publishes
 * through. This is the only file in the platform that knows both the envelope and Drizzle:
 * `@paperos/core` stays pure TypeScript with no database dependency (packages/core/README.md).
 */
import type { OutboxDriver, OutboxEventRow, OutboxInsertResult, Tx } from '@paperos/core/events';
import { setOutboxDriver } from '@paperos/core/events';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { OutboxEventRowInsert } from './schema/events.js';
import { outboxEvent } from './schema/events.js';

type IdRow = { id: string; occurredAt: Date };
type IdColumns = { id: typeof outboxEvent.id; occurredAt: typeof outboxEvent.occurredAt };

/**
 * The slice of a Drizzle transaction the driver uses. Declared structurally so the driver works
 * with every Postgres driver Drizzle supports (node-postgres, PGlite, postgres.js) without
 * naming their generic parameters.
 */
interface OutboxTxLike {
  insert(table: typeof outboxEvent): {
    values(row: OutboxEventRowInsert): {
      onConflictDoNothing(): { returning(columns: IdColumns): Promise<IdRow[]> };
    };
  };
  select(columns: IdColumns): {
    from(table: typeof outboxEvent): {
      where(condition: SQL | undefined): { limit(count: number): Promise<IdRow[]> };
    };
  };
}

const ID_COLUMNS: IdColumns = { id: outboxEvent.id, occurredAt: outboxEvent.occurredAt };

/**
 * A Drizzle transaction handle carries `rollback()`; the connection-level `db` handle does not.
 * That one difference turns `publish(db, ...)` into a loud `NotInTransactionError` (paperos-allow-publish-handle)
 * instead of an event that outlives a rolled-back row change.
 */
export function isDrizzleTransaction(handle: unknown): boolean {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    typeof (handle as { rollback?: unknown }).rollback === 'function' &&
    typeof (handle as { insert?: unknown }).insert === 'function'
  );
}

export const drizzleOutboxDriver: OutboxDriver = {
  name: 'drizzle-postgres',

  isTransaction: isDrizzleTransaction,

  async insert(tx: Tx, row: OutboxEventRow): Promise<OutboxInsertResult> {
    const handle = tx as unknown as OutboxTxLike;
    // `occurred_at` is deliberately absent: the column default is the database `now()`, so the
    // timestamp never comes from a process clock (Contracts section 3, clock skew edge case).
    const values: OutboxEventRowInsert = {
      id: row.id,
      tenantId: row.tenantId,
      topic: row.topic,
      version: row.version,
      actorId: row.actorId,
      actorKind: row.actorKind,
      actorCharacter: row.actorCharacter,
      actorOnBehalfOf: row.actorOnBehalfOf,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      requestId: row.requestId,
      causationId: row.causationId,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      payload: row.payload,
    };

    const inserted = await handle
      .insert(outboxEvent)
      .values(values)
      .onConflictDoNothing()
      .returning(ID_COLUMNS);
    const fresh = inserted[0];
    if (fresh !== undefined) {
      return { id: fresh.id, occurredAt: fresh.occurredAt.toISOString(), deduplicated: false };
    }

    // The unique partial index on (tenant_id, idempotency_key) turned the insert into a no-op:
    // return the id of the event that won, so the caller's retry is a true no-op.
    // A null tenant_id does not dedupe: the partial unique index treats NULLs as distinct, and
    // the idempotency rule is per tenant (Contracts section 4). ADR 0013 records the exposure.
    const condition: SQL | undefined =
      row.idempotencyKey === null
        ? eq(outboxEvent.id, row.id)
        : and(
            row.tenantId === null
              ? isNull(outboxEvent.tenantId)
              : eq(outboxEvent.tenantId, row.tenantId),
            eq(outboxEvent.idempotencyKey, row.idempotencyKey),
          );

    const existing = await handle.select(ID_COLUMNS).from(outboxEvent).where(condition).limit(1);
    const found = existing[0];
    if (found === undefined) {
      throw new Error(
        `outbox insert for '${row.topic}' conflicted but no existing row matched (id ${row.id}, idempotencyKey ${row.idempotencyKey ?? 'null'})`,
      );
    }
    return { id: found.id, occurredAt: found.occurredAt.toISOString(), deduplicated: true };
  },
};

/** Call once at boot, before anything publishes. */
export function installOutboxDriver(): void {
  setOutboxDriver(drizzleOutboxDriver);
}

/** Test teardown: unregister the driver so a unit test falls back to `collectEvents()`. */
export function uninstallOutboxDriver(): void {
  setOutboxDriver(undefined);
}
