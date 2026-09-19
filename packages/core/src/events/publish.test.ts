import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from './envelope.js';
import {
  NoOutboxDriverError,
  NotInTransactionError,
  publish,
  setOutboxDriver,
  TopicVersionMismatchError,
} from './publish.js';
import { uuidv7 } from './refs.js';
import { drainInProcess, on, pendingEvents, resetSubscriptionsForTests } from './subscribe.js';
import './catalogue/index.js';
import {
  collectEvents,
  createTestTransaction,
  expectEvent,
  expectNoEvent,
  memoryOutboxDriver,
} from './testing.js';

const tenantId = uuidv7();
const invoiceId = uuidv7();
const actor = { id: uuidv7(), type: 'human' as const };

function paidInput() {
  return {
    topic: 'invoice.paid' as const,
    tenantId,
    actor,
    subject: { type: 'invoice', id: invoiceId },
    payload: {
      invoiceId,
      customerId: uuidv7(),
      amountMinor: '19900',
      currency: 'USD',
      paidAt: '2026-09-19T10:00:00.000Z',
      paymentId: null,
    },
  };
}

afterEach(() => {
  setOutboxDriver(undefined);
  resetSubscriptionsForTests();
});

describe('publish', () => {
  beforeEach(() => {
    setOutboxDriver(memoryOutboxDriver());
  });

  it('writes an envelope with a database-assigned occurredAt', async () => {
    const tx = createTestTransaction();
    const event = await publish(tx, paidInput());
    expect(event.topic).toBe('invoice.paid');
    expect(event.version).toBe(1);
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(event.occurredAt)).not.toBeNaN();
    expect(event.payload.amountMinor).toBe('19900');
  });

  it('refuses a connection handle instead of a transaction', async () => {
    await expect(publish({ notATransaction: true }, paidInput())).rejects.toBeInstanceOf(
      NotInTransactionError,
    );
  });

  it('refuses an unregistered topic', async () => {
    const tx = createTestTransaction();
    // @ts-expect-error the topic is not in the registry, which is a type error as well
    await expect(publish(tx, { ...paidInput(), topic: 'invoice.hugged' })).rejects.toThrow(
      /not registered/,
    );
  });

  it('refuses a version the registry does not hold', async () => {
    const tx = createTestTransaction();
    await expect(publish(tx, { ...paidInput(), version: 2 })).rejects.toBeInstanceOf(
      TopicVersionMismatchError,
    );
  });

  it('refuses a payload that fails the topic schema', async () => {
    const tx = createTestTransaction();
    await expect(
      publish(tx, { ...paidInput(), payload: { ...paidInput().payload, amountMinor: '1.99' } }),
    ).rejects.toThrow();
  });

  it('returns the original id when the same idempotencyKey is published twice', async () => {
    const tx = createTestTransaction();
    const first = await publish(tx, { ...paidInput(), idempotencyKey: 'invoice-paid-42' });
    const second = await publish(tx, { ...paidInput(), idempotencyKey: 'invoice-paid-42' });
    expect(second.id).toBe(first.id);
  });

  it('takes occurredAt from the store, not the process clock', async () => {
    const fixed = new Date('2026-01-01T00:00:00.000Z');
    setOutboxDriver(memoryOutboxDriver(() => fixed));
    const tx = createTestTransaction();
    vi.setSystemTime(new Date('2030-06-06T06:06:06.000Z'));
    const event = await publish(tx, paidInput());
    vi.useRealTimers();
    expect(event.occurredAt).toBe(fixed.toISOString());
  });
});

describe('publish without a driver', () => {
  it('says how to install one', async () => {
    setOutboxDriver(undefined);
    await expect(publish(createTestTransaction(), paidInput())).rejects.toBeInstanceOf(
      NoOutboxDriverError,
    );
  });
});

describe('collectEvents and expectEvent', () => {
  it('captures what a unit under test published', async () => {
    const events = await collectEvents(async (tx) => {
      await publish(tx, paidInput());
    });
    expect(events).toHaveLength(1);
    const found = expectEvent('invoice.paid', (event) => event.payload.invoiceId === invoiceId);
    expect(found.tenantId).toBe(tenantId);
    expectNoEvent('invoice.voided');
  });

  it('explains what was published when the assertion fails', async () => {
    await collectEvents(async (tx) => {
      await publish(tx, paidInput());
    });
    expect(() => expectEvent('invoice.voided')).toThrow(/invoice\.paid/);
  });

  it('restores the previous driver afterwards', async () => {
    const driver = memoryOutboxDriver();
    setOutboxDriver(driver);
    await collectEvents(async (tx) => {
      await publish(tx, paidInput());
    });
    const tx = createTestTransaction();
    await publish(tx, paidInput());
    expect(driver.rows).toHaveLength(1);
  });

  it('delivers to in-process subscribers when asked to drain', async () => {
    const seen: DomainEvent[] = [];
    on('invoice.paid', (event) => void seen.push(event), {
      name: 'test.receipt',
      idempotent: true,
    });
    await collectEvents(
      async (tx) => {
        await publish(tx, paidInput());
      },
      { drain: true },
    );
    expect(seen).toHaveLength(1);
  });
});

describe('drainInProcess', () => {
  beforeEach(() => {
    setOutboxDriver(memoryOutboxDriver());
  });

  it('delivers each event once per handler', async () => {
    const first = vi.fn();
    const second = vi.fn();
    on('invoice.paid', first, { name: 'a', idempotent: true });
    on('invoice.paid', second, { name: 'b', idempotent: true });
    const tx = createTestTransaction();
    await publish(tx, paidInput());
    const result = await drainInProcess(tx);
    expect(result).toMatchObject({ events: 1, delivered: 2, skipped: 0 });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(await drainInProcess(tx)).toMatchObject({ events: 0, delivered: 0 });
  });

  it('does not deliver to a handler subscribed to another topic', async () => {
    const handler = vi.fn();
    on('invoice.voided', handler, { name: 'voids', idempotent: true });
    const tx = createTestTransaction();
    await publish(tx, paidInput());
    await drainInProcess(tx);
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps going when one handler throws and reports the failure', async () => {
    const good = vi.fn();
    on(
      'invoice.paid',
      () => {
        throw new Error('poison');
      },
      { name: 'bad', idempotent: true },
    );
    on('invoice.paid', good, { name: 'good', idempotent: true });
    const tx = createTestTransaction();
    await publish(tx, paidInput());
    const result = await drainInProcess(tx);
    expect(good).toHaveBeenCalledTimes(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.subscription).toBe('bad');
  });

  it('only drains the transaction it was given', async () => {
    const handler = vi.fn();
    on('invoice.paid', handler, { name: 'scoped', idempotent: true });
    const one = createTestTransaction();
    const two = createTestTransaction();
    await publish(one, paidInput());
    await publish(two, paidInput());
    await drainInProcess(one);
    expect(handler).toHaveBeenCalledTimes(1);
    await drainInProcess(two);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('refuses to drain without the transaction handle', async () => {
    const handler = vi.fn();
    on('invoice.paid', handler, { name: 'guarded', idempotent: true });
    const tx = createTestTransaction();
    await publish(tx, paidInput());
    // @ts-expect-error tx is required: an implicit "every transaction" drain would deliver
    // events whose transaction rolled back
    await expect(drainInProcess()).rejects.toBeInstanceOf(TypeError);
    expect(handler).not.toHaveBeenCalled();
    // The events are still there for the handle that actually committed.
    expect(pendingEvents(tx)).toHaveLength(1);
  });

  it('refuses a duplicate subscription name', () => {
    on('invoice.paid', vi.fn(), { name: 'once', idempotent: true });
    expect(() => on('invoice.paid', vi.fn(), { name: 'once', idempotent: true })).toThrow(
      /already registered/,
    );
  });

  it('refuses a subscription to an unregistered topic', () => {
    // @ts-expect-error not a catalogue topic
    expect(() => on('nope.happened', vi.fn(), { name: 'nope', idempotent: true })).toThrow(
      /not registered/,
    );
  });
});
