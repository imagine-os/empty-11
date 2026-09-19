/**
 * The live roster (PAP-284): `packages/agents/roster.yaml` plus `packages/agents/characters/*.yaml`.
 * PAP-287 renders `.claude/agents` from it, PAP-106 builds bundles, PAP-111 reads budgets,
 * PAP-113 serves it as `agents.roster`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type RosterFiles, readRosterDir, validateRosterFiles } from '../schema/load.ts';
import type { ValidateOptions, ValidationResult } from '../schema/validate.ts';

/** Package root: the directory holding `roster.yaml` and `characters/`. */
export const AGENTS_PACKAGE_ROOT = resolve(import.meta.dirname, '../..');
export const LIVE_ROSTER_FILE = join(AGENTS_PACKAGE_ROOT, 'roster.yaml');
export const LIVE_CHARACTERS_DIR = join(AGENTS_PACKAGE_ROOT, 'characters');

/** Read a roster laid out as `<root>/roster.yaml` + `<root>/characters/*.yaml`. */
export function readLiveRosterFiles(root: string = AGENTS_PACKAGE_ROOT): RosterFiles {
  const rosterFile = join(root, 'roster.yaml');
  const charactersDir = join(root, 'characters');
  const files: Record<string, string> = existsSync(charactersDir)
    ? { ...readRosterDir(charactersDir) }
    : {};
  if (existsSync(rosterFile)) files[rosterFile] = readFileSync(rosterFile, 'utf8');
  return files;
}

export function validateLiveRoster(
  root: string = AGENTS_PACKAGE_ROOT,
  options?: ValidateOptions,
): ValidationResult {
  return validateRosterFiles(readLiveRosterFiles(root), options);
}
