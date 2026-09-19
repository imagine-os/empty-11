import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { makeAutomergeAdapter } from './adapters/automerge-adapter.js';
import { makeLoroAdapter } from './adapters/loro-adapter.js';
import { makeYjsAdapter } from './adapters/yjs-adapter.js';
import { median } from './rng.js';
import { SCALES } from './scales.js';
import type { LibDescriptor, PartialRow, ResultRow, WorkloadName } from './types.js';
import { runPeersWorkload } from './workloads/peers.js';
import { runShapesWorkload } from './workloads/shapes.js';
import { runTextWorkload } from './workloads/text.js';

interface Args {
  workload: WorkloadName | 'all';
  runs: number;
  scale: string;
  out?: string;
  md?: string;
  libs: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    workload: 'all',
    runs: 5,
    scale: 'default',
    libs: ['yjs', 'yjs-gc', 'automerge', 'loro-crdt'],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--workload') args.workload = argv[++i] as WorkloadName;
    else if (a === '--runs') args.runs = Number(argv[++i]);
    else if (a === '--scale') args.scale = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--md') args.md = argv[++i];
    else if (a === '--libs') args.libs = argv[++i].split(',');
  }
  return args;
}

function libDescriptors(names: string[]): LibDescriptor[] {
  const all: Record<string, LibDescriptor> = {
    yjs: { libName: 'yjs', libVersion: '', make: async () => makeYjsAdapter({ gc: false }) },
    'yjs-gc': { libName: 'yjs-gc', libVersion: '', make: async () => makeYjsAdapter({ gc: true }) },
    automerge: { libName: 'automerge', libVersion: '', make: async () => makeAutomergeAdapter() },
    'loro-crdt': { libName: 'loro-crdt', libVersion: '', make: async () => makeLoroAdapter() },
  };
  return names.map((n) => {
    const d = all[n];
    if (!d) throw new Error(`unknown lib "${n}"; choose from ${Object.keys(all).join(', ')}`);
    return d;
  });
}

/**
 * How many bytes gzip -9 shrinks the library's installed browser WASM
 * binary to, as a proxy for wire cost (the "web" build, since that is what
 * ships to a browser bundle, not the "nodejs" build this harness runs on).
 * Non-WASM libs (Yjs) report 0.
 */
function wasmGzipSize(libName: string): number {
  const wasmPaths: Record<string, string | null> = {
    yjs: null,
    'yjs-gc': null,
    automerge:
      'node_modules/@automerge/automerge/dist/mjs/wasm_bindgen_output/web/automerge_wasm_bg.wasm',
    'loro-crdt': 'node_modules/loro-crdt/web/loro_wasm_bg.wasm',
  };
  const path = wasmPaths[libName];
  if (!path) return 0;
  try {
    const buf = readFileSync(path);
    return gzipSync(buf).length;
  } catch {
    return -1;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scale = SCALES[args.scale];
  if (!scale)
    throw new Error(`unknown scale "${args.scale}"; choose from ${Object.keys(SCALES).join(', ')}`);
  const libs = libDescriptors(args.libs);
  const workloads: WorkloadName[] = args.workload === 'all' ? ['a', 'b', 'c'] : [args.workload];

  console.log(
    `crdt-bench: scale=${scale.name} runs=${args.runs} workloads=${workloads.join(',')} libs=${args.libs.join(',')}`,
  );

  // Fill in real versions once (adapters read their own package.json).
  for (const lib of libs) {
    const probe = await lib.make();
    lib.libVersion = probe.libVersion;
    probe.dispose();
  }

  const raw = new Map<string, { partial: PartialRow; values: number[] }>();
  const addSample = (p: PartialRow) => {
    const key = `${p.lib}\u0000${p.workload}\u0000${p.metric}`;
    const existing = raw.get(key);
    if (existing) existing.values.push(p.value);
    else raw.set(key, { partial: p, values: [p.value] });
  };

  for (let run = 0; run < args.runs; run++) {
    for (const workload of workloads) {
      for (const lib of libs) {
        process.stdout.write(`  run ${run + 1}/${args.runs} ${workload} ${lib.libName}...\r`);
        let rows: PartialRow[];
        if (workload === 'a') rows = await runTextWorkload(lib, scale);
        else if (workload === 'b') rows = await runShapesWorkload(lib, scale);
        else rows = await runPeersWorkload(lib, scale);
        for (const r of rows) addSample(r);
      }
    }
  }
  console.log('');

  const results: ResultRow[] = [];
  for (const [, entry] of raw) {
    results.push({
      ...entry.partial,
      value: round(median(entry.values)),
      runs: entry.values.length,
      scale: scale.name,
    });
  }

  // Static, one-off metrics that don't vary by run: WASM gzip size per library.
  for (const lib of libs) {
    if (results.some((r) => r.lib === lib.libName && r.metric === 'wasm_gzip_size')) continue;
    results.push({
      lib: lib.libName,
      libVersion: lib.libVersion,
      workload: workloads[0],
      metric: 'wasm_gzip_size',
      value: wasmGzipSize(lib.libName),
      unit: 'bytes',
      runs: 1,
      scale: scale.name,
    });
  }

  results.sort(
    (a, b) =>
      a.lib.localeCompare(b.lib) ||
      a.workload.localeCompare(b.workload) ||
      a.metric.localeCompare(b.metric),
  );

  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, JSON.stringify(results, null, 2) + '\n');
    console.log(`wrote ${args.out}`);
  }
  if (args.md) {
    mkdirSync(dirname(args.md), { recursive: true });
    writeFileSync(args.md, renderMarkdown(results, scale, args));
    console.log(`wrote ${args.md}`);
  }
  if (!args.out && !args.md) {
    console.table(results);
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function renderMarkdown(results: ResultRow[], scale: (typeof SCALES)[string], args: Args): string {
  const lines: string[] = [];
  lines.push('# CRDT benchmark results (PAP-139)');
  lines.push('');
  lines.push(
    `Scale: \`${scale.name}\` | runs: ${args.runs} | generated: ${new Date().toISOString()}`,
  );
  lines.push('');
  lines.push('| lib | version | workload | metric | value | unit | runs |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(
      `| ${r.lib} | ${r.libVersion} | ${r.workload} | ${r.metric} | ${r.value} | ${r.unit} | ${r.runs} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
