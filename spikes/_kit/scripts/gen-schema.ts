#!/usr/bin/env -S node
/**
 * Regenerates `schema/results.schema.json` from the Zod source of truth
 * (`src/schema.ts`) using Zod 4's built-in `z.toJSONSchema`. `--check` fails
 * (exit 1) when the committed file is stale, the same convention as
 * `pnpm --filter @paperos/spec gen:schemas:check` elsewhere in this repo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { SummarySchema } from '../src/schema.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'schema', 'results.schema.json');

const jsonSchema = z.toJSONSchema(SummarySchema, { target: 'draft-7' });
jsonSchema.$id = 'https://paperos.dev/schema/spike-results.schema.json';
jsonSchema.title = 'PaperOS spike results summary (PAP-753)';

const rendered = `${JSON.stringify(jsonSchema, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(outPath, 'utf8');
  if (current !== rendered) {
    console.error(`stale: ${outPath} does not match src/schema.ts. Run: pnpm gen:schema`);
    process.exit(1);
  }
  console.log('schema/results.schema.json is up to date');
  process.exit(0);
}

writeFileSync(outPath, rendered);
console.log(`wrote ${outPath}`);
