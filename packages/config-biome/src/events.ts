/**
 * `@paperos/config-biome/events` — the `no-publish-outside-transaction` check (PAP-555).
 *
 * `publish()` must be given a **transaction** handle, so the outbox row and the row change it
 * describes commit or roll back together. The mistake this catches is passing the connection
 * handle `db` where a transaction handle belongs: it compiles, it passes review at a glance, and
 * it writes events for row changes that were rolled back.
 *
 * Biome 2.5's plugin surface is GritQL patterns only: a `.grit` plugin can match the call shape
 * (`plugins/no-publish-outside-transaction.grit`, shipped here) but Biome cannot yet load a
 * plugin from a package subpath, and wiring one into the root `biome.json` is an edit to a file
 * this issue does not own. Until that lands, the enforcing gate is the scanner below, run over
 * the whole repository by a Vitest fixture test
 * (`packages/db/src/no-publish-outside-transaction.test.ts`). ADR 0013 records the choice.
 *
 * The scanner is a string check on purpose: no AST, no dependency, runs in milliseconds over the
 * tree, and is trivially portable to a real Biome rule or to dependency-cruiser (PAP-305).
 */

/** Handle names that are connection-level, never a transaction. */
export const CONNECTION_HANDLE_NAMES: readonly string[] = [
  'db',
  'database',
  'client',
  'pool',
  'conn',
  'connection',
  'this.db',
  'this.database',
  'this.client',
  'ctx.db',
  'context.db',
  'deps.db',
];

export interface PublishLintFinding {
  readonly file: string;
  /** 1-based. */
  readonly line: number;
  readonly handle: string;
  readonly text: string;
  readonly message: string;
}

const IGNORE_MARKER = 'paperos-allow-publish-handle';

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PATTERN = new RegExp(
  `\\bpublish\\s*\\(\\s*(${CONNECTION_HANDLE_NAMES.map(escapeForRegex).join('|')})\\s*,`,
  'g',
);

/**
 * Every `publish(<connection handle>, ...)` in one file's source.
 * A line carrying `// paperos-allow-publish-handle` is skipped (documentation and this file).
 */
export function findPublishOutsideTransaction(
  source: string,
  file = '<source>',
): PublishLintFinding[] {
  const findings: PublishLintFinding[] = [];
  const lines = source.split('\n');
  for (const [index, line] of lines.entries()) {
    if (line.includes(IGNORE_MARKER)) continue;
    PATTERN.lastIndex = 0;
    let match = PATTERN.exec(line);
    while (match !== null) {
      const handle = match[1] ?? 'db';
      findings.push({
        file,
        line: index + 1,
        handle,
        text: line.trim(),
        message: `publish(${handle}, ...) uses a connection handle: wrap the row change and the publish in db.transaction(async (tx) => ...) (or withTenant) so the event and the row commit together`,
      });
      match = PATTERN.exec(line);
    }
  }
  return findings;
}

/** One human-readable block, ready to put in a test failure or a CI annotation. */
export function formatPublishFindings(findings: readonly PublishLintFinding[]): string {
  return findings.map((f) => `${f.file}:${f.line}  ${f.text}\n    ${f.message}`).join('\n');
}
