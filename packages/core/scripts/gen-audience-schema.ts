/**
 * Regenerate `src/audience/audiences.schema.json` from the Zod schema.
 * Run: `pnpm --filter @paperos/core gen:audience-schema`. The committed copy is checked
 * against a fresh generation by `src/audience/app-spec.test.ts`, so a stale file fails CI.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { audiencesJsonSchema } from '../src/audience/app-spec.js';

const target = fileURLToPath(new URL('../src/audience/audiences.schema.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(audiencesJsonSchema(), null, 2)}\n`);
// Biome owns JSON formatting in this repo; format the output so `pnpm lint` and the committed copy agree.
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', target], { stdio: 'ignore' });
console.log(`wrote ${target}`);
