#!/usr/bin/env node
// Polls a stack's `x-paperos`/`smoke.json` healthcheck URL until it answers
// with a non-5xx status or the timeout elapses. Runs after
// `docker compose up --wait` and the warm-up sleep.
//
// Usage:
//   node probe.mjs --url <url> [--timeout-ms 60000] [--interval-ms 1000] [--github-output <file>]
//
// Exit code 0 when healthy before the timeout, 1 otherwise. Prints one JSON
// line either way: { healthy, elapsedMs, attempts, lastError }.

import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, intervalMs?: number, fetchImpl?: typeof fetch, now?: () => number, sleep?: (ms: number) => Promise<void> }} [options]
 * @returns {Promise<{ healthy: boolean, elapsedMs: number, attempts: number, lastError: string|null }>}
 */
export async function waitForHealthy(url, options = {}) {
  const {
    timeoutMs = 60_000,
    intervalMs = 1_000,
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  const start = now();
  let attempts = 0;
  let lastError = null;

  for (;;) {
    attempts += 1;
    try {
      const response = await fetchImpl(url, { redirect: 'follow' });
      // Any response the server actually sent (even a 404) proves the process
      // is up and accepting connections; only 5xx means "not ready yet".
      if (response.status < 500) {
        return { healthy: true, elapsedMs: now() - start, attempts, lastError: null };
      }
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    const elapsed = now() - start;
    if (elapsed >= timeoutMs) {
      return { healthy: false, elapsedMs: elapsed, attempts, lastError };
    }
    await sleep(Math.min(intervalMs, timeoutMs - elapsed));
  }
}

function parseArgs(argv) {
  const out = { url: '', timeoutMs: 60_000, intervalMs: 1_000, githubOutput: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url') out.url = argv[++i] ?? '';
    else if (argv[i] === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
    else if (argv[i] === '--interval-ms') out.intervalMs = Number(argv[++i]);
    else if (argv[i] === '--github-output') out.githubOutput = argv[++i] ?? '';
  }
  return out;
}

async function main() {
  const { url, timeoutMs, intervalMs, githubOutput } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error('[probe] --url is required');
    process.exit(2);
  }

  console.log(`[probe] polling ${url} (timeout ${timeoutMs}ms, interval ${intervalMs}ms)`);
  const result = await waitForHealthy(url, { timeoutMs, intervalMs });
  console.log(JSON.stringify(result));

  if (githubOutput) {
    appendFileSync(githubOutput, `healthy=${result.healthy}\n`);
    appendFileSync(githubOutput, `elapsed-ms=${result.elapsedMs}\n`);
  }

  process.exit(result.healthy ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
