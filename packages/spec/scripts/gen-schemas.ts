/**
 * `pnpm --filter @paperos/spec gen:schemas`
 * Writes `schema/page.spec.schema.json` and `docs/platform/page-spec.md` from the Zod schema.
 * Idempotent; `src/json-schema.test.ts` fails when either committed copy is stale.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPageSpecDoc } from '../src/docs.js';
import { buildPageJsonSchema, renderPageJsonSchema } from '../src/json-schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(packageRoot, '../..');

export const OUTPUTS = {
  schema: resolve(packageRoot, 'schema/page.spec.schema.json'),
  doc: resolve(repoRoot, 'docs/platform/page-spec.md'),
} as const;

const check = process.argv.includes('--check');
const files: Array<[string, string]> = [
  [OUTPUTS.schema, renderPageJsonSchema()],
  [OUTPUTS.doc, renderPageSpecDoc(buildPageJsonSchema())],
];

let stale = 0;
for (const [path, content] of files) {
  const current = safeRead(path);
  if (
    current === content ||
    (path.endsWith('.json') && current !== undefined && sameJson(current, content))
  ) {
    console.log(`up to date  ${path}`);
    continue;
  }
  if (check) {
    stale++;
    console.error(`stale       ${path}`);
    continue;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`written     ${path}`);
}
if (stale > 0) {
  console.error(`${stale} generated file(s) stale; run pnpm --filter @paperos/spec gen:schemas`);
  process.exit(1);
}

/** Biome reformats the committed JSON; compare structure, not whitespace. */
function sameJson(a: string, b: string): boolean {
  try {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  } catch {
    return false;
  }
}

function safeRead(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}
