#!/usr/bin/env node
/**
 * `pnpm --filter @paperos/agents convert:plan [--check]` (PAP-103 DoD, PAP-284 seed).
 *
 * Dry-run conversion of plan.json `agents[]` (copied to `fixtures/source/plan-agents.json`) into
 * character skeletons: kebab ids, kinds, parents, normalised access scopes and plugins. Prints the
 * 37 skeletons as YAML on stdout and proves they use no field outside the schema (strict parse).
 * `--check` also asserts that every skeleton agrees with the golden fixture on the fields the plan
 * carries (name, displayName, kind, reportsTo, parent, plugins, access subset).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { type CharacterInput, CharacterSchema } from '../src/schema/character.ts';
import { isKnownScope } from '../src/schema/scopes.ts';

interface PlanAgent {
  name: string;
  role: string;
  reportsTo: string;
  tools: string[];
  access: string[];
  plugins?: string[];
  subAgents?: Array<{ name: string; role: string }>;
}

const root = new URL('..', import.meta.url).pathname;
const plan = JSON.parse(
  readFileSync(resolve(root, 'fixtures/source/plan-agents.json'), 'utf8'),
) as PlanAgent[];
const check = process.argv.includes('--check');

export const kebab = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Plan prose -> registry scopes. Negations ("no merge rights") drop: absence is the denial. */
export function normaliseAccess(raw: string): string[] {
  const s = raw.trim();
  const fixed: Record<string, string[]> = {
    'forgejo:org-admin': ['forgejo:admin:org'],
    'github:imagine-os admin': ['github:admin:imagine-os'],
    'budget:read-write': ['budget:write'],
    'prod:read-only': ['prod:read'],
    'repo:write (all)': ['repo:write:all'],
    'vps:deploy': ['vps:deploy:staging'],
    'postgres:migrate (staging)': ['postgres:migrate:staging'],
    'secrets:infra': ['secrets:read:infra'],
    'notion:read-write': ['notion:write'],
    'repo:review + request-changes': ['repo:review'],
    'no merge rights': [],
    'no prod write': [],
    'yjs-server:deploy (staging)': ['yjs-server:deploy:staging'],
    'stripe:test-mode write': ['stripe:write:test'],
    'stripe:live read-only': ['stripe:read:live'],
    'ledger:post (staging)': ['ledger:post:staging'],
    'crm:write': ['crm:write:staging'],
    'email:send (sandbox until approved)': ['email:send:sandbox'],
  };
  if (s in fixed) return fixed[s] as string[];
  const repo = /^repo:write (.+)$/.exec(s);
  if (repo)
    return (repo[1] as string).split(/\s+/).map((p) => `repo:write:${p.replace(/\/$/, '')}`);
  return [s];
}

const skeletons: CharacterInput[] = [];
for (const a of plan) {
  const name = kebab(a.name);
  const subs = (a.subAgents ?? []).map((s) => kebab(s.name));
  skeletons.push({
    schemaVersion: 1,
    name,
    displayName: a.name,
    role: a.role.split(':')[0] as string,
    kind: 'lead',
    reportsTo: kebab(a.reportsTo),
    description: `${a.role}.`,
    access: a.access.flatMap(normaliseAccess),
    plugins: a.plugins ?? [],
    linearLabel: `Character/${a.name}`,
    subCharacters: subs,
  });
  for (const s of a.subAgents ?? []) {
    skeletons.push({
      schemaVersion: 1,
      name: kebab(s.name),
      displayName: s.name,
      role: s.role,
      kind: 'sub',
      reportsTo: name,
      parent: name,
      description: `Use for ${s.role.charAt(0).toLowerCase()}${s.role.slice(1)}.`,
    });
  }
}

let failures = 0;
for (const sk of skeletons) {
  const parsed = CharacterSchema.safeParse(sk);
  if (!parsed.success) {
    failures++;
    console.error(
      `${sk.name}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
    );
  }
  for (const scope of sk.access ?? []) {
    if (!isKnownScope(scope)) {
      failures++;
      console.error(`${sk.name}: unknown scope ${scope}`);
    }
  }
}

if (check) {
  for (const sk of skeletons) {
    const golden = parseYaml(
      readFileSync(resolve(root, `fixtures/valid/characters/${sk.name}.yaml`), 'utf8'),
    ) as CharacterInput;
    const mismatches: string[] = [];
    for (const key of ['name', 'displayName', 'kind', 'reportsTo', 'parent'] as const) {
      if (golden[key] !== sk[key])
        mismatches.push(`${key}: plan ${String(sk[key])} golden ${String(golden[key])}`);
    }
    for (const p of sk.plugins ?? [])
      if (!golden.plugins?.includes(p)) mismatches.push(`plugin ${p} missing in golden`);
    for (const s of sk.access ?? [])
      if (!golden.access?.includes(s)) mismatches.push(`access ${s} missing in golden`);
    if (sk.subCharacters && golden.subCharacters?.join() !== sk.subCharacters.join())
      mismatches.push('subCharacters differ');
    if (mismatches.length > 0) {
      failures++;
      console.error(`${sk.name}: ${mismatches.join('; ')}`);
    }
  }
}

if (!check) process.stdout.write(stringify(skeletons, { lineWidth: 100 }));
console.error(
  `convert:plan: ${skeletons.length} characters (${plan.length} leads), ${failures} failures`,
);
process.exit(failures > 0 ? 1 : 0);
