#!/usr/bin/env tsx
/**
 * `pnpm --filter @paperos/tokens build` -- resolves all three themes and
 * writes `src/generated/{tokens.css,theme.css,tokens.ts}`. Idempotent: run
 * it twice with no source changes and the output bytes are identical
 * (paths and object keys are always emitted in sorted order).
 *
 * `--check` runs the same resolution but only *compares* against what's on
 * disk, for CI's drift check: it exits 1 and prints which generated file is
 * stale instead of writing anything, so a commit that changed a source
 * `.tokens.json` without re-running `build` fails the gate.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateThemeCss, generateTokensCss } from '../src/lib/generate-css.js';
import { generateRawTokensJson, generateTokensTs } from '../src/lib/generate-ts.js';
import { resolveAllThemes } from '../src/lib/theme.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(HERE, '..', 'src', 'generated');

const OUTPUTS: [string, () => string][] = [
  ['tokens.css', () => generateTokensCss(resolveAllThemes())],
  ['theme.css', () => generateThemeCss(resolveAllThemes())],
  ['tokens.ts', () => generateTokensTs(resolveAllThemes())],
  ['raw-tokens.json', () => generateRawTokensJson(resolveAllThemes())],
];

function main(): number {
  const check = process.argv.includes('--check');
  mkdirSync(GENERATED_DIR, { recursive: true });

  const stale: string[] = [];
  for (const [filename, generate] of OUTPUTS) {
    const content = generate();
    const outPath = join(GENERATED_DIR, filename);
    if (check) {
      let existing: string | null = null;
      try {
        existing = readFileSync(outPath, 'utf8');
      } catch {
        existing = null;
      }
      if (existing !== content) {
        stale.push(filename);
      }
    } else {
      writeFileSync(outPath, content);
      process.stdout.write(`wrote ${join('src', 'generated', filename)}\n`);
    }
  }

  if (check && stale.length > 0) {
    process.stderr.write(
      `drift check failed: ${stale.join(', ')} ${stale.length === 1 ? 'is' : 'are'} out of date.\nRun \`pnpm --filter @paperos/tokens build\` and commit the result.\n`,
    );
    return 1;
  }
  if (check) {
    process.stdout.write('drift check passed: generated files match the committed sources.\n');
  }
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
