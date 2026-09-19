import { describe, expect, it } from 'vitest';
import {
  createMonthlyPartitionSql,
  eventSubscription,
  eventsSchemaSql,
  expiredPartitions,
  monthlyPartition,
  monthlyPartitions,
  OUTBOX_RETENTION_DAYS,
  outboxEvent,
  retentionCutoff,
} from './events.js';

describe('monthly partition arithmetic', () => {
  it('names a partition after its month in UTC', () => {
    const partition = monthlyPartition('outbox_event', new Date('2026-09-19T23:59:59.999Z'));
    expect(partition.name).toBe('outbox_event_2026_09');
    expect(partition.from).toBe('2026-09-01T00:00:00.000Z');
    expect(partition.to).toBe('2026-10-01T00:00:00.000Z');
  });

  it('rolls the year over from December', () => {
    const december = monthlyPartition('outbox_event', new Date('2026-12-31T12:00:00.000Z'));
    expect(december.name).toBe('outbox_event_2026_12');
    expect(december.to).toBe('2027-01-01T00:00:00.000Z');
    expect(monthlyPartition('outbox_event', new Date(december.to)).name).toBe(
      'outbox_event_2027_01',
    );
  });

  it('zero-pads single-digit months', () => {
    expect(monthlyPartition('outbox_event', new Date('2027-01-05T00:00:00Z')).name).toBe(
      'outbox_event_2027_01',
    );
  });

  it('is exclusive at the upper bound, so no timestamp lands in two partitions', () => {
    const [first, second] = monthlyPartitions('outbox_event', new Date('2026-11-14T00:00:00Z'), 2);
    expect(first?.to).toBe(second?.from);
  });

  it('produces consecutive months across a year boundary', () => {
    const names = monthlyPartitions('outbox_event', new Date('2026-11-20T00:00:00Z'), 4).map(
      (p) => p.name,
    );
    expect(names).toEqual([
      'outbox_event_2026_11',
      'outbox_event_2026_12',
      'outbox_event_2027_01',
      'outbox_event_2027_02',
    ]);
  });

  it('emits a partition with a local idempotency index', () => {
    const sql = createMonthlyPartitionSql(
      'outbox_event',
      monthlyPartition('outbox_event', new Date('2026-09-01T00:00:00Z')),
    );
    expect(sql).toContain('partition of outbox_event');
    expect(sql).toContain('outbox_event_2026_09_idempotency_uq');
    expect(sql).toContain('where idempotency_key is not null');
  });
});

describe('retention', () => {
  it('defaults to 90 days', () => {
    expect(OUTBOX_RETENTION_DAYS).toBe(90);
    expect(retentionCutoff(new Date('2026-09-19T00:00:00Z')).toISOString()).toBe(
      '2026-06-21T00:00:00.000Z',
    );
  });

  it('lists only partitions that are entirely past the cutoff', () => {
    const expired = expiredPartitions(
      'outbox_event',
      new Date('2026-09-19T00:00:00Z'),
      new Date('2026-01-10T00:00:00Z'),
    ).map((p) => p.name);
    expect(expired).toEqual([
      'outbox_event_2026_01',
      'outbox_event_2026_02',
      'outbox_event_2026_03',
      'outbox_event_2026_04',
      'outbox_event_2026_05',
    ]);
  });
});

describe('events schema DDL', () => {
  const ddl = eventsSchemaSql(new Date('2026-09-19T00:00:00Z'));

  it('partitions outbox_event by range on occurred_at', () => {
    expect(ddl).toContain('partition by range (occurred_at)');
    expect(ddl).toContain('primary key (id, occurred_at)');
  });

  it('creates the month before, the current month and the month after', () => {
    expect(ddl).toContain('outbox_event_2026_08');
    expect(ddl).toContain('outbox_event_2026_09');
    expect(ddl).toContain('outbox_event_2026_10');
  });

  it('defaults occurred_at to the database clock', () => {
    expect(ddl).toContain('occurred_at timestamptz not null default now()');
  });

  it('constrains the subscription kinds', () => {
    expect(ddl).toContain("kind in ('inproc', 'job', 'webhook', 'live')");
  });

  it('declares every Drizzle column', () => {
    const columnNames = (table: object): string[] =>
      Object.values(table)
        .filter(
          (value): value is { name: string } =>
            typeof value === 'object' &&
            value !== null &&
            typeof (value as { name?: unknown }).name === 'string' &&
            typeof (value as { columnType?: unknown }).columnType === 'string',
        )
        .map((column) => column.name);

    const names = [...columnNames(outboxEvent), ...columnNames(eventSubscription)];
    expect(names.length).toBeGreaterThan(20);
    for (const name of names) expect(ddl, name).toContain(name);
  });
});
