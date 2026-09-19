import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildResult } from '../build-result.mjs';

test('builds a valid ok result', () => {
  const result = buildResult({
    name: 'example-postgres',
    startedMs: 1000,
    healthy: true,
    ramIdleMb: 100,
    ramLoadedMb: 150,
    cpuPct: 2.1,
    imageSizeMb: 90,
    status: 'ok',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.status, 'ok');
});

test('defaults unset optional numbers to null', () => {
  const result = buildResult({
    name: 'example-postgres',
    startedMs: 1000,
    healthy: false,
    status: 'timeout',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.ramIdleMb, null);
  assert.equal(result.data.ramLoadedMb, null);
  assert.equal(result.data.cpuPct, null);
  assert.equal(result.data.imageSizeMb, null);
});

test('rejects an invalid status', () => {
  const result = buildResult({ name: 'x', startedMs: 1, healthy: true, status: 'bogus' });
  assert.equal(result.success, false);
});
