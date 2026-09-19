#!/usr/bin/env node
// Thin CLI over aggregateStats() (parse-docker-stats.mjs) for the workflow's
// shell steps: reads a newline-delimited `docker stats --format '{{json .}}'`
// capture file and prints one number.
//
// Usage: node aggregate-stats-file.mjs <file> <mem|cpu>
// Prints `null` (and exits 0) when the file is missing or empty, so a
// missing capture never fails the step that shells out to this script.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aggregateStats } from './parse-docker-stats.mjs';

function main() {
  const [file, field] = process.argv.slice(2);
  if (!file || !['mem', 'cpu'].includes(field)) {
    console.error('usage: aggregate-stats-file.mjs <file> <mem|cpu>');
    process.exit(2);
  }

  if (!existsSync(file)) {
    console.log('null');
    return;
  }

  const lines = readFileSync(file, 'utf8').split('\n');
  try {
    const { memMb, cpuPct, perContainer } = aggregateStats(lines);
    if (perContainer.length === 0) {
      console.log('null'); // nothing measured is not the same as measured-as-zero
      return;
    }
    console.log(field === 'mem' ? memMb : cpuPct);
  } catch (err) {
    console.error(`[aggregate-stats-file] ${err instanceof Error ? err.message : String(err)}`);
    console.log('null');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
