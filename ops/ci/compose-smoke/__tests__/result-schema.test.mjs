import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseResult, SMOKE_STATUSES, validateResult } from '../lib/result-schema.mjs';

const VALID = {
  name: 'example-postgres',
  startedMs: 1_726_700_000_000,
  healthy: true,
  ramIdleMb: 120.5,
  ramLoadedMb: 180.25,
  cpuPct: 3.4,
  imageSizeMb: 90,
  status: 'ok',
};

test('accepts a fully valid result', () => {
  const result = validateResult(VALID);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, VALID);
});

test('accepts null for unmeasured numeric fields', () => {
  const result = validateResult({ ...VALID, ramIdleMb: null, imageSizeMb: null });
  assert.equal(result.success, true);
});

test('rejects a missing required field', () => {
  const { name, ...rest } = VALID;
  const result = validateResult(rest);
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'name'));
});

test('rejects an unknown status', () => {
  const result = validateResult({ ...VALID, status: 'exploded' });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'status'));
});

test('every declared status is accepted', () => {
  for (const status of SMOKE_STATUSES) {
    const result = validateResult({ ...VALID, status });
    assert.equal(result.success, true, `status ${status} should be valid`);
  }
});

test('rejects a non-boolean healthy', () => {
  const result = validateResult({ ...VALID, healthy: 'yes' });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'healthy'));
});

test('rejects an unknown field', () => {
  const result = validateResult({ ...VALID, extra: 1 });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'extra'));
});

test('parseResult rejects invalid JSON text', () => {
  const result = parseResult('not json');
  assert.equal(result.success, false);
});

test('parseResult round-trips valid JSON text', () => {
  const result = parseResult(JSON.stringify(VALID));
  assert.equal(result.success, true);
  assert.deepEqual(result.data, VALID);
});
