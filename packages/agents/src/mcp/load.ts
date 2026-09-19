/**
 * Reading the catalogue and the character fragments off disk.
 *
 * Kept apart from `validate.ts` so the rules can be tested against fixtures without a
 * filesystem, and so the paths live in exactly one place.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CharacterFragment } from './validate.js';

/** Repo root, four levels up from `packages/agents/src/mcp`. */
export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
}

export const CATALOG_PATH = join('.claude', 'mcp', 'catalog.json');

export function loadCatalogJson(root = repoRoot()): unknown {
  return JSON.parse(readFileSync(join(root, CATALOG_PATH), 'utf8'));
}

export function fragmentPath(character: string): string {
  return join('.claude', 'agents', character, 'mcp.json');
}

export function loadFragments(
  characters: readonly string[],
  root = repoRoot(),
): CharacterFragment[] {
  return characters.map((character) => {
    const relative = fragmentPath(character);
    return {
      character,
      path: relative,
      data: JSON.parse(readFileSync(join(root, relative), 'utf8')) as unknown,
    };
  });
}
