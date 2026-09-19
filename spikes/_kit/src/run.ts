#!/usr/bin/env -S node
/**
 * PAP-753 spike runner. Invoked from a scaffolded spike directory as
 * `tsx ../_kit/src/run.ts . [--lib <id>] [--bundle] [--runtime] [--browser]`
 * (a scaffolded spike's own `package.json` wires the common combinations —
 * see `docs/platform/spike-harness.md` "Running a spike"). With none of
 * `--bundle`/`--runtime`/`--browser` given, all three run.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildEntry, measureBundle } from './bundle.ts';
import { measureBrowserFps } from './browser.ts';
import type { BenchConfig, Candidate } from './config.ts';
import { renderMarkdown } from './render-md.ts';
import { measureRuntime, type Workload } from './runtime.ts';
import {
  emptyBrowser,
  emptyBundle,
  emptyRuntime,
  SummarySchema,
  type CandidateResult,
  type Summary,
} from './schema.ts';
import { serveDist } from './serve-dist.ts';

function parseArgs(argv: string[]) {
  const spikeDirArg = argv.find((a) => !a.startsWith('--'));
  const libIndex = argv.indexOf('--lib');
  return {
    spikeDir: spikeDirArg ? resolve(spikeDirArg) : process.cwd(),
    lib: libIndex >= 0 ? argv[libIndex + 1] : undefined,
    bundle: argv.includes('--bundle'),
    runtime: argv.includes('--runtime'),
    browser: argv.includes('--browser'),
  };
}

async function loadConfig(spikeDir: string): Promise<BenchConfig> {
  const configPath = join(spikeDir, 'bench.config.ts');
  const mod = await import(pathToFileURL(configPath).href);
  const config: BenchConfig = mod.default ?? mod.config;
  if (!config) {
    throw new Error(`${configPath} must export a default BenchConfig (see defineBenchConfig)`);
  }
  return config;
}

async function measureOneCandidate(
  spikeDir: string,
  config: BenchConfig,
  candidate: Candidate,
  flags: { bundle: boolean; runtime: boolean; browser: boolean },
): Promise<CandidateResult> {
  const measuredAt = new Date().toISOString();
  const notes: string[] = [];

  if (candidate.expectedFailure === 'peer') {
    return {
      lib: candidate.lib,
      version: candidate.version,
      measuredAt,
      bundle: emptyBundle('skipped: expectedFailure=peer'),
      runtime: emptyRuntime('skipped: expectedFailure=peer'),
      browser: emptyBrowser('skipped: expectedFailure=peer'),
      status: 'failed:peer',
      notes: ['Marked incompatible with the current React major in bench.config.ts; not measured.'],
    };
  }

  const bundle = flags.bundle && candidate.entryHtml
    ? await measureBundle({
        candidateEntryHtml: resolve(spikeDir, candidate.entryHtml),
        baselineEntryHtml: resolve(spikeDir, config.baselineEntryHtml),
        workDir: spikeDir,
      })
    : emptyBundle(flags.bundle ? 'no entryHtml declared for this candidate' : 'skipped: --bundle not passed');

  let runtime = emptyRuntime('skipped: --runtime not passed');
  if (flags.runtime) {
    if (candidate.workloadPath) {
      const workloadUrl = pathToFileURL(resolve(spikeDir, candidate.workloadPath)).href;
      const workloadMod = (await import(workloadUrl)) as Workload;
      runtime = await measureRuntime(workloadMod);
    } else {
      runtime = emptyRuntime('no workloadPath declared for this candidate');
    }
  }

  let browser = emptyBrowser('skipped: --browser not passed');
  if (flags.browser) {
    if (candidate.entryHtml) {
      const browserOut = join(spikeDir, `.spike-kit-browser-dist-${candidate.id}`);
      await buildEntry(resolve(spikeDir, candidate.entryHtml), browserOut);
      const server = await serveDist(browserOut);
      try {
        browser = await measureBrowserFps({ url: server.url });
      } finally {
        await server.close();
        rmSync(browserOut, { recursive: true, force: true });
      }
    } else {
      browser = emptyBrowser('no entryHtml declared for this candidate');
    }
  }

  const status = runtime.stable === false ? 'unstable' : 'ok';

  return { lib: candidate.lib, version: candidate.version, measuredAt, bundle, runtime, browser, status, notes };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runAll = !args.bundle && !args.runtime && !args.browser;
  const flags = {
    bundle: runAll || args.bundle,
    runtime: runAll || args.runtime,
    browser: runAll || args.browser,
  };

  const config = await loadConfig(args.spikeDir);
  const candidates = args.lib ? config.candidates.filter((c) => c.id === args.lib) : config.candidates;
  if (candidates.length === 0) {
    throw new Error(args.lib ? `no candidate with id ${args.lib}` : 'bench.config.ts declares no candidates');
  }

  const results: CandidateResult[] = [];
  for (const candidate of candidates) {
    console.log(`[spike-kit] measuring ${candidate.id} (${candidate.lib}@${candidate.version})...`);
    results.push(await measureOneCandidate(args.spikeDir, config, candidate, flags));
  }

  const summary: Summary = {
    spike: config.spike,
    measuredAt: new Date().toISOString(),
    method: config.method,
    candidates: results,
  };

  const parsed = SummarySchema.safeParse(summary);
  if (!parsed.success) {
    console.error('[spike-kit] assembled summary failed its own schema — this is a kit bug:');
    console.error(parsed.error.issues);
    process.exit(1);
  }

  const resultsDir = join(args.spikeDir, 'results');
  mkdirSync(resultsDir, { recursive: true });
  for (const result of results) {
    writeFileSync(join(resultsDir, `${result.lib.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
  writeFileSync(join(resultsDir, 'summary.json'), `${JSON.stringify(parsed.data, null, 2)}\n`);
  writeFileSync(join(args.spikeDir, 'results.md'), renderMarkdown(parsed.data));

  console.log(`[spike-kit] wrote ${resultsDir}/summary.json and results.md`);
}

main().catch((err) => {
  console.error('[spike-kit] failed:', err);
  process.exit(1);
});
