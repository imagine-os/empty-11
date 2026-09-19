import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSmokeConfig, validateSmokeConfig } from '../lib/smoke-config.mjs';

test('accepts a minimal config and fills defaults', () => {
  const result = validateSmokeConfig({ healthcheck: 'http://localhost:8080/' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    healthcheck: 'http://localhost:8080/',
    warmupSeconds: 60,
    load: null,
    ramBudgetMb: null,
    skipCi: null,
  });
});

test('accepts every field explicitly', () => {
  const result = validateSmokeConfig({
    healthcheck: 'http://localhost:3000/health',
    warmupSeconds: 15,
    load: 'load.sh',
    ramBudgetMb: 512,
  });
  assert.equal(result.success, true);
  assert.equal(result.data.warmupSeconds, 15);
  assert.equal(result.data.load, 'load.sh');
  assert.equal(result.data.ramBudgetMb, 512);
});

test('rejects a missing healthcheck', () => {
  const result = validateSmokeConfig({ warmupSeconds: 30 });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'healthcheck'));
});

test('rejects a non-URL healthcheck', () => {
  const result = validateSmokeConfig({ healthcheck: 'not-a-url' });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'healthcheck'));
});

test('rejects a negative warmupSeconds', () => {
  const result = validateSmokeConfig({ healthcheck: 'http://x/', warmupSeconds: -1 });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'warmupSeconds'));
});

test('rejects an unknown field', () => {
  const result = validateSmokeConfig({ healthcheck: 'http://x/', typo: true });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path === 'typo'));
});

test('rejects a non-object input', () => {
  assert.equal(validateSmokeConfig(null).success, false);
  assert.equal(validateSmokeConfig([1, 2]).success, false);
  assert.equal(validateSmokeConfig('nope').success, false);
});

test('parseSmokeConfig rejects invalid JSON text', () => {
  const result = parseSmokeConfig('{ not json');
  assert.equal(result.success, false);
  assert.ok(result.error.issues[0].message.includes('invalid JSON'));
});

test('parseSmokeConfig round-trips valid JSON text', () => {
  const result = parseSmokeConfig(JSON.stringify({ healthcheck: 'http://localhost:9000/' }));
  assert.equal(result.success, true);
  assert.equal(result.data.healthcheck, 'http://localhost:9000/');
});

test('skipCi is carried through when set', () => {
  const result = validateSmokeConfig({ healthcheck: 'http://x/', skipCi: 'needs a real API key' });
  assert.equal(result.success, true);
  assert.equal(result.data.skipCi, 'needs a real API key');
});
