import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEW_KINDS, type ViewKind } from './model/view.js';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = resolve(here, '..', 'fixtures');
export const SCHEMA_DIR = resolve(here, '..', 'schema');

export function loadJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, relativePath), 'utf8'));
}

/** The ten golden fixtures, one per kind, as raw JSON. */
export function goldenFixtures(): Array<{ kind: ViewKind; file: string; spec: unknown }> {
  return VIEW_KINDS.map((kind) => ({
    kind,
    file: `${kind}.view.json`,
    spec: loadJson(`${kind}.view.json`),
  }));
}

export function invalidFixtures(): Array<{ file: string; spec: unknown }> {
  return readdirSync(resolve(FIXTURES_DIR, 'invalid'))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({ file, spec: loadJson(`invalid/${file}`) }));
}

/** Deep clone for mutating a fixture inside one test. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
