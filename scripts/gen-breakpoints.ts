#!/usr/bin/env node
/**
 * PAP-14 — writes `ops/ci/breakpoints.json` from
 * `packages/core/src/devices/matrix.ts`'s `toBreakpointsJson()`.
 *
 * Lives outside `packages/core` on purpose: that package is pure TypeScript
 * with no `node:*` imports (see the note at the top of `matrix.ts`), so the
 * actual file write happens here instead.
 *
 * Usage (from anywhere — paths are resolved relative to this file, not cwd):
 *   node scripts/gen-breakpoints.ts          # writes ops/ci/breakpoints.json
 *   node scripts/gen-breakpoints.ts --check  # exits 1 if the file is stale
 *
 * Not yet wired up as `pnpm gen:breakpoints` — that needs a script entry in a
 * package.json (root `package.json` is PAP-13's in wave 0; see the PAP-14
 * build report for this as a follow-up) and, for the CI `--check` gate PAP-82
 * needs, a `turbo.json` task. Both are root-file edits out of this issue's
 * scope, so for now this file is run directly with `node`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toBreakpointsJson } from '../packages/core/src/devices/matrix.ts';

const outPath = fileURLToPath(new URL('../ops/ci/breakpoints.json', import.meta.url));
const checkOnly = process.argv.includes('--check');
const next = `${JSON.stringify(toBreakpointsJson(), null, 2)}\n`;

if (checkOnly) {
  let current = '';
  try {
    current = readFileSync(outPath, 'utf8');
  } catch {
    console.error(
      `gen-breakpoints --check: ${outPath} does not exist. Run \`node scripts/gen-breakpoints.ts\`.`,
    );
    process.exit(1);
  }
  if (current !== next) {
    console.error(
      `gen-breakpoints --check: ${outPath} is stale relative to matrix.ts. Run \`node scripts/gen-breakpoints.ts\`.`,
    );
    process.exit(1);
  }
  console.log('gen-breakpoints --check: up to date.');
} else {
  writeFileSync(outPath, next, 'utf8');
  console.log(`gen-breakpoints: wrote ${outPath}`);
}
