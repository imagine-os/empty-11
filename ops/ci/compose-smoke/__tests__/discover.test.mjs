import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverEntries } from '../discover.mjs';

/** Builds a throwaway fake repo root with the given compose/smoke fixtures. */
function makeFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'compose-smoke-discover-'));

  // ops/compose/example-postgres — has smoke.json, should be included.
  mkdirSync(join(root, 'ops', 'compose', 'example-postgres'), { recursive: true });
  writeFileSync(join(root, 'ops', 'compose', 'example-postgres', 'compose.yaml'), 'services: {}\n');
  writeFileSync(
    join(root, 'ops', 'compose', 'example-postgres', 'smoke.json'),
    JSON.stringify({ healthcheck: 'http://localhost:8080/', warmupSeconds: 15 }),
  );

  // ops/compose/no-config — no smoke.json, should be skipped.
  mkdirSync(join(root, 'ops', 'compose', 'no-config'), { recursive: true });
  writeFileSync(join(root, 'ops', 'compose', 'no-config', 'compose.yaml'), 'services: {}\n');

  // ops/compose/needs-secret — skipCi set, should be skipped.
  mkdirSync(join(root, 'ops', 'compose', 'needs-secret'), { recursive: true });
  writeFileSync(join(root, 'ops', 'compose', 'needs-secret', 'compose.yaml'), 'services: {}\n');
  writeFileSync(
    join(root, 'ops', 'compose', 'needs-secret', 'smoke.json'),
    JSON.stringify({ healthcheck: 'http://localhost:1/', skipCi: 'needs a real Stripe key' }),
  );

  // ops/compose/broken-config — invalid smoke.json, should be skipped.
  mkdirSync(join(root, 'ops', 'compose', 'broken-config'), { recursive: true });
  writeFileSync(join(root, 'ops', 'compose', 'broken-config', 'compose.yaml'), 'services: {}\n');
  writeFileSync(
    join(root, 'ops', 'compose', 'broken-config', 'smoke.json'),
    JSON.stringify({ warmupSeconds: -5 }),
  );

  // spikes/oss-products/twenty — one level deep, has smoke.json.
  mkdirSync(join(root, 'spikes', 'oss-products', 'twenty'), { recursive: true });
  writeFileSync(join(root, 'spikes', 'oss-products', 'twenty', 'compose.yaml'), 'services: {}\n');
  writeFileSync(
    join(root, 'spikes', 'oss-products', 'twenty', 'smoke.json'),
    JSON.stringify({ healthcheck: 'http://localhost:3000/' }),
  );

  // spikes/oss-products/twenty/nested-not-scanned — depth 2, should NOT be found (one-level rule).
  mkdirSync(join(root, 'spikes', 'oss-products', 'twenty', 'nested-not-scanned'), {
    recursive: true,
  });
  writeFileSync(
    join(root, 'spikes', 'oss-products', 'twenty', 'nested-not-scanned', 'compose.yaml'),
    'services: {}\n',
  );
  writeFileSync(
    join(root, 'spikes', 'oss-products', 'twenty', 'nested-not-scanned', 'smoke.json'),
    JSON.stringify({ healthcheck: 'http://localhost:9/' }),
  );

  return root;
}

test('discoverEntries finds compose files, applies smoke.json, and skips the right ones', () => {
  const root = makeFixtureRoot();
  try {
    const { entries, skipped } = discoverEntries(root);

    const names = entries.map((e) => e.name).sort();
    assert.deepEqual(names, ['ops-compose-example-postgres', 'spikes-oss-products-twenty']);

    const pg = entries.find((e) => e.name === 'ops-compose-example-postgres');
    assert.equal(pg.healthcheck, 'http://localhost:8080/');
    assert.equal(pg.warmupSeconds, 15);
    assert.equal(pg.composePath, 'ops/compose/example-postgres/compose.yaml');
    assert.equal(pg.smokePath, 'ops/compose/example-postgres/smoke.json');

    const skippedPaths = skipped.map((s) => s.path).sort();
    assert.deepEqual(skippedPaths, [
      'ops/compose/broken-config/compose.yaml',
      'ops/compose/needs-secret/compose.yaml',
      'ops/compose/no-config/compose.yaml',
    ]);

    const secretSkip = skipped.find((s) => s.path === 'ops/compose/needs-secret/compose.yaml');
    assert.ok(secretSkip.reason.includes('skipCi'));

    const brokenSkip = skipped.find((s) => s.path === 'ops/compose/broken-config/compose.yaml');
    assert.ok(brokenSkip.reason.includes('invalid smoke.json'));

    const noConfigSkip = skipped.find((s) => s.path === 'ops/compose/no-config/compose.yaml');
    assert.ok(noConfigSkip.reason.includes('missing smoke.json'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('discoverEntries returns empty results for a repo with no ops/compose or spikes/oss-products', () => {
  const root = mkdtempSync(join(tmpdir(), 'compose-smoke-discover-empty-'));
  try {
    const { entries, skipped } = discoverEntries(root);
    assert.deepEqual(entries, []);
    assert.deepEqual(skipped, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
