/**
 * `pnpm --filter @paperos/views gen:schemas`
 *
 * Writes the generated JSON Schema files under `packages/views/schema/`. The files are committed;
 * `src/model/json-schema.test.ts` regenerates them and fails when a committed copy is stale, so
 * run this after any change to the Zod model. Pass `--check` to exit 1 instead of writing. The
 * package script runs Biome's formatter over the output afterwards.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_SCHEMAS } from '../src/model/json-schema.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Biome reformats the committed file, so drift is judged on the parsed JSON, not the text. */
function sameJson(a: string, b: string): boolean {
  return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
}
const outDir = resolve(here, '..', 'schema');
const check = process.argv.includes('--check');

mkdirSync(outDir, { recursive: true });
let stale = 0;
for (const [file, build] of Object.entries(GENERATED_SCHEMAS)) {
  const path = resolve(outDir, file);
  const next = `${JSON.stringify(build(), null, 2)}\n`;
  let current: string | undefined;
  try {
    current = readFileSync(path, 'utf8');
  } catch {
    current = undefined;
  }
  if (current !== undefined && sameJson(current, next)) {
    console.log(`up to date  ${file}`);
    continue;
  }
  if (check) {
    console.error(`stale       ${file}`);
    stale += 1;
    continue;
  }
  writeFileSync(path, next);
  console.log(`wrote       ${file}`);
}
if (stale > 0) {
  console.error(`${stale} schema file(s) stale; run pnpm --filter @paperos/views gen:schemas`);
  process.exit(1);
}
