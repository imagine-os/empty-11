#!/usr/bin/env node
/**
 * `pnpm --filter @paperos/agents plan-to-roster [--plan <file>] [--out <dir>] [--merge] [--check] [--force] [--dry-run]`
 * (PAP-284).
 *
 * Converts plan.json `agents[]` into `roster.yaml` plus `characters/<name>.yaml`. Default plan:
 * `fixtures/source/plan-agents.json`; default out: this package. Existing files are never
 * overwritten without `--merge` (plan-owned fields rewritten, hand edits kept) or `--force`
 * (fresh skeletons). `--check` writes nothing and exits 1 when a file would change, naming the
 * drift. `--dry-run` prints what would be written. Exit 0 ok, 1 drift or invalid, 2 usage.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { characterDrift, convertPlan, mergeCharacter, orderFields } from '../src/roster/convert.ts';
import { readPlanAgents } from '../src/roster/plan.ts';
import type { CharacterInput } from '../src/schema/character.ts';
import { validateRosterFiles } from '../src/schema/load.ts';

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(name);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const pkg = new URL('..', import.meta.url).pathname;
const planPath = resolve(opt('--plan') ?? resolve(pkg, 'fixtures/source/plan-agents.json'));
const outDir = resolve(opt('--out') ?? pkg);
const merge = flag('--merge');
const check = flag('--check');
const force = flag('--force');
const dryRun = flag('--dry-run');

if (!existsSync(planPath)) {
  console.error(`plan-to-roster: plan ${planPath} does not exist`);
  process.exit(2);
}

const CHARACTER_HEADER = [
  '# yaml-language-server: $schema=../schema/character.schema.json',
  '# Live roster (PAP-284). Structure comes from plan.json agents[] through scripts/plan-to-roster.ts;',
  '# everything else is completed by hand from docs/characters/<lead>.md and survives `--merge`.',
];
const ROSTER_HEADER = [
  '# yaml-language-server: $schema=../schema/roster.schema.json',
  '# Live roster defaults (PAP-284, round-4 amendment). Characters live in characters/*.yaml.',
  '# A character value wins over its parent, which wins over these defaults; the issue Model / Effort labels win over all of them.',
];

const plan = readPlanAgents(planPath);
const converted = convertPlan(plan);
const charactersDir = join(outDir, 'characters');
const rosterFile = join(outDir, 'roster.yaml');

interface Planned {
  path: string;
  text: string;
  status: 'new' | 'unchanged' | 'changed' | 'conflict';
  drift: string[];
}
const planned: Planned[] = [];

// roster.yaml: written fresh only; with --merge an existing file is kept as the source of defaults.
{
  const text = render(ROSTER_HEADER, converted.roster);
  if (!existsSync(rosterFile)) planned.push({ path: rosterFile, text, status: 'new', drift: [] });
  else if (force)
    planned.push({ path: rosterFile, text, status: 'changed', drift: ['rewritten with --force'] });
  else
    planned.push({
      path: rosterFile,
      text: readFileSync(rosterFile, 'utf8'),
      status: 'unchanged',
      drift: [],
    });
}

for (const generated of converted.characters) {
  const path = join(charactersDir, `${generated.name}.yaml`);
  if (!existsSync(path) || force) {
    planned.push({
      path,
      text: render(CHARACTER_HEADER, orderFields(generated as Record<string, unknown>)),
      status: existsSync(path) ? 'changed' : 'new',
      drift: existsSync(path) ? ['rewritten with --force'] : [],
    });
    continue;
  }
  const current = readFileSync(path, 'utf8');
  const existing = parseYaml(current) as CharacterInput;
  const drift = characterDrift(existing, generated);
  if (drift.length === 0) {
    planned.push({ path, text: current, status: 'unchanged', drift });
    continue;
  }
  if (!merge && !check) {
    planned.push({ path, text: current, status: 'conflict', drift });
    continue;
  }
  const merged = mergeCharacter(existing, generated);
  planned.push({
    path,
    text: render(headerOf(current, CHARACTER_HEADER), merged),
    status: 'changed',
    drift,
  });
}

// Characters in the directory that the plan no longer names: reported, never deleted.
const planNames = new Set(converted.characters.map((c) => c.name));
const orphans = existsSync(charactersDir)
  ? readdirSync(charactersDir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => f.replace(/\.yaml$/, ''))
      .filter((n) => !planNames.has(n))
  : [];

const changed = planned.filter((p) => p.status !== 'unchanged');
for (const p of changed) {
  console.error(
    `${p.status.padEnd(9)} ${rel(p.path)}${p.drift.length ? `\n    ${p.drift.join('\n    ')}` : ''}`,
  );
}
for (const n of orphans)
  console.error(`orphan    characters/${n}.yaml is not in the plan (kept; remove by hand)`);

if (check) {
  console.error(
    `plan-to-roster --check: ${converted.characters.length} characters, ${changed.length} would change, ${orphans.length} orphans`,
  );
  process.exit(changed.length > 0 || orphans.length > 0 ? 1 : 0);
}
if (planned.some((p) => p.status === 'conflict')) {
  console.error(
    'plan-to-roster: files differ from the plan; re-run with --merge to keep hand edits or --force to rewrite',
  );
  process.exit(1);
}

// Validate the result before writing anything.
const files: Record<string, string> = {};
for (const p of planned) files[p.path] = p.text;
const result = validateRosterFiles(files);
for (const f of result.errors)
  console.error(`error ${f.code} [${f.character ?? ''} ${f.path ?? ''}]: ${f.message}`);
if (!result.ok) {
  console.error('plan-to-roster: the converted roster does not validate; nothing written');
  process.exit(1);
}

if (dryRun) {
  for (const p of changed) process.stdout.write(`# ---- ${rel(p.path)}\n${p.text}`);
  console.error(`plan-to-roster --dry-run: ${changed.length} files would be written`);
  process.exit(0);
}
mkdirSync(charactersDir, { recursive: true });
for (const p of changed) writeFileSync(p.path, p.text);
console.error(
  `plan-to-roster: ${converted.characters.length} characters from ${plan.length} leads; ${changed.length} files written, ${planned.length - changed.length} unchanged`,
);

function render(header: readonly string[], doc: unknown): string {
  return `${header.join('\n')}\n${stringify(doc, { lineWidth: 100 })}`;
}
function headerOf(text: string, fallback: readonly string[]): string[] {
  const lines = text.split('\n');
  const header: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('#')) break;
    header.push(line);
  }
  return header.length > 0 ? header : [...fallback];
}
function rel(path: string): string {
  return path.startsWith(outDir) ? path.slice(outDir.length + 1) : path;
}
