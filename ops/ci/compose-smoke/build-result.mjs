#!/usr/bin/env node
// Assembles the final `compose-smoke/<name>.json` artefact from the pieces the
// workflow gathered (start time, health probe outcome, idle/loaded RAM
// snapshots, CPU%, image size) and validates it against ../lib/result-schema.mjs
// before writing it out.
//
// Usage:
//   node build-result.mjs --name <n> --started-ms <n> --finished-ms <n> \
//     --healthy <true|false> [--idle-ram-mb <n>] [--loaded-ram-mb <n>] \
//     [--cpu-pct <n>] [--image-size-mb <n>] --status <ok|unhealthy|timeout|skipped> \
//     [--out <path>]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResult } from './lib/result-schema.mjs';

function toNumberOrNull(v) {
  if (v === undefined || v === '' || v === 'null') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ name: string, startedMs: number, healthy: boolean, ramIdleMb?: number|null, ramLoadedMb?: number|null, cpuPct?: number|null, imageSizeMb?: number|null, status: string }} args
 * @returns {ReturnType<typeof validateResult>}
 */
export function buildResult(args) {
  const candidate = {
    name: args.name,
    startedMs: args.startedMs,
    healthy: args.healthy,
    ramIdleMb: args.ramIdleMb ?? null,
    ramLoadedMb: args.ramLoadedMb ?? null,
    cpuPct: args.cpuPct ?? null,
    imageSizeMb: args.imageSizeMb ?? null,
    status: args.status,
  };
  return validateResult(candidate);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = argv[++i];
  }
  return out;
}

function main() {
  const raw = parseArgs(process.argv.slice(2));
  const result = buildResult({
    name: raw.name,
    startedMs: Number(raw['started-ms']),
    healthy: raw.healthy === 'true',
    ramIdleMb: toNumberOrNull(raw['idle-ram-mb']),
    ramLoadedMb: toNumberOrNull(raw['loaded-ram-mb']),
    cpuPct: toNumberOrNull(raw['cpu-pct']),
    imageSizeMb: toNumberOrNull(raw['image-size-mb']),
    status: raw.status,
  });

  if (!result.success) {
    console.error('[build-result] invalid result:');
    for (const i of result.error.issues) console.error(`  ${i.path || '(root)'}: ${i.message}`);
    process.exit(1);
  }

  const json = `${JSON.stringify(result.data, null, 2)}\n`;
  if (raw.out) {
    mkdirSync(dirname(raw.out), { recursive: true });
    writeFileSync(raw.out, json);
    console.log(`[build-result] wrote ${raw.out}`);
  } else {
    console.log(json);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
