/**
 * Regenerate `src/audience/audiences.schema.json` from the Zod schema.
 * Run: `pnpm --filter @paperos/core gen:audience-schema`. The committed copy is checked
 * against a fresh generation by `src/audience/app-spec.test.ts`, so a stale file fails CI.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { audiencesJsonSchema } from '../src/audience/app-spec.js';

const target = fileURLToPath(new URL('../src/audience/audiences.schema.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(audiencesJsonSchema(), null, 2)}\n`);
console.log(`wrote ${target}`);
