/**
 * An in-process Postgres for tests and `examples/events.ts`.
 *
 * PGlite is real Postgres compiled to WASM, so range partitioning, partial unique indexes,
 * `jsonb` and transaction rollback all behave exactly as they do on the PAP-42 stack — without a
 * container. When PAP-42's compose stack is up, point the same tests at it by swapping the
 * driver; the schema and the assertions do not change.
 */
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { installOutboxDriver, uninstallOutboxDriver } from '../outbox-driver.js';
import { eventsSchemaSql } from '../schema/events.js';

/**
 * A stand-in for a business table, so a test can prove that a row change and its event commit
 * or roll back together. Not part of the production schema.
 */
export const demoInvoice = pgTable('demo_invoice', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  status: text('status').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

const DEMO_DDL = `
create table if not exists demo_invoice (
  id uuid primary key,
  tenant_id uuid not null,
  status text not null,
  updated_at timestamptz not null default now()
);
`.trim();

export interface EventsTestDb {
  readonly client: PGlite;
  readonly db: ReturnType<typeof drizzle>;
  /** Raw SQL escape hatch for assertions the query builder cannot express. */
  query<T>(statement: string): Promise<T[]>;
  close(): Promise<void>;
}

/**
 * Boot PGlite, apply the events schema plus the demo table, and register the Drizzle outbox
 * driver so `publish(tx, ...)` works.
 */
export async function createEventsTestDb(now: Date = new Date()): Promise<EventsTestDb> {
  const client = new PGlite();
  await client.exec(eventsSchemaSql(now));
  await client.exec(DEMO_DDL);
  const db = drizzle(client);
  installOutboxDriver();

  return {
    client,
    db,
    async query<T>(statement: string): Promise<T[]> {
      const result = await client.query<T>(statement);
      return result.rows;
    },
    async close(): Promise<void> {
      uninstallOutboxDriver();
      await client.close();
    },
  };
}

export { sql };
