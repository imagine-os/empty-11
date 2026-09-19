/**
 * Mirror the in-process subscribers registered with `on()` into `event_subscription`, so the
 * dispatcher (PAP-556) and the admin UI can see what is listening without reading the code.
 * Called once at boot, after every module has imported its handlers.
 */
import { subscriptions } from '@paperos/core/events';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { eventSubscription } from './schema/events.js';

type SubscriptionInsert = typeof eventSubscription.$inferInsert;

interface SubscriptionDbLike {
  insert(table: typeof eventSubscription): {
    values(rows: SubscriptionInsert[]): {
      onConflictDoUpdate(config: {
        target: typeof eventSubscription.name;
        set: Record<string, SQL | unknown>;
      }): Promise<unknown>;
    };
  };
}

/** Upsert one row per in-process subscriber. Returns how many rows were written. */
export async function syncEventSubscriptions(db: object): Promise<number> {
  const rows: SubscriptionInsert[] = subscriptions().map((subscription) => ({
    name: subscription.name,
    topics: [...subscription.topics],
    kind: subscription.kind,
    config: subscription.description === undefined ? {} : { description: subscription.description },
    active: true,
  }));
  if (rows.length === 0) return 0;

  await (db as unknown as SubscriptionDbLike)
    .insert(eventSubscription)
    .values(rows)
    .onConflictDoUpdate({
      target: eventSubscription.name,
      set: {
        topics: sql`excluded.topics`,
        kind: sql`excluded.kind`,
        config: sql`excluded.config`,
        active: sql`excluded.active`,
        updatedAt: sql`now()`,
      },
    });
  return rows.length;
}
