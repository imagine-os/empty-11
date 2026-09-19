/**
 * Demo CLI for the audience model (PAP-55).
 *
 *   pnpm --filter @paperos/core audience explain --principal <principal.json> [--audiences <app-spec.audiences.json>]
 *   pnpm --filter @paperos/core audience validate --audiences <app-spec.audiences.json>
 *
 * `explain` lists every audience with a match mark and the segment in words.
 * `validate` prints each issue with its code and path; exit 1 when the section is invalid.
 * Files are JSON; the `audiences` key may be the whole section or wrapped as `{ audiences: ... }`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AudienceDeclarations } from '../src/audience/audience.js';
import { explainPrincipal } from '../src/audience/explain.js';
import { principalSchema } from '../src/audience/principal.js';
import {
  BUILTIN_REGISTRY,
  createAudienceRegistry,
  validateAudiences,
} from '../src/audience/registry.js';

const USAGE = `usage:
  audience explain --principal <file.json> [--audiences <file.json>]
  audience validate --audiences <file.json>`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
}

function readAudiences(path: string): AudienceDeclarations {
  const raw = readJson(path) as Record<string, unknown>;
  const section = (raw.audiences ?? raw) as Record<string, unknown>;
  const { $comment: _comment, ...declared } = section;
  return declared as AudienceDeclarations;
}

function explain(args: string[]): number {
  const principalPath = flag(args, 'principal');
  if (!principalPath) {
    console.error(USAGE);
    return 2;
  }
  const principal = principalSchema.parse(readJson(principalPath));
  const audiencesPath = flag(args, 'audiences');
  const registry = audiencesPath
    ? createAudienceRegistry(readAudiences(audiencesPath))
    : BUILTIN_REGISTRY;

  console.log(
    `principal ${principal.id} (${principal.type}, tenant ${principal.tenantId ?? 'none'})`,
  );
  console.log(`attributes ${JSON.stringify(principal.attributes)}`);
  console.log('');
  const rows = explainPrincipal(principal, registry);
  const width = Math.max(...rows.map((r) => r.id.length));
  for (const row of rows) {
    console.log(
      `${row.matches ? '[x]' : '[ ]'} ${row.id.padEnd(width)}  ${row.name} — ${row.because}`,
    );
  }
  console.log('');
  console.log(
    `matches: ${rows
      .filter((r) => r.matches)
      .map((r) => r.id)
      .join(', ')}`,
  );
  return 0;
}

function validate(args: string[]): number {
  const audiencesPath = flag(args, 'audiences');
  if (!audiencesPath) {
    console.error(USAGE);
    return 2;
  }
  const result = validateAudiences(readAudiences(audiencesPath));
  if (result.ok) {
    const declared = Object.keys(result.audiences).filter((id) => !BUILTIN_REGISTRY.has(id));
    console.log(
      `ok: ${declared.length} declared audience(s) validate against the built-ins: ${declared.join(', ')}`,
    );
    return 0;
  }
  console.error(`${result.issues.length} issue(s):`);
  for (const issue of result.issues) {
    const path = issue.path ? ` at ${issue.path.join('.')}` : '';
    console.error(`  ${issue.code.padEnd(18)} ${issue.audienceId}${path}: ${issue.message}`);
  }
  return 1;
}

const [command, ...rest] = process.argv.slice(2);
let code: number;
switch (command) {
  case 'explain':
    code = explain(rest);
    break;
  case 'validate':
    code = validate(rest);
    break;
  default:
    console.error(USAGE);
    code = 2;
}
process.exitCode = code;
