/**
 * Roster loading (PAP-103): YAML files in, one roster document out.
 *
 * Layout accepted by `loadRosterDir(dir)` and `validateRosterFiles(files)`:
 *   roster.yaml            defaults, dailyAllowanceUsd, optionally inline `characters:`
 *   characters/<name>.yaml one character per file (the PAP-284 layout)
 * A document with a `characters` key is a roster document; anything else is one character.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { SCHEMA_VERSION } from './character.ts';
import { type ValidateOptions, type ValidationResult, validateRoster } from './validate.ts';

export type RosterFiles = Readonly<Record<string, string>>;

/** Merge parsed YAML documents into one raw roster document. Returns `unknown` on purpose. */
export function assembleRoster(files: RosterFiles): unknown {
  let roster: Record<string, unknown> | undefined;
  const characters: unknown[] = [];
  for (const path of Object.keys(files).sort()) {
    const doc = parseYaml(files[path] as string) as unknown;
    if (doc === null || typeof doc !== 'object') continue;
    const rec = doc as Record<string, unknown>;
    if ('characters' in rec || 'defaults' in rec || 'dailyAllowanceUsd' in rec) {
      const { characters: inline, ...rest } = rec;
      roster = { ...(roster ?? {}), ...rest };
      if (Array.isArray(inline)) characters.push(...inline);
    } else {
      characters.push(rec);
    }
  }
  return { schemaVersion: SCHEMA_VERSION, ...(roster ?? {}), characters };
}

export function validateRosterFiles(
  files: RosterFiles,
  options?: ValidateOptions,
): ValidationResult {
  return validateRoster(assembleRoster(files), options);
}

/** Read `roster.yaml` and `characters/*.yaml` (or every `*.yaml` in a flat dir). */
export function readRosterDir(dir: string): RosterFiles {
  const files: Record<string, string> = {};
  const add = (p: string): void => {
    if (statSync(p).isDirectory()) {
      for (const name of readdirSync(p).sort()) {
        const full = join(p, name);
        if (statSync(full).isDirectory() || /\.ya?ml$/.test(name)) add(full);
      }
    } else if (/\.ya?ml$/.test(p)) {
      files[p] = readFileSync(p, 'utf8');
    }
  };
  add(dir);
  return files;
}

export function loadRosterDir(dir: string): unknown {
  return assembleRoster(readRosterDir(dir));
}
