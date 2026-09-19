/**
 * The real, file-backed half of `env-source.ts`. Node-only: this is the one
 * place besides `adapters/node.ts` allowed to import `node:fs` / `node:path`
 * directly (`docs/module-system.md` §4's config row, PAP-444's lint rule R12).
 *
 * Nothing in `@paperos/core/config`'s barrel imports this file, on purpose —
 * that keeps a browser bundle (`apps/web/src/config.ts` and friends) free of
 * `node:fs` entirely. A Node-only entry point activates it by importing it
 * for its side effect (the `setNodeEnvFileReader()` call at the bottom):
 * the `env:check` CLI does this, and so does this package's own test suite
 * wherever a test wants real file-reading behaviour instead of the
 * pure-layer default of "no file, just `process.env`".
 */
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import { envFileNameForMode, parseDotEnv, setNodeEnvFileReader } from './env-source.js';

/** Walks up from `startDir` looking for `pnpm-workspace.yaml`, the template's root marker. */
export function findRepoRoot(startDir: string = process.cwd()): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 20; i += 1) {
    if (nodeFs.existsSync(nodePath.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = nodePath.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

function readEnvFile(root: string | undefined, filename: string): Record<string, string> {
  if (!root) return {};
  const path = nodePath.join(root, filename);
  if (!nodeFs.existsSync(path)) return {};
  return parseDotEnv(nodeFs.readFileSync(path, 'utf8'));
}

/** Finds the repo root fresh on every call (cheap: at most 20 `existsSync` checks) and reads `mode`'s file. */
export function nodeDotEnvFileReader(mode: string): Record<string, string> {
  return readEnvFile(findRepoRoot(), envFileNameForMode(mode));
}

setNodeEnvFileReader(nodeDotEnvFileReader);
