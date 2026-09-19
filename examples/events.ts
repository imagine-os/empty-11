/**
 * The PAP-555 demo, end to end, in one file and under two minutes.
 *
 *   pnpm --filter @paperos/db run events:example
 *   # or, from the repository root:
 *   pnpm dlx tsx examples/events.ts
 *
 * It boots an in-process Postgres (PGlite — real Postgres, WASM), applies the events schema, and
 * shows the three things the contract promises:
 *
 *   1. a row change and its event commit **together**;
 *   2. when anything after the publish fails, **neither** survives;
 *   3. after commit, the in-process subscriber sees the event exactly once.
 *
 * Imports are relative because `examples/` is not a workspace package; the modules they reach
 * resolve their own dependencies from their own package.
 */
import { drainInProcess, on, publish, topics, uuidv7 } from '../packages/core/src/events/index.js';
import { createEventsTestDb, demoInvoice } from '../packages/db/src/testing/pglite.js';

const line = (text = '') => process.stdout.write(`${text}\n`);

async function main(): Promise<void> {
  const stack = await createEventsTestDb();
  const tenantId = uuidv7();
  const actor = { id: uuidv7(), type: 'agent' as const, character: 'forge' };

  line(`registry: ${topics().length} topics (see docs/platform/events.md)`);
  line();

  on(
    'invoice.paid',
    (event) => {
      line(
        `  handler billing.receipt  <- ${event.topic} ${event.id} (${event.payload.amountMinor} ${event.payload.currency})`,
      );
    },
    { name: 'billing.receipt', idempotent: true, description: 'sends the receipt' },
  );

  // 1. Commit: the row and the event land together.
  const invoiceId = uuidv7();
  const tx = await stack.db.transaction(async (handle) => {
    await handle.insert(demoInvoice).values({ id: invoiceId, tenantId, status: 'paid' });
    const event = await publish(handle, {
      topic: 'invoice.paid',
      tenantId,
      actor,
      subject: { type: 'invoice', id: invoiceId },
      payload: {
        invoiceId,
        customerId: uuidv7(),
        amountMinor: '19900',
        currency: 'USD',
        paidAt: new Date().toISOString(),
        paymentId: null,
      },
      idempotencyKey: `invoice-paid-${invoiceId}`,
    });
    line(`committed: invoice ${invoiceId} paid, event ${event.id} at ${event.occurredAt}`);
    return handle;
  });

  const stored = await stack.query<{
    topic: string;
    published_at: string | null;
    partition: string;
  }>(`select topic, published_at, tableoid::regclass::text as partition from outbox_event`);
  line(
    `outbox:    ${stored.length} row(s) — ${stored.map((r) => `${r.topic} published_at=${r.published_at ?? 'NULL'} in ${r.partition}`).join(', ')}`,
  );

  // 2. Delivery happens after the commit, never inside the transaction.
  line('drain:');
  const drained = await drainInProcess(tx);
  line(
    `  delivered ${drained.delivered}, skipped ${drained.skipped}, failures ${drained.failures.length}`,
  );
  line();

  // 3. Roll back: a failure after the publish takes the event with it.
  const doomedId = uuidv7();
  try {
    await stack.db.transaction(async (handle) => {
      await handle.insert(demoInvoice).values({ id: doomedId, tenantId, status: 'paid' });
      await publish(handle, {
        topic: 'invoice.paid',
        tenantId,
        actor,
        subject: { type: 'invoice', id: doomedId },
        payload: {
          invoiceId: doomedId,
          customerId: uuidv7(),
          amountMinor: '4200',
          currency: 'USD',
          paidAt: new Date().toISOString(),
          paymentId: null,
        },
      });
      throw new Error('ledger posting failed');
    });
  } catch (error) {
    line(`rolled back: ${(error as Error).message}`);
  }

  const rows = await stack.query<{ count: string }>(
    'select count(*)::text as count from demo_invoice',
  );
  const events = await stack.query<{ count: string }>(
    'select count(*)::text as count from outbox_event',
  );
  line(
    `after rollback: ${rows[0]?.count} invoice row(s), ${events[0]?.count} outbox row(s) — both unchanged`,
  );

  // 4. The guard: a connection handle is refused.
  try {
    await publish(stack.db, {
      topic: 'invoice.paid',
      tenantId,
      actor,
      subject: { type: 'invoice', id: uuidv7() },
      payload: {
        invoiceId: uuidv7(),
        customerId: uuidv7(),
        amountMinor: '1',
        currency: 'USD',
        paidAt: new Date().toISOString(),
        paymentId: null,
      },
    });
  } catch (error) {
    line(`guard: ${(error as Error).name}`);
  }

  await stack.close();
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
