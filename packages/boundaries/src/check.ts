/**
 * Staleness checks for the generated files (PAP-305).
 *
 * `.dependency-cruiser.cjs` and `docs/platform/dependency-map.json` are
 * Biome-formatted after they are written, so they are compared by **value**,
 * not by text: the question is whether the committed file still says what
 * `ownership.json` and the import graph say, not whether the whitespace
 * matches. The Markdown rendering is compared as text.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { buildDependencyMap, renderDependencyMapMarkdown } from './map.js';
import { loadOwnership } from './repo.js';
import { generateBiomeBoundaries, generateRuleSet } from './rules.js';

/**
 * The Biome preset whose `overrides` array mirrors rule R3 for editor feedback.
 * Biome does not merge `overrides` through a nested `extends`, and the root
 * `biome.json` has one owner (PAP-13), so the generated block lives in the
 * preset the root config already extends. Everything else in that file is
 * hand-written; only `overrides` is generated.
 */
export const BIOME_BOUNDARIES_FILE = 'packages/config-biome/preset.json';

/** One stale generated file and the command that refreshes it. */
export interface StaleFile {
  readonly file: string;
  readonly reason: string;
  readonly fix: string;
}

/** Paths of the files the two generators own, repo-relative. */
export const GENERATED_FILES = [
  '.dependency-cruiser.cjs',
  BIOME_BOUNDARIES_FILE,
  'docs/platform/dependency-map.json',
  'docs/platform/dependency-map.md',
] as const;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Every generated file that no longer matches its inputs. Empty means green. */
export function findStaleGeneratedFiles(repoRoot: string): StaleFile[] {
  const ownership = loadOwnership(repoRoot);
  const stale: StaleFile[] = [];

  const wantedRules = JSON.parse(JSON.stringify(generateRuleSet(ownership))) as unknown;
  let currentRules: unknown;
  try {
    currentRules = createRequire(join(repoRoot, 'noop.cjs'))('./.dependency-cruiser.cjs');
  } catch (error) {
    currentRules = { unreadable: String(error) };
  }
  if (!isDeepStrictEqual(currentRules, wantedRules)) {
    stale.push({
      file: '.dependency-cruiser.cjs',
      reason: 'the rules no longer match ownership.json',
      fix: 'pnpm gen:deps-rules',
    });
  }

  const wantedBiome = JSON.parse(
    JSON.stringify(generateBiomeBoundaries(ownership).overrides),
  ) as unknown;
  let currentBiome: unknown;
  try {
    currentBiome = (readJson(join(repoRoot, BIOME_BOUNDARIES_FILE)) as { overrides?: unknown })
      .overrides;
  } catch (error) {
    currentBiome = { unreadable: String(error) };
  }
  if (!isDeepStrictEqual(currentBiome, wantedBiome)) {
    stale.push({
      file: BIOME_BOUNDARIES_FILE,
      reason: 'its generated `overrides` (the noRestrictedImports mirror of R3) is out of date',
      fix: 'pnpm gen:deps-rules',
    });
  }

  const map = buildDependencyMap(repoRoot, ownership);
  const wantedMap = JSON.parse(JSON.stringify(map)) as unknown;
  let currentMap: unknown;
  try {
    currentMap = readJson(join(repoRoot, 'docs/platform/dependency-map.json'));
  } catch (error) {
    currentMap = { unreadable: String(error) };
  }
  if (!isDeepStrictEqual(currentMap, wantedMap)) {
    stale.push({
      file: 'docs/platform/dependency-map.json',
      reason: 'the committed map no longer matches ownership.json and the import graph',
      fix: 'pnpm gen:dep-map',
    });
  }

  let currentMarkdown = '';
  try {
    currentMarkdown = readFileSync(join(repoRoot, 'docs/platform/dependency-map.md'), 'utf8');
  } catch {
    currentMarkdown = '';
  }
  if (currentMarkdown !== renderDependencyMapMarkdown(map)) {
    stale.push({
      file: 'docs/platform/dependency-map.md',
      reason: 'the committed Mermaid rendering is out of date',
      fix: 'pnpm gen:dep-map',
    });
  }
  return stale;
}
