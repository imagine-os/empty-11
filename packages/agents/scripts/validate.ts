#!/usr/bin/env node
/**
 * `pnpm --filter @paperos/agents validate [path ...]` (PAP-103).
 *
 * Validates roster directories or YAML files. A directory is read as `roster.yaml` plus
 * `characters/*.yaml`; a single file is validated on its own. With no argument it validates the
 * live roster (`packages/agents/roster.yaml` + `characters/`, PAP-284) and then `fixtures/valid`. Exit 0 when no errors, 1 on errors, 2 on a usage or read failure. `--json`
 * prints the findings as JSON; `--quiet` prints only the summary line.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AGENTS_PACKAGE_ROOT, readLiveRosterFiles } from '../src/roster/live.ts';
import { readRosterDir, validateRosterFiles } from '../src/schema/load.ts';
import type { Finding } from '../src/schema/validate.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const quiet = args.includes('--quiet');
const paths = args.filter((a) => !a.startsWith('--'));
const here = new URL('..', import.meta.url).pathname;
const LIVE = 'packages/agents (roster.yaml + characters/)';
const targets = paths.length > 0 ? paths : [LIVE, resolve(here, 'fixtures/valid')];

let exitCode = 0;
for (const target of targets) {
  if (target !== LIVE && !existsSync(target)) {
    console.error(`agents validate: ${target} does not exist`);
    exitCode = 2;
    continue;
  }
  const result = validateRosterFiles(
    target === LIVE ? readLiveRosterFiles(AGENTS_PACKAGE_ROOT) : readRosterDir(target),
  );
  if (json) {
    console.log(
      JSON.stringify(
        { target, ok: result.ok, errors: result.errors, warnings: result.warnings },
        null,
        2,
      ),
    );
  } else {
    if (!quiet) {
      for (const f of [...result.errors, ...result.warnings]) console.log(format(f));
    }
    const chars = result.roster?.characters.length ?? 0;
    console.log(
      `${result.ok ? 'ok' : 'FAIL'} ${target}: ${chars} characters, ${result.errors.length} errors, ${result.warnings.length} warnings`,
    );
  }
  if (!result.ok) exitCode = Math.max(exitCode, 1);
}
process.exit(exitCode);

function format(f: Finding): string {
  const where = [f.character, f.path].filter(Boolean).join(' ');
  return `${f.severity === 'error' ? 'error' : 'warn '} ${f.code}${where ? ` [${where}]` : ''}: ${f.message}`;
}
