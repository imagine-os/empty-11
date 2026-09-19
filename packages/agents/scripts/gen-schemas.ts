#!/usr/bin/env node
/**
 * `pnpm --filter @paperos/agents gen:schemas [--check]` (PAP-103).
 *
 * Writes `schema/character.schema.json` and `schema/roster.schema.json` from the Zod schemas.
 * `--check` exits 1 when a committed copy differs (the drift test does the same in Vitest).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  characterJsonSchema,
  rosterJsonSchema,
  stringifySchema,
} from '../src/schema/json-schema.ts';

const check = process.argv.includes('--check');
const dir = resolve(new URL('..', import.meta.url).pathname, 'schema');
const outputs: Array<[string, string]> = [
  ['character.schema.json', stringifySchema(characterJsonSchema())],
  ['roster.schema.json', stringifySchema(rosterJsonSchema())],
];

let drift = false;
for (const [name, text] of outputs) {
  const path = resolve(dir, name);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  if (check) {
    if (current !== text) {
      drift = true;
      console.error(
        `gen:schemas --check: ${name} is stale; run pnpm --filter @paperos/agents gen:schemas`,
      );
    }
  } else if (current !== text) {
    writeFileSync(path, text);
    console.log(`wrote schema/${name}`);
  } else {
    console.log(`schema/${name} up to date`);
  }
}
process.exit(drift ? 1 : 0);
