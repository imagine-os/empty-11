import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSchemas, stableJson } from './generate.js';
import { DOCS_RUBRICS, SCHEMAS_DIR } from './paths.js';

mkdirSync(SCHEMAS_DIR, { recursive: true });
mkdirSync(DOCS_RUBRICS, { recursive: true });
const schemas = generateSchemas();
for (const [name, schema] of Object.entries(schemas)) {
  writeFileSync(resolve(SCHEMAS_DIR, name), stableJson(schema));
}
// The docs copy the spec names: docs/quality/rubrics/finding.schema.json.
writeFileSync(
  resolve(DOCS_RUBRICS, 'finding.schema.json'),
  stableJson(schemas['finding.schema.json']),
);
console.log(
  `wrote ${Object.keys(schemas).length} schemas to ${SCHEMAS_DIR} and finding.schema.json to ${DOCS_RUBRICS}`,
);
