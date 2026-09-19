import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregateStats,
  parseMemAmountToMb,
  parsePercent,
  parseStatsLine,
} from '../parse-docker-stats.mjs';

test('parseMemAmountToMb handles MiB/GiB/KiB', () => {
  assert.equal(parseMemAmountToMb('123.4MiB'), 123.4);
  assert.equal(parseMemAmountToMb('1GiB'), 1024);
  assert.equal(Math.round(parseMemAmountToMb('2048KiB') * 100) / 100, 2);
});

test('parseMemAmountToMb throws on garbage', () => {
  assert.throws(() => parseMemAmountToMb('a lot'));
  assert.throws(() => parseMemAmountToMb('5 Elephants'));
});

test('parsePercent strips the % sign', () => {
  assert.equal(parsePercent('3.42%'), 3.42);
  assert.equal(parsePercent('0.00%'), 0);
});

test('parseStatsLine extracts name, memMb and cpuPct from one docker stats JSON line', () => {
  const line = JSON.stringify({
    Name: 'example-postgres-postgres-1',
    MemUsage: '145.3MiB / 1.907GiB',
    CPUPerc: '1.20%',
  });
  const parsed = parseStatsLine(line);
  assert.equal(parsed.name, 'example-postgres-postgres-1');
  assert.equal(parsed.memMb, 145.3);
  assert.equal(parsed.cpuPct, 1.2);
});

test('aggregateStats sums memory and cpu across containers', () => {
  const lines = [
    JSON.stringify({ Name: 'a', MemUsage: '100MiB / 2GiB', CPUPerc: '1.00%' }),
    JSON.stringify({ Name: 'b', MemUsage: '50MiB / 2GiB', CPUPerc: '0.50%' }),
    '',
  ];
  const { memMb, cpuPct, perContainer } = aggregateStats(lines);
  assert.equal(memMb, 150);
  assert.equal(cpuPct, 1.5);
  assert.equal(perContainer.length, 2);
});

test('aggregateStats returns zeros for an empty stack', () => {
  const { memMb, cpuPct, perContainer } = aggregateStats([]);
  assert.equal(memMb, 0);
  assert.equal(cpuPct, 0);
  assert.equal(perContainer.length, 0);
});
