import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { waitForHealthy } from '../probe.mjs';

/** Starts a plain http server on an ephemeral port and returns { url, close }. */
function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

test('resolves healthy immediately when the server answers 200', async () => {
  const { url, close } = await startServer((_req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  try {
    const result = await waitForHealthy(url, { timeoutMs: 5_000, intervalMs: 10 });
    assert.equal(result.healthy, true);
    assert.equal(result.attempts, 1);
  } finally {
    await close();
  }
});

test('treats a 404 as healthy (process is up, just no route)', async () => {
  const { url, close } = await startServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  try {
    const result = await waitForHealthy(url, { timeoutMs: 5_000, intervalMs: 10 });
    assert.equal(result.healthy, true);
  } finally {
    await close();
  }
});

test('retries through 503s and then succeeds', async () => {
  let calls = 0;
  const { url, close } = await startServer((_req, res) => {
    calls += 1;
    if (calls < 3) {
      res.writeHead(503);
      res.end();
    } else {
      res.writeHead(200);
      res.end('ok');
    }
  });
  try {
    const result = await waitForHealthy(url, { timeoutMs: 5_000, intervalMs: 5 });
    assert.equal(result.healthy, true);
    assert.equal(result.attempts, 3);
  } finally {
    await close();
  }
});

test('times out when nothing ever answers (no server listening)', async () => {
  // 127.0.0.1:1 is a reserved, always-refused port: connections fail fast.
  const result = await waitForHealthy('http://127.0.0.1:1/', { timeoutMs: 200, intervalMs: 20 });
  assert.equal(result.healthy, false);
  assert.ok(result.lastError, 'expected a lastError message');
  assert.ok(result.elapsedMs >= 190, `expected to wait out the timeout, got ${result.elapsedMs}ms`);
});

test('times out on a persistent 500', async () => {
  const { url, close } = await startServer((_req, res) => {
    res.writeHead(500);
    res.end();
  });
  try {
    const result = await waitForHealthy(url, { timeoutMs: 100, intervalMs: 20 });
    assert.equal(result.healthy, false);
    assert.equal(result.lastError, 'HTTP 500');
  } finally {
    await close();
  }
});
