import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateDocs, spliceGatesDoc } from './generate.js';
import { DOCS_RUBRICS, GATES_DOC } from './paths.js';

mkdirSync(DOCS_RUBRICS, { recursive: true });
const docs = generateDocs();
for (const [name, text] of Object.entries(docs)) writeFileSync(resolve(DOCS_RUBRICS, name), text);
writeFileSync(GATES_DOC, spliceGatesDoc(readFileSync(GATES_DOC, 'utf8')));
console.log(
  `wrote ${Object.keys(docs).length} rubric docs to ${DOCS_RUBRICS} and the artifacts-and-statuses block of ${GATES_DOC}`,
);
