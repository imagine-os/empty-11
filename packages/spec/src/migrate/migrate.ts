/**
 * `migrateSpec`: bring a YAML document to a spec version. v1 skeleton: identity
 * for version 1 (missing read as 1 with a warning), `SPEC_UNSUPPORTED_VERSION`
 * for everything else. Codemod execution lands with PAP-751.
 */
import { type Document, isMap, isScalar } from 'yaml';
import { SpecError, type SpecIssue } from '../issues.js';
import type { Change } from './codemod.js';
import { CURRENT_SPEC_VERSION, findSpecVersion } from './versions.js';

export interface MigrationResult {
  doc: Document;
  from: number;
  to: number;
  changes: Change[];
  issues: SpecIssue[];
}

/** Read `meta.specVersion` from a document; `undefined` when absent. */
export function readSpecVersion(doc: Document): unknown {
  const meta = doc.get('meta', true);
  if (!isMap(meta)) return undefined;
  const version = meta.get('specVersion', true);
  return isScalar(version) ? version.value : version;
}

export function migrateSpec(doc: Document, to: number = CURRENT_SPEC_VERSION): MigrationResult {
  const issues: SpecIssue[] = [];
  const raw = readSpecVersion(doc);
  let from: number;
  if (raw === undefined) {
    from = CURRENT_SPEC_VERSION;
    issues.push({
      code: 'SPEC_VERSION_MISSING',
      severity: 'warning',
      message: `\`meta.specVersion\` is missing; reading the spec as version ${CURRENT_SPEC_VERSION}`,
      path: 'meta',
      hint: `add \`specVersion: ${CURRENT_SPEC_VERSION}\` under \`meta\``,
    });
  } else if (typeof raw === 'number' && findSpecVersion(raw)) {
    from = raw;
  } else {
    throw new SpecError({
      code: 'SPEC_UNSUPPORTED_VERSION',
      severity: 'error',
      message: `\`meta.specVersion\` is ${JSON.stringify(raw)}; known versions: ${[CURRENT_SPEC_VERSION].join(', ')}`,
      path: 'meta.specVersion',
      hint: 'only version 1 exists; see docs/platform/page-spec-versioning.md for the migration roadmap',
    });
  }

  const target = findSpecVersion(to);
  if (!target) {
    throw new SpecError({
      code: 'SPEC_UNSUPPORTED_VERSION',
      severity: 'error',
      message: `target version ${to} is not registered`,
      path: 'meta.specVersion',
    });
  }

  const changes: Change[] = [];
  if (from !== to) {
    // Walk the registry from `from` to `to`, applying each version's codemods in order.
    let current = from;
    for (const step of versionsBetween(from, to)) {
      const codemods = step.codemodsFrom[current] ?? [];
      for (const codemod of codemods) changes.push(...codemod.apply(doc));
      current = step.version;
    }
  }
  return { doc, from, to, changes, issues };
}

function versionsBetween(from: number, to: number) {
  return findSpecVersion(to) && from < to
    ? [findSpecVersion(to)].filter((v): v is NonNullable<typeof v> => v !== undefined)
    : [];
}
