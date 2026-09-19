/**
 * In-process subscriptions: `on()` registers a handler at boot, `drainInProcess(tx)` delivers the
 * events a transaction published once that transaction has committed.
 *
 * This is the interim delivery path. The real dispatcher — the `events.dispatch` job polling
 * `outbox_event where published_at is null` with `FOR UPDATE SKIP LOCKED`, fanning out to jobs,
 * live events, tenant webhooks and the orchestrator — is the sibling issue PAP-556. Until it
 * merges, `drainInProcess(tx)` gives dev and tests the same at-least-once, idempotent-handler
 * contract on a much smaller surface. Nothing a subscriber sees changes when the dispatcher
 * lands: the handler signature and the `event.id` idempotency rule are the contract.
 */
import type { DomainEvent } from './envelope.js';
import type { TopicMap, TopicName } from './registry.js';
import { requireTopic } from './registry.js';

export type SubscriptionKind = 'inproc' | 'job' | 'webhook' | 'live';

export type EventHandler<P = unknown> = (event: DomainEvent<P>) => void | Promise<void>;

export interface SubscriptionOptions {
  /** Stable name; it is the `event_subscription` primary key and the dead-letter label. */
  readonly name: string;
  /**
   * Delivery is at-least-once, so a handler must be idempotent on `event.id`. Declaring it is
   * how a subscriber acknowledges the contract — there is no `false`.
   */
  readonly idempotent: true;
  readonly description?: string;
}

export interface Subscription {
  readonly name: string;
  readonly topics: readonly string[];
  readonly kind: SubscriptionKind;
  readonly description: string | undefined;
  readonly handler: EventHandler;
  /** Remove this subscription. */
  readonly off: () => void;
}

export class SubscriptionError extends Error {
  override readonly name = 'SubscriptionError';
}

const subscribers = new Map<string, Subscription>();

/**
 * Register an in-process subscriber. The payload type comes from the topic registry:
 * `on('invoice.paid', (e) => e.payload.invoiceId)` type-checks without an annotation.
 */
export function on<T extends TopicName>(
  topic: T | readonly T[],
  handler: EventHandler<TopicMap[T]>,
  options: SubscriptionOptions,
): Subscription {
  const names = (Array.isArray(topic) ? topic : [topic]) as readonly string[];
  if (names.length === 0) throw new SubscriptionError('on() needs at least one topic');
  for (const name of names) requireTopic(name);

  const existing = subscribers.get(options.name);
  if (existing !== undefined) {
    throw new SubscriptionError(
      `subscription '${options.name}' is already registered for ${existing.topics.join(', ')}`,
    );
  }

  const subscription: Subscription = {
    name: options.name,
    topics: Object.freeze([...names]),
    kind: 'inproc',
    description: options.description,
    handler: handler as EventHandler,
    off: () => {
      subscribers.delete(options.name);
    },
  };
  subscribers.set(options.name, subscription);
  return subscription;
}

export function off(name: string): boolean {
  return subscribers.delete(name);
}

/** Every in-process subscription, for `event_subscription` sync and the catalogue doc. */
export function subscriptions(): readonly Subscription[] {
  return [...subscribers.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function resetSubscriptionsForTests(): void {
  subscribers.clear();
  pending = new WeakMap();
  delivered.clear();
  deliveredOrder.length = 0;
}

/* ------------------------------------------------------------------ pending queue */

/**
 * Events published on a transaction and not yet drained, keyed **weakly** by the transaction
 * handle. A transaction that rolls back, or one that is never drained because the dispatcher
 * (PAP-556) owns delivery, releases its events together with the handle instead of pinning them
 * in this process for its lifetime.
 */
let pending = new WeakMap<object, DomainEvent[]>();

function assertTransactionHandle(tx: unknown, caller: string): asserts tx is object {
  if (typeof tx !== 'object' || tx === null) {
    throw new TypeError(
      `${caller}(tx) needs the transaction handle the events were published on; there is no "every transaction" form because it would deliver events whose transaction rolled back`,
    );
  }
}
const delivered = new Set<string>();
const deliveredOrder: string[] = [];
const DELIVERED_MEMORY = 10_000;

/** Called by `publish()`. Not part of the public surface. */
export function enqueuePending(tx: object, event: DomainEvent): void {
  const queue = pending.get(tx);
  if (queue === undefined) pending.set(tx, [event]);
  else queue.push(event);
}

/** Events published on `tx` that have not been delivered yet. */
export function pendingEvents(tx: object): readonly DomainEvent[] {
  assertTransactionHandle(tx, 'pendingEvents');
  return pending.get(tx) ?? [];
}

export interface DrainFailure {
  readonly subscription: string;
  readonly eventId: string;
  readonly topic: string;
  readonly error: unknown;
}

export interface DrainResult {
  readonly events: number;
  readonly delivered: number;
  /** Deliveries skipped because this subscription already saw this `event.id`. */
  readonly skipped: number;
  readonly failures: readonly DrainFailure[];
}

function remember(key: string): void {
  delivered.add(key);
  deliveredOrder.push(key);
  while (deliveredOrder.length > DELIVERED_MEMORY) {
    const oldest = deliveredOrder.shift();
    if (oldest !== undefined) delivered.delete(oldest);
  }
}

/**
 * Deliver the events published on `tx` to the in-process subscribers — **after the transaction
 * has committed**, never inside it. The handle is required: only the caller knows that `tx`
 * committed, so there is deliberately no "drain everything" form.
 *
 * A handler that throws does not stop the others: the failure is returned so the caller can log
 * it. Under the real dispatcher the same event is retried with backoff and then dead-lettered.
 */
export async function drainInProcess(tx: object): Promise<DrainResult> {
  assertTransactionHandle(tx, 'drainInProcess');
  const batch: DomainEvent[] = [...(pending.get(tx) ?? [])];
  pending.delete(tx);

  let deliveredCount = 0;
  let skipped = 0;
  const failures: DrainFailure[] = [];

  for (const event of batch) {
    for (const subscription of subscribers.values()) {
      if (!subscription.topics.includes(event.topic)) continue;
      const key = `${subscription.name}:${event.id}`;
      if (delivered.has(key)) {
        skipped += 1;
        continue;
      }
      try {
        await subscription.handler(event);
        remember(key);
        deliveredCount += 1;
      } catch (error) {
        failures.push({
          subscription: subscription.name,
          eventId: event.id,
          topic: event.topic,
          error,
        });
      }
    }
  }

  return { events: batch.length, delivered: deliveredCount, skipped, failures };
}
