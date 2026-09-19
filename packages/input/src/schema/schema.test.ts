import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateSchemas } from './generate.js';

/**
 * The committed JSON Schema files must match what the Zod schemas produce.
 * `pnpm --filter @paperos/input gen:schemas` rewrites them; CI runs this test
 * without the env var and fails on a stale copy.
 */
const here = dirname(fileURLToPath(import.meta.url));
const write = process.env.PAPEROS_WRITE_SCHEMAS === '1';

describe('generated JSON Schema', () => {
  for (const { file, json } of generateSchemas()) {
    it(`${file} is up to date`, () => {
      const path = join(here, file);
      const serialised = `${JSON.stringify(json, null, 2)}\n`;

      if (write) {
        mkdirSync(here, { recursive: true });
        writeFileSync(path, serialised, 'utf8');
      }

      expect(existsSync(path), `${file} is missing; run pnpm gen:schemas`).toBe(true);
      expect(readFileSync(path, 'utf8')).toBe(serialised);
    });
  }

  it('describes the InputEvent union as a discriminated set of eight kinds', () => {
    const [first] = generateSchemas();
    const json = first?.json as { anyOf?: unknown[]; oneOf?: unknown[] };
    const branches = json.anyOf ?? json.oneOf ?? [];
    expect(branches).toHaveLength(8);
  });
});
