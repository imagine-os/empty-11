/**
 * The transactional-outbox guarantee, on a real Postgres (PGlite in process):
 * **the row change and its event commit together, or neither does.**
 *
 * This is the test the whole design exists for. Everything else — the registry, the envelope, the
 * PII guard — is a contract; this is the invariant.
 */
import {
  drainInProcess,
  on,
  publish,
  resetSubscriptionsForTests,
  uuidv7,
} from '@paperos/core/events';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drizzleOutboxDriver, isDrizzleTransaction } from './outbox-driver.js';
import { outboxEvent } from './schema/events.js';
import { syncEventSubscriptions } from './subscriptions.js';
import type { EventsTestDb } from './testing/pglite.js';
import { createEventsTestDb, demoInvoice } from './testing/pglite.js';

let stack: EventsTestDb;
const tenantId = uuidv7();
const actor = { id: uuidv7(), type: 'agent' as const, character: 'forge' };

function paidPayload(invoiceId: string) {
  return {
    invoiceId,
    customerId: uuidv7(),
    amountMinor: '19900',
    currency: 'USD',
    paidAt: '2026-09-19T10:00:00.000Z',
    paymentId: null,
  };
}

async function countOutbox(): Promise<number> {
  const rows = await stack.query<{ count: string }>(
    'select count(*)::text as count from outbox_event',
  );
  return Number(rows[0]?.count ?? '0');
}

beforeEach(async () => {
  stack = await createEventsTestDb(new Date('2026-09-19T10:00:00Z'));
  resetSubscriptionsForTests();
});

afterEach(async () => {
  resetSubscriptionsForTests();
  await stack.close();
});

describe('publish inside a transaction', () => {
  it('commits the row and the event together', async () => {
    const invoiceId = uuidv7();
    await stack.db.transaction(async (tx) => {
      await tx.insert(demoInvoice).values({ id: invoiceId, tenantId, status: 'paid' });
      await publish(tx, {
        topic: 'invoice.paid',
        tenantId,
        actor,
        subject: { type: 'invoice', id: invoiceId },
        payload: paidPayload(invoiceId),
        requestId: 'req_integration',
      });
    });

    const invoices = await stack.db.select().from(demoInvoice).where(eq(demoInvoice.id, invoiceId));
    expect(invoices).toHaveLength(1);

    const events = await stack.db
      .select()
      .from(outboxEvent)
      .where(eq(outboxEvent.subjectId, invoiceId));
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event?.topic).toBe('invoice.paid');
    expect(event?.publishedAt).toBeNull();
    expect(event?.attempts).toBe(0);
    expect(event?.actorKind).toBe('agent');
    expect(event?.actorCharacter).toBe('forge');
    expect(event?.requestId).toBe('req_integration');
    expect(event?.payload).toMatchObject({ invoiceId, amountMinor: '19900' });
  });

  it('rolls back the row and the event together when the transaction fails after publishing', async () => {
    const invoiceId = uuidv7();
    await expect(
      stack.db.transaction(async (tx) => {
        await tx.insert(demoInvoice).values({ id: invoiceId, tenantId, status: 'paid' });
        await publish(tx, {
          topic: 'invoice.paid',
          tenantId,
          actor,
          subject: { type: 'invoice', id: invoiceId },
          payload: paidPayload(invoiceId),
        });
        // The forced failure the spec asks for: anything after the publish can still fail.
        throw new Error('ledger posting failed');
      }),
    ).rejects.toThrow('ledger posting failed');

    expect(await stack.db.select().from(demoInvoice)).toHaveLength(0);
    expect(await countOutbox()).toBe(0);
  });

  it('takes occurredAt from the database, not the process clock', async () => {
    const invoiceId = uuidv7();
    const before = Date.now();
    const event = await stack.db.transaction(async (tx) =>
      publish(tx, {
        topic: 'invoice.paid',
        tenantId,
        actor,
        subject: { type: 'invoice', id: invoiceId },
        payload: paidPayload(invoiceId),
      }),
    );
    const stored = await stack.query<{ occurred_at: Date }>(
      `select occurred_at from outbox_event where id = '${event.id}'`,
    );
    expect(new Date(event.occurredAt).getTime()).toBe(
      new Date(stored[0]?.occurred_at ?? 0).getTime(),
    );
    expect(new Date(event.occurredAt).getTime()).toBeGreaterThanOrEqual(before - 60_000);
  });

  it('lands the row in the monthly partition for its occurred_at', async () => {
    const invoiceId = uuidv7();
    await stack.db.transaction(async (tx) =>
      publish(tx, {
        topic: 'invoice.paid',
        tenantId,
        actor,
        subject: { type: 'invoice', id: invoiceId },
        payload: paidPayload(invoiceId),
      }),
    );
    const rows = await stack.query<{ relname: string }>(
      'select tableoid::regclass::text as relname from outbox_event',
    );
    expect(rows[0]?.relname).toMatch(/^outbox_event_\d{4}_\d{2}$/);
  });

  it('makes a repeated idempotencyKey a no-op that returns the original id', async () => {
    const invoiceId = uuidv7();
    const publishOnce = async () =>
      stack.db.transaction(async (tx) =>
        publish(tx, {
          topic: 'invoice.paid',
          tenantId,
          actor,
          subject: { type: 'invoice', id: invoiceId },
          payload: paidPayload(invoiceId),
          idempotencyKey: `invoice-paid-${invoiceId}`,
        }),
      );

    const first = await publishOnce();
    const second = await publishOnce();
    expect(second.id).toBe(first.id);
    expect(await countOutbox()).toBe(1);
  });

  it('refuses the connection handle', async () => {
    expect(isDrizzleTransaction(stack.db)).toBe(false);
    await expect(
      publish(stack.db, {
        topic: 'invoice.paid',
        tenantId,
        actor,
        subject: { type: 'invoice', id: uuidv7() },
        payload: paidPayload(uuidv7()),
      }),
    ).rejects.toThrow(/transaction/);
    expect(await countOutbox()).toBe(0);
  });

  it('delivers to in-process subscribers after the transaction commits', async () => {
    const seen: string[] = [];
    on('invoice.paid', (event) => void seen.push(event.payload.invoiceId), {
      name: 'billing.receipt',
      idempotent: true,
      description: 'sends the receipt',
    });

    const invoiceId = uuidv7();
    const tx = await stack.db.transaction(async (handle) => {
      await handle.insert(demoInvoice).values({ id: invoiceId, tenantId, status: 'paid' });
      await publish(handle, {
        topic: 'invoice.paid',
        tenantId,
        actor,
        subject: { type: 'invoice', id: invoiceId },
        payload: paidPayload(invoiceId),
      });
      expect(seen).toEqual([]); // nothing is delivered inside the transaction
      return handle;
    });

    const result = await drainInProcess(tx);
    expect(result).toMatchObject({ events: 1, delivered: 1, failures: [] });
    expect(seen).toEqual([invoiceId]);
  });

  it('mirrors in-process subscribers into event_subscription', async () => {
    on('invoice.paid', () => undefined, {
      name: 'billing.receipt',
      idempotent: true,
      description: 'sends the receipt',
    });
    on(['invoice.voided', 'payment.refunded'], () => undefined, {
      name: 'ledger.reversals',
      idempotent: true,
    });

    expect(await syncEventSubscriptions(stack.db)).toBe(2);
    const rows = await stack.query<{ name: string; kind: string; topics: string[] }>(
      'select name, kind, topics from event_subscription order by name',
    );
    expect(rows.map((r) => r.name)).toEqual(['billing.receipt', 'ledger.reversals']);
    expect(rows.every((r) => r.kind === 'inproc')).toBe(true);

    // Idempotent: a second boot updates in place.
    expect(await syncEventSubscriptions(stack.db)).toBe(2);
    const after = await stack.query<{ count: string }>(
      'select count(*)::text as count from event_subscription',
    );
    expect(after[0]?.count).toBe('2');
  });

  it('rejects a payload over 64 KB before it reaches the database', async () => {
    await expect(
      stack.db.transaction(async (tx) =>
        publish(tx, {
          topic: 'comment.created',
          tenantId,
          actor,
          subject: { type: 'comment', id: uuidv7() },
          payload: {
            threadId: uuidv7(),
            commentId: uuidv7(),
            anchorKey: 'x'.repeat(64 * 1024 + 10),
            authorKind: 'human',
          },
        }),
      ),
    ).rejects.toThrow();
    expect(await countOutbox()).toBe(0);
  });

  it('uses the driver the core package publishes through', async () => {
    expect(drizzleOutboxDriver.name).toBe('drizzle-postgres');
    const rows = await stack.query<{ count: string }>(
      `select count(*)::text as count from pg_class where relname like 'outbox_event_%'`,
    );
    expect(Number(rows[0]?.count ?? '0')).toBeGreaterThanOrEqual(3);
  });

  it('keeps the parent table empty of direct writes outside a partition range', async () => {
    await expect(
      stack.client.exec(
        `insert into outbox_event (id, topic, actor_id, actor_kind, subject_type, subject_id, payload, occurred_at)
         values ('${uuidv7()}', 'invoice.paid', '${actor.id}', 'agent', 'invoice', '${uuidv7()}', '{}'::jsonb, '2000-01-01T00:00:00Z')`,
      ),
    ).rejects.toThrow();
  });

  it('counts rows through the partitioned parent', async () => {
    await stack.db.transaction(async (tx) =>
      publish(tx, {
        topic: 'flags.changed',
        tenantId: null,
        actor,
        subject: { type: 'flag', id: uuidv7() },
        payload: {
          flagKey: 'events.dispatcher',
          scope: 'global',
          scopeId: null,
          enabled: true,
          variant: null,
        },
      }),
    );
    expect(await countOutbox()).toBe(1);
    const platform = await stack.db
      .select({ topic: outboxEvent.topic })
      .from(outboxEvent)
      .where(sql`${outboxEvent.tenantId} is null`);
    expect(platform).toEqual([{ topic: 'flags.changed' }]);
  });
});
