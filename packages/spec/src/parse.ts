/**
 * `parseSpec`: YAML text → validated `PageSpec`, with line and column on every issue.
 *
 * Normalises BOM and CRLF, resolves anchors and merge keys before validation,
 * reports duplicate mapping keys with both positions, warns over 200 KB and
 * when the first line does not point editors at the JSON Schema.
 */
import { LineCounter, parseDocument } from 'yaml';
import type { SpecIssue } from './issues.js';
import { err, ok, type Result } from './result.js';
import type { PageSpec } from './schema/page.js';
import { type ValidateOptions, validatePageSpec } from './validate.js';
import { createLocator, findDuplicateKeys } from './yaml/positions.js';

export const SPEC_SIZE_LIMIT_BYTES = 200 * 1024;

/** The header every spec starts with, relative path to the JSON Schema filled in. */
export const SCHEMA_HEADER_RE = /^#\s*yaml-language-server:\s*\$schema=\S+/;

export interface ParseOptions extends Omit<ValidateOptions, 'locator'> {
  /** Size above which `SPEC_TOO_LARGE` is raised. Default 200 KB. */
  sizeLimitBytes?: number;
}

export type ParseResult = Result<PageSpec, SpecIssue[]>;

/** Strip a UTF-8 BOM and normalise CRLF / CR line endings to LF. */
export function normaliseSource(source: string): string {
  const withoutBom = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  return withoutBom.replace(/\r\n?/g, '\n');
}

export function parseSpec(source: string, options: ParseOptions = {}): ParseResult {
  const text = normaliseSource(source);
  const pre: SpecIssue[] = [];

  const bytes = Buffer.byteLength(text, 'utf8');
  const limit = options.sizeLimitBytes ?? SPEC_SIZE_LIMIT_BYTES;
  if (bytes > limit) {
    pre.push({
      code: 'SPEC_TOO_LARGE',
      severity: 'warning',
      message: `spec is ${Math.round(bytes / 1024)} KB, over the ${Math.round(limit / 1024)} KB guideline`,
      path: '',
      line: 1,
      col: 1,
      hint: 'split sub-flows into their own pages and link them with `events`',
    });
  }

  const firstLine = text.split('\n', 1)[0] ?? '';
  if (!SCHEMA_HEADER_RE.test(firstLine)) {
    pre.push({
      code: 'SPEC_SCHEMA_HEADER',
      severity: 'warning',
      message: 'first line does not point editors at the JSON Schema',
      path: '',
      line: 1,
      col: 1,
      hint: 'make the first line `# yaml-language-server: $schema=<relative path>/page.spec.schema.json`',
    });
  }

  const lines = new LineCounter();
  const doc = parseDocument(text, {
    lineCounter: lines,
    uniqueKeys: false,
    merge: true,
    prettyErrors: false,
  });

  if (doc.errors.length > 0) {
    for (const error of doc.errors) {
      const offset = error.pos[0];
      const { line, col } = lines.linePos(offset);
      pre.push({
        code: 'SPEC_PARSE',
        severity: 'error',
        message: error.message.trim(),
        path: '',
        line,
        col,
      });
    }
    return err(
      pre.filter((i) => i.severity === 'error'),
      pre,
    );
  }

  for (const duplicate of findDuplicateKeys(doc, lines)) {
    const [first, ...rest] = duplicate.occurrences;
    const last = rest[rest.length - 1] ?? first;
    if (!first || !last) continue;
    pre.push({
      code: 'SPEC_DUP_KEY',
      severity: 'error',
      message: `key \`${duplicate.key}\` is declared twice (lines ${duplicate.occurrences.map((o) => o.line).join(' and ')})`,
      path: duplicate.path,
      line: last.line,
      col: last.col,
      hint: 'keep one; YAML keeps the last value and drops the others silently',
      related: duplicate.occurrences.slice(0, -1),
    });
  }

  const value: unknown = doc.toJS({ mapAsMap: false });
  const { sizeLimitBytes: _ignored, ...validateOptions } = options;
  const result = validatePageSpec(value, {
    ...validateOptions,
    locator: createLocator(doc, lines),
  });

  const issues = [...pre, ...result.issues];
  const errors = issues.filter((i) => i.severity === 'error');
  if (!result.ok || errors.length > 0) return err(errors, issues);
  return ok(result.value, issues);
}
