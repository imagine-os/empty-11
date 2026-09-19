/**
 * Run the repo's Biome on generated files so a generator's output is already
 * formatted the way `pnpm lint` wants it (PAP-305).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Format `files` (repo-relative) with the workspace Biome. No-op with a warning
 * when Biome is not installed, so the generators still work before `pnpm i`.
 */
export function formatWithBiome(repoRoot: string, files: readonly string[]): void {
  const binary = join(repoRoot, 'node_modules', '.bin', 'biome');
  if (!existsSync(binary)) {
    process.stderr.write(`biome not found at ${binary}; skipping format of generated files\n`);
    return;
  }
  const result = spawnSync(binary, ['check', '--write', '--no-errors-on-unmatched', ...files], {
    cwd: repoRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`biome could not format ${files.join(', ')}`);
  }
}
