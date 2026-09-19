import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateDocs } from './generate.js';
import { DOCS_RUBRICS } from './paths.js';

mkdirSync(DOCS_RUBRICS, { recursive: true });
const docs = generateDocs();
for (const [name, text] of Object.entries(docs)) writeFileSync(resolve(DOCS_RUBRICS, name), text);
console.log(`wrote ${Object.keys(docs).length} rubric docs to ${DOCS_RUBRICS}`);
