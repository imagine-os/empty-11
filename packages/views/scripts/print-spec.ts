/**
 * `pnpm --filter @paperos/views print-spec fixtures/kanban.view.json`
 *
 * Reads a view spec JSON file, migrates it if needed, strict-parses it with `viewSpecSchema`,
 * validates the same file against the generated JSON Schema with Ajv, and prints both results.
 * Exit 1 when either validation fails. The path is relative to `packages/views/`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { z } from 'zod';
import { migrateViewSpec, viewSpecSchema } from '../src/model/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const arg = process.argv[2];
if (!arg) {
  console.error('usage: pnpm --filter @paperos/views print-spec <path/to/spec.view.json>');
  process.exit(2);
}
const raw: unknown = JSON.parse(readFileSync(resolve(pkgRoot, arg), 'utf8'));

let failed = false;

const migrated = migrateViewSpec(raw);
const zodResult = viewSpecSchema.safeParse(migrated);
console.log(`# ${arg}`);
console.log(
  `zod: ${zodResult.success ? 'valid' : 'INVALID'}${
    (raw as { version?: unknown }).version !== migrated.version
      ? ` (migrated v${String((raw as { version?: unknown }).version)} -> v${String(migrated.version)})`
      : ''
  }`,
);
if (zodResult.success) {
  console.log(JSON.stringify(zodResult.data, null, 2));
} else {
  failed = true;
  console.log(z.prettifyError(zodResult.error));
}

const schema = JSON.parse(readFileSync(resolve(pkgRoot, 'schema/view.schema.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const ok = validate(migrated);
console.log(`json-schema (${String(schema.$id)}): ${ok ? 'valid' : 'INVALID'}`);
if (!ok) {
  failed = true;
  console.log(ajv.errorsText(validate.errors, { separator: '\n' }));
}
process.exit(failed ? 1 : 0);
