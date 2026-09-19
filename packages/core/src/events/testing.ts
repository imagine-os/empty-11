/**
 * Vitest helpers: `collectEvents(fn)` and `expectEvent(topic, matcher)`.
 *
 * They install an in-memory outbox driver, so a unit test asserts on what a service *published*
 * without a database. The envelope, the topic registry, the PII guard and the 64 KB limit all run
 * exactly as they do in production — only the insert is faked.
 *
 * ```ts
 * const events = await collectEvents(async (tx) => { await payInvoice(tx, invoiceId); });
 * expectEvent('invoice.paid', (e) => e.payload.invoiceId === invoiceId);
 * expect(events).toHaveLength(1);
 * ```
 */
import type { DomainEvent } from './envelope.js';
import type { OutboxDriver, OutboxEventRow, OutboxInsertResult, Tx } from './publish.js';
import { getOutboxDriver, hasOutboxDriver, setOutboxDriver } from './publish.js';
import type { TopicMap, TopicName } from './registry.js';
import { drainInProcess, pendingEvents } from './subscribe.js';

/** A fake transaction handle. `isTransaction()` accepts it; a bare `{}` is not accepted. */
export interface TestTransaction {
  readonly __paperosTestTransaction: true;
  readonly id: string;
}

let counter = 0;

export function createTestTransaction(): TestTransaction {
  counter += 1;
  return Object.freeze({ __paperosTestTransaction: true as const, id: `test-tx-${counter}` });
}

export interface MemoryOutboxDriver extends OutboxDriver {
  readonly rows: readonly OutboxEventRow[];
  clear(): void;
}

/**
 * In-memory driver. Reproduces the two behaviours a test can depend on: `occurred_at` comes from
 * the store, not the caller, and a repeated `(tenantId, idempotencyKey)` is a no-op that returns
 * the original id.
 */
export function memoryOutboxDriver(clock: () => Date = () => new Date()): MemoryOutboxDriver {
  const rows: OutboxEventRow[] = [];
  const occurredAt = new Map<string, string>();
  const byIdempotency = new Map<string, string>();

  return {
    name: 'memory',
    rows,
    isTransaction(handle: unknown): boolean {
      return (
        typeof handle === 'object' &&
        handle !== null &&
        (handle as { __paperosTestTransaction?: unknown }).__paperosTestTransaction === true
      );
    },
    async insert(_tx: Tx, row: OutboxEventRow): Promise<OutboxInsertResult> {
      const key =
        row.idempotencyKey === null
          ? undefined
          : `${row.tenantId ?? 'platform'}:${row.idempotencyKey}`;
      if (key !== undefined) {
        const seen = byIdempotency.get(key);
        if (seen !== undefined) {
          return {
            id: seen,
            occurredAt: occurredAt.get(seen) ?? clock().toISOString(),
            deduplicated: true,
          };
        }
        byIdempotency.set(key, row.id);
      }
      const stamp = clock().toISOString();
      occurredAt.set(row.id, stamp);
      rows.push(row);
      return { id: row.id, occurredAt: stamp, deduplicated: false };
    },
    clear(): void {
      rows.length = 0;
      occurredAt.clear();
      byIdempotency.clear();
    },
  };
}

export interface CollectOptions {
  /** Deliver to in-process subscribers after `fn` resolves, as a commit would. Default `false`. */
  readonly drain?: boolean;
  readonly clock?: () => Date;
}

let lastCollected: readonly DomainEvent[] = [];

/**
 * Run `fn` with a fake transaction and return every event it published, in order.
 * The events are also remembered for the bare `expectEvent(topic, matcher)` form.
 */
export async function collectEvents(
  fn: (tx: TestTransaction) => unknown,
  options: CollectOptions = {},
): Promise<DomainEvent[]> {
  const previous = hasOutboxDriver() ? getOutboxDriver() : undefined;
  const driver = memoryOutboxDriver(options.clock ?? (() => new Date()));
  setOutboxDriver(driver);
  const tx = createTestTransaction();
  try {
    await fn(tx);
    const collected = [...pendingEvents(tx)];
    if (options.drain === true) await drainInProcess(tx);
    lastCollected = collected;
    return collected;
  } finally {
    setOutboxDriver(previous);
  }
}

export class EventAssertionError extends Error {
  override readonly name = 'EventAssertionError';
}

function search<T extends TopicName>(
  events: readonly DomainEvent[],
  topic: T,
  matcher?: (event: DomainEvent<TopicMap[T]>) => boolean,
): DomainEvent<TopicMap[T]> | undefined {
  return events.find(
    (event): event is DomainEvent<TopicMap[T]> =>
      event.topic === topic &&
      (matcher === undefined || matcher(event as DomainEvent<TopicMap[T]>)),
  );
}

/**
 * Assert that the last `collectEvents()` run published `topic` (optionally matching `matcher`)
 * and return that event. Pass an explicit list with `expectEventIn(events, ...)`.
 */
export function expectEvent<T extends TopicName>(
  topic: T,
  matcher?: (event: DomainEvent<TopicMap[T]>) => boolean,
): DomainEvent<TopicMap[T]> {
  return expectEventIn(lastCollected, topic, matcher);
}

export function expectEventIn<T extends TopicName>(
  events: readonly DomainEvent[],
  topic: T,
  matcher?: (event: DomainEvent<TopicMap[T]>) => boolean,
): DomainEvent<TopicMap[T]> {
  const found = search(events, topic, matcher);
  if (found !== undefined) return found;
  const seen =
    events.length === 0 ? 'nothing was published' : events.map((e) => e.topic).join(', ');
  throw new EventAssertionError(
    `expected an event on '${topic}'${matcher === undefined ? '' : ' matching the predicate'}, but ${seen}`,
  );
}

/** Assert that no event on `topic` was published by the last `collectEvents()` run. */
export function expectNoEvent(topic: TopicName): void {
  const found = lastCollected.find((event) => event.topic === topic);
  if (found !== undefined) {
    throw new EventAssertionError(`expected no '${topic}' event, but ${found.id} was published`);
  }
}

/** The events the last `collectEvents()` run captured. */
export function collectedEvents(): readonly DomainEvent[] {
  return lastCollected;
}

export function resetCollectedEvents(): void {
  lastCollected = [];
}
