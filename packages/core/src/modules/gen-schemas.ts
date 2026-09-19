/**
 * `pnpm --filter @paperos/core gen:schemas`
 *
 * Writes `manifest.schema.json` from the Zod schema. The JSON Schema is
 * generated, committed, and drift-checked by `manifest.schema.test.ts`: never
 * hand-edit it, change `manifest.ts` and re-run this.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MODULE_MANIFEST_SCHEMA_ID, ModuleManifestSchema } from './manifest.js';

const here = dirname(fileURLToPath(import.meta.url));

/** The exact bytes the committed schema file must contain. */
export function renderManifestJsonSchema(): string {
  const generated = z.toJSONSchema(ModuleManifestSchema, { io: 'input' }) as Record<
    string,
    unknown
  >;
  const { $schema, ...rest } = generated;
  const document = {
    $schema,
    $id: MODULE_MANIFEST_SCHEMA_ID,
    'x-generated-by':
      'pnpm --filter @paperos/core gen:schemas (packages/core/src/modules/gen-schemas.ts)',
    ...rest,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

export const MANIFEST_SCHEMA_PATH = join(here, 'manifest.schema.json');

/* Script entry point: the drift test imports `renderManifestJsonSchema` instead. */
if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(MANIFEST_SCHEMA_PATH, renderManifestJsonSchema(), 'utf8');
  process.stdout.write(`wrote ${MANIFEST_SCHEMA_PATH}\n`);
}
