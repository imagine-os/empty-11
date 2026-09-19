#!/usr/bin/env node
/**
 * Scaffolds a new spike from the PAP-753 kit's template.
 *
 * Usage: node scripts/spike-new.mjs PAP-<n> <slug>
 * Writes: spikes/<PAP-n>-<slug>/{package.json,bench.config.ts,README.md,candidates/example/*}
 *
 * Plain Node, no dependencies — this is a root-level dev script (allowed per
 * PAP-753's paths; it is NOT wired into the root package.json's own
 * `scripts`, which stays PAP-13's file).
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`spike-new: ${message}`);
  process.exit(2);
}

const [issueArg, slugArg] = process.argv.slice(2);
if (!issueArg || !slugArg) {
  fail('usage: node scripts/spike-new.mjs PAP-<n> <slug>');
}
if (!/^PAP-\d+$/i.test(issueArg)) {
  fail(`"${issueArg}" is not a PAP-<n> issue id (PAP-13's convention, see spikes/README.md)`);
}
if (!/^[a-z][a-z0-9-]*$/.test(slugArg)) {
  fail(`"${slugArg}" must be a lowercase kebab-case slug`);
}

const issue = issueArg.toUpperCase();
const dirName = `${issue}-${slugArg}`;
const spikeDir = join(repoRoot, 'spikes', dirName);

if (existsSync(spikeDir)) {
  fail(`spikes/${dirName} already exists`);
}

function write(relPath, content) {
  const full = join(spikeDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

write(
  'package.json',
  `${JSON.stringify(
    {
      name: `spike-${slugArg}`,
      private: true,
      version: '0.0.0',
      type: 'module',
      description: `${issue} spike, scaffolded from spikes/_kit (PAP-753). Standalone; not part of the pnpm workspace or turbo build.`,
      scripts: {
        bench: 'tsx ../_kit/src/run.ts . --bundle --runtime',
        'bench:browser': 'tsx ../_kit/src/run.ts . --bundle --runtime --browser',
        scorecard: 'tsx ../_kit/src/scorecard.ts .',
      },
      dependencies: {
        react: '^19.3.0',
        'react-dom': '^19.3.0',
      },
      devDependencies: {
        '@types/react': '^19.3.0',
        '@types/react-dom': '^19.3.0',
        tsx: '^4.20.6',
      },
    },
    null,
    2,
  )}\n`,
);

write(
  'bench.config.ts',
  `import { defineBenchConfig } from '../_kit/src/config.ts';

// Scaffolded by \`node scripts/spike-new.mjs ${issue} ${slugArg}\`. Replace
// \`example\` with one candidates/<id>/ entry per library under evaluation —
// see spikes/_kit/README.md "Candidate contract".
export default defineBenchConfig({
  spike: '${dirName}',
  method:
    'vite build (production, esbuild minify) per candidate, gzip -9 of the emitted .js minus the shared baseline; performance.now()/process.memoryUsage() around each candidate workload.ts, 3 runs; requestAnimationFrame FPS sample in headless Chromium when available.',
  baselineEntryHtml: '../_kit/baseline/index.html',
  candidates: [
    {
      id: 'example',
      lib: 'example',
      version: '0.0.0',
      entryHtml: 'candidates/example/index.html',
      workloadPath: 'candidates/example/workload.ts',
    },
  ],
});
`,
);

write(
  'candidates/example/index.html',
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${dirName} — example candidate</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
`,
);

write(
  'candidates/example/index.tsx',
  `import { createRoot } from 'react-dom/client';

// Replace this with the candidate library's own minimal mount — the same
// shape as spikes/canvas-eval's per-library entries.
createRoot(document.getElementById('root')!).render(<div>${dirName}: example candidate</div>);
`,
);

write(
  'candidates/example/workload.ts',
  `/**
 * Replace with the operation the spike's Interface contract calls out (a
 * sort, a filter, a CRDT merge, ...). \`runWorkload\` is timed;
 * \`setup\` (optional) runs once, untimed, before the first timed run.
 */
export function runWorkload(): void {
  let total = 0;
  for (let i = 0; i < 1_000_000; i += 1) total += i;
}
`,
);

write(
  'README.md',
  `# spikes/${dirName}

Scaffolded from \`spikes/_kit\` (PAP-753). Standalone spike: not imported by
\`apps/*\` or \`packages/*\`, not part of \`turbo build\` or \`pnpm check\`.

## What this spike answers

<!-- One or two sentences: which issue, which question, which candidates. -->

## Running it

\`\`\`bash
pnpm install --ignore-workspace   # standalone; see spikes/_kit/README.md
pnpm bench                        # bundle + runtime -> results/summary.json, results.md
pnpm bench:browser                 # + browser FPS (needs Chromium; see spikes/_kit/README.md)
pnpm scorecard example --issue ${issue} --out docs/libraries/scorecards/example@0.0.0.yaml
\`\`\`

## What this spike does *not* measure, and why

<!-- Fill in per candidate: anything left null in results/summary.json, and why. -->
`,
);

console.log(`spike-new: wrote spikes/${dirName}/`);
console.log(`  cd spikes/${dirName} && pnpm install --ignore-workspace`);
