import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'aggregate-stats-file.mjs');

function run(args) {
  return execFileSync('node', [scriptPath, ...args], { encoding: 'utf8' }).trim();
}

test('prints null when the stats file does not exist', () => {
  assert.equal(run(['/tmp/does-not-exist-compose-smoke.jsonl', 'mem']), 'null');
});

test('prints the summed memory and cpu across containers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aggregate-stats-file-'));
  const file = join(dir, 'stats.jsonl');
  writeFileSync(
    file,
    [
      JSON.stringify({ Name: 'a', MemUsage: '100MiB / 2GiB', CPUPerc: '1.00%' }),
      JSON.stringify({ Name: 'b', MemUsage: '50MiB / 2GiB', CPUPerc: '0.50%' }),
    ].join('\n'),
  );
  try {
    assert.equal(run([file, 'mem']), '150');
    assert.equal(run([file, 'cpu']), '1.5');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('prints null for an empty capture file (nothing measured)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aggregate-stats-file-'));
  const file = join(dir, 'empty.jsonl');
  writeFileSync(file, '');
  try {
    assert.equal(run([file, 'cpu']), 'null');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
