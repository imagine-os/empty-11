/**
 * The enforcing half of `no-publish-outside-transaction` (PAP-555, ADR 0013): the fixture proves
 * the scanner catches the mistake, and the repository walk proves nobody has made it.
 *
 * It lives in `@paperos/db` because the scan needs `node:fs` and `@paperos/core` is pure
 * TypeScript with no Node globals. The rule itself is `@paperos/config-biome/events`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPublishOutsideTransaction, formatPublishFindings } from '@paperos/config-biome/events';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const fixtures = join(repoRoot, 'packages/core/src/events/fixtures');

const SKIP = new Set(['node_modules', 'dist', 'coverage', '.turbo', '.git', 'fixtures']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('no-publish-outside-transaction', () => {
  it('flags every connection handle in the bad fixture', () => {
    const source = readFileSync(join(fixtures, 'publish-outside-transaction.txt'), 'utf8');
    const findings = findPublishOutsideTransaction(source, 'publish-outside-transaction.txt');
    expect(findings.map((f) => f.handle)).toEqual(['db', 'ctx.db', 'client', 'this.db']);
    expect(findings[0]?.message).toContain('db.transaction');
  });

  it('does not flag the correct fixture', () => {
    const source = readFileSync(join(fixtures, 'publish-inside-transaction.txt'), 'utf8');
    expect(findPublishOutsideTransaction(source, 'publish-inside-transaction.txt')).toEqual([]);
  });

  it('does not flag a publish on a transaction handle', () => {
    expect(findPublishOutsideTransaction('await publish(tx, event);')).toEqual([]);
    expect(findPublishOutsideTransaction('await publish(trx, event);')).toEqual([]);
  });

  it('finds nothing in the repository', () => {
    const findings = sourceFiles(join(repoRoot, 'packages'))
      .concat(sourceFiles(join(repoRoot, 'apps')))
      .concat(sourceFiles(join(repoRoot, 'scripts')))
      .concat(sourceFiles(join(repoRoot, 'examples')))
      .flatMap((file) =>
        findPublishOutsideTransaction(readFileSync(file, 'utf8'), relative(repoRoot, file)),
      );
    expect(formatPublishFindings(findings)).toBe('');
  });
});
