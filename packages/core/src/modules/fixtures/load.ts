/**
 * Fixture loaders. Impure (they read the folder) and used only by tests and by
 * tooling; `manifest.ts` itself never touches the file system.
 *
 * The golden manifests are real `module.manifest.json` files, one per module,
 * so `pnpm --filter @paperos/core modules:validate` finds them by the same walk
 * it will use on real modules once the packages land.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContractPackageInfo, DiagnosticCode, ModuleManifest } from '../manifest.js';

const here = dirname(fileURLToPath(import.meta.url));

export const GOLDEN_DIR = join(here, 'modules');
export const INVALID_DIR = join(here, 'invalid');

/** The eighteen golden manifests (seventeen modules plus the kernel), by id. */
export function loadGoldenManifests(): ModuleManifest[] {
  return readdirSync(GOLDEN_DIR)
    .sort()
    .map(
      (id) =>
        JSON.parse(
          readFileSync(join(GOLDEN_DIR, id, 'module.manifest.json'), 'utf8'),
        ) as ModuleManifest,
    );
}

/** One deliberately broken manifest and everything needed to reproduce its code. */
export interface InvalidCase {
  /** The single diagnostic code this case must produce — and no other. */
  readonly code: DiagnosticCode;
  /** File under `fixtures/invalid/` holding the manifest under test. */
  readonly subject: string;
  /** Validate it against the eighteen goldens. */
  readonly withGoldens: boolean;
  /** Extra sibling manifests from the same folder (the cycle partner). */
  readonly others: readonly string[];
  /** Contract package information the case needs, or null to pass none. */
  readonly contracts: Readonly<Record<string, ContractPackageInfo>> | null;
  /** Why this manifest is wrong, in one sentence. */
  readonly why: string;
}

export function loadInvalidCases(): InvalidCase[] {
  return JSON.parse(readFileSync(join(INVALID_DIR, 'cases.json'), 'utf8')) as InvalidCase[];
}

export function loadInvalidManifest(file: string): unknown {
  return JSON.parse(readFileSync(join(INVALID_DIR, file), 'utf8'));
}
