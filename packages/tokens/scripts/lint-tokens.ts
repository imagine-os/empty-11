#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/**
 * `tokens:lint` -- four checks over the DTCG source files (not the
 * generated output):
 *
 * 1. Kebab names: every group/token key matches the schema's `kebabKey`
 *    pattern (lower-kebab-case or a bare number).
 * 2. Resolvable aliases: every `{a.b.c}` reference in every theme resolves
 *    to a real leaf token.
 * 3. No cycles: alias resolution never revisits a path it is already
 *    resolving.
 * 4. No unused aliases: every primitive under the categories that exist
 *    *only* to be aliased by the semantic layer (font family/size/weight/
 *    line-height, motion duration/ease) is referenced by at least one
 *    alias somewhere. Colour ramps, radius, space, shadow, z-index,
 *    breakpoint and size primitives are exempt -- those are an open scale
 *    components may reach directly, not an alias-only layer (see
 *    core.tokens.json's top-level $description).
 */
import Ajv2020 from 'ajv/dist/2020.js';
import { flatten, loadTokenFile, TokenAliasError, TokenCycleError } from '../src/lib/dtcg.js';
import { resolveTheme, THEME_NAMES, TOKENS_DIR } from '../src/lib/theme.js';

const SCHEMA_PATH = join(TOKENS_DIR, '..', 'schema', 'dtcg-token-file.schema.json');

const ALL_FILES = [
  'core.tokens.json',
  'semantic.tokens.json',
  'reserved/dataviz.tokens.json',
  'reserved/density.tokens.json',
  'themes/light.tokens.json',
  'themes/dark.tokens.json',
  'themes/hc.tokens.json',
];

/** Groups whose leaves exist only to be aliased; every one must be referenced. */
const ALIAS_ONLY_PREFIXES = [
  'font.family',
  'font.size',
  'font.line-height',
  'font.weight',
  'motion.duration',
  'motion.ease',
];

function main(): number {
  let failed = false;
  const errors: string[] = [];

  // 1. Schema / kebab-name validation.
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const validate = ajv.compile(schema);
  for (const file of ALL_FILES) {
    const data = loadTokenFile(join(TOKENS_DIR, file));
    if (!validate(data)) {
      failed = true;
      for (const err of validate.errors ?? []) {
        errors.push(`${file}: ${err.instancePath || '(root)'} ${err.message}`);
      }
    }
  }

  // 2 + 3. Resolvability and cycles (resolveTheme throws on either).
  const usedPaths = new Set<string>();
  for (const theme of THEME_NAMES) {
    try {
      resolveTheme(theme, usedPaths);
    } catch (err) {
      failed = true;
      if (err instanceof TokenCycleError || err instanceof TokenAliasError) {
        errors.push(`${theme}: ${err.message}`);
      } else {
        throw err;
      }
    }
  }

  // 4. No unused aliases, scoped to the alias-only categories.
  if (!failed) {
    const core = loadTokenFile(join(TOKENS_DIR, 'core.tokens.json'));
    const corePaths = flatten(core).map((t) => t.path.join('.'));
    for (const path of corePaths) {
      if (ALIAS_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix)) && !usedPaths.has(path)) {
        failed = true;
        errors.push(
          `unused alias target: "${path}" is never referenced by semantic.tokens.json or a theme file`,
        );
      }
    }
  }

  if (failed) {
    process.stderr.write(`tokens:lint failed:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`);
    return 1;
  }
  process.stdout.write(
    `tokens:lint passed (${ALL_FILES.length} files, ${THEME_NAMES.length} themes).\n`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
