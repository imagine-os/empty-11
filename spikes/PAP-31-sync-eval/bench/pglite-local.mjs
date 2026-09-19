/**
 * PAP-31 local-store bench: PGlite as the local database of an Electric+PGlite client.
 * Measures the LOCAL half of the sync loop only (no server, no network, no browser).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let PGlite;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  console.error(
    'This benchmark needs @electric-sql/pglite. Run `npm install` in spikes/PAP-31-sync-eval first.',
  );
  process.exit(1);
}

const TENANTS = 5;
const ROWS = 10_000; // total rows in the table
const SHAPE_ROWS = 2_000; // rows of the tenant-scoped shape we "initially sync"
const INCREMENTAL = 500; // incremental shape messages
const OFFLINE_WRITES = 200; // queued offline writes to replay

const now = () => Number(process.hrtime.bigint()) / 1e6;
const uuid = (n) =>
  `${n.toString(16).padStart(8, '0')}-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

function pct(sorted, p) {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

const SCHEMA = `
create table tasks (
  id uuid primary key,
  tenant_id uuid not null,
  title text not null,
  status text not null default 'todo',
  position integer not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index tasks_tenant_idx on tasks (tenant_id, updated_at desc);
create table _outbox (
  id uuid primary key,
  procedure text not null,
  input jsonb not null,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  status text not null default 'pending'
);
`;

async function run() {
  const dir = mkdtempSync(join(tmpdir(), 'pglite-bench-'));
  const out = {};

  // --- cold create + schema
  let db = await PGlite.create({ dataDir: dir });
  await db.exec(SCHEMA);

  // --- initial sync of a 2k-row tenant shape (batched multi-row insert, as a shape log load)
  const t0 = now();
  const BATCH = 250;
  for (let i = 0; i < SHAPE_ROWS; i += BATCH) {
    const values = [];
    const params = [];
    for (let j = 0; j < BATCH && i + j < SHAPE_ROWS; j++) {
      const n = i + j;
      const b = params.length;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`);
      params.push(uuid(n), uuid(1), `Task ${n}`, n % 3 === 0 ? 'done' : 'todo', n);
    }
    await db.query(
      `insert into tasks (id, tenant_id, title, status, position) values ${values.join(',')}`,
      params,
    );
  }
  await db.query(`select count(*) from tasks where tenant_id = $1`, [uuid(1)]);
  out.initialSyncMs = +(now() - t0).toFixed(1);

  // --- fill the table out to 10k rows across 5 tenants (background of the shape)
  for (let i = SHAPE_ROWS; i < ROWS; i += BATCH) {
    const values = [];
    const params = [];
    for (let j = 0; j < BATCH && i + j < ROWS; j++) {
      const n = i + j;
      const b = params.length;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`);
      params.push(uuid(n), uuid(1 + (n % TENANTS)), `Task ${n}`, 'todo', n);
    }
    await db.query(
      `insert into tasks (id, tenant_id, title, status, position) values ${values.join(',')}`,
      params,
    );
  }

  // --- incremental: one shape message at a time, each followed by the live query the UI runs
  const lat = [];
  for (let i = 0; i < INCREMENTAL; i++) {
    const a = now();
    await db.query(
      `insert into tasks (id, tenant_id, title, status, position) values ($1,$2,$3,$4,$5)
       on conflict (id) do update set title = excluded.title, status = excluded.status, updated_at = now()`,
      [uuid(i), uuid(1), `Task ${i} v2`, 'doing', i],
    );
    await db.query(
      `select id, title, status from tasks where tenant_id = $1 and deleted_at is null
       order by updated_at desc limit 50`,
      [uuid(1)],
    );
    lat.push(now() - a);
  }
  lat.sort((x, y) => x - y);
  out.incrementalP50Ms = +pct(lat, 50).toFixed(2);
  out.incrementalP95Ms = +pct(lat, 95).toFixed(2);

  // --- 200 offline writes: queue into _outbox with optimistic local apply, then replay
  for (let i = 0; i < OFFLINE_WRITES; i++) {
    await db.query(`insert into _outbox (id, procedure, input) values ($1,$2,$3)`, [
      uuid(900000 + i),
      'task.update',
      JSON.stringify({ id: uuid(i), title: `Offline ${i}` }),
    ]);
    await db.query(`update tasks set title = $2, updated_at = now() where id = $1`, [
      uuid(i),
      `Offline ${i}`,
    ]);
  }
  const t2 = now();
  const pending = await db.query(
    `select id, input from _outbox where status = 'pending' order by created_at`,
  );
  await db.exec('begin');
  for (const row of pending.rows) {
    await db.query(`update _outbox set status = 'sent', attempts = attempts + 1 where id = $1`, [
      row.id,
    ]);
  }
  await db.exec('commit');
  out.replay200Ms = +(now() - t2).toFixed(1);

  // --- correctness: row count and checksum of the replayed set
  const chk = await db.query(
    `select count(*)::int as n, md5(string_agg(id::text || ':' || title, '|' order by id)) as checksum
     from tasks where tenant_id = $1 and title like 'Offline %'`,
    [uuid(1)],
  );
  out.replayRows = chk.rows[0].n;
  out.replayChecksum = chk.rows[0].checksum;
  const sent = await db.query(`select count(*)::int as n from _outbox where status = 'sent'`);
  out.outboxDrained = sent.rows[0].n;

  // --- memory after 10k rows
  out.heapMb = +(process.memoryUsage().heapUsed / 1048576).toFixed(1);
  out.rssMb = +(process.memoryUsage().rss / 1048576).toFixed(1);

  // --- cold start: close and reopen the persisted datadir, run the first query
  await db.close();
  const t3 = now();
  db = await PGlite.create({ dataDir: dir });
  await db.query(`select count(*) from tasks where tenant_id = $1`, [uuid(1)]);
  out.coldStartMs = +(now() - t3).toFixed(1);
  await db.close();
  rmSync(dir, { recursive: true, force: true });
  return out;
}

const runs = [];
for (let r = 0; r < 3; r++) runs.push(await run());
const keys = [
  'initialSyncMs',
  'incrementalP50Ms',
  'incrementalP95Ms',
  'replay200Ms',
  'heapMb',
  'rssMb',
  'coldStartMs',
];
const median = {};
for (const k of keys) {
  const v = runs.map((x) => x[k]).sort((a, b) => a - b);
  median[k] = v[1];
}
console.log(
  JSON.stringify(
    {
      runs,
      median,
      correctness: {
        replayRows: runs[0].replayRows,
        outboxDrained: runs[0].outboxDrained,
        checksumStable: runs.every((r) => r.replayChecksum === runs[0].replayChecksum),
        checksum: runs[0].replayChecksum,
      },
    },
    null,
    2,
  ),
);
