// Generated files must match their sources (RUB-DOC-07).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateDocs, generateSchemas, stableJson } from '../scripts/generate.js';
import { DOCS_RUBRICS, SCHEMAS_DIR } from '../scripts/paths.js';
import { allRubricItems, RUBRICS } from '../src/rubrics.js';

describe('generated artefacts are current', () => {
  it('schemas/*.schema.json match the Zod sources', () => {
    for (const [name, schema] of Object.entries(generateSchemas())) {
      expect(readFileSync(resolve(SCHEMAS_DIR, name), 'utf8'), name).toBe(stableJson(schema));
    }
    expect(readFileSync(resolve(DOCS_RUBRICS, 'finding.schema.json'), 'utf8')).toBe(
      stableJson(generateSchemas()['finding.schema.json']),
    );
  });
  it('docs/quality/rubrics/<domain>.md match the rubric JSON', () => {
    for (const [name, text] of Object.entries(generateDocs())) {
      expect(readFileSync(resolve(DOCS_RUBRICS, name), 'utf8'), name).toBe(text);
    }
  });
  it('the hand-written docs exist and link every domain', () => {
    for (const f of ['README.md', 'severity.md', 'review-comment-template.md'])
      expect(existsSync(resolve(DOCS_RUBRICS, f)), f).toBe(true);
    const readme = readFileSync(resolve(DOCS_RUBRICS, 'README.md'), 'utf8');
    for (const r of Object.values(RUBRICS)) expect(readme).toContain(`${r.domain}.md`);
    expect(readme).toContain('severity.md');
    expect(readme).toContain('finding.schema.json');
  });
  it('relative links in docs/quality/rubrics resolve', () => {
    const files = readdirSync(DOCS_RUBRICS).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const text = readFileSync(resolve(DOCS_RUBRICS, f), 'utf8');
      for (const m of text.matchAll(/\]\((\.{1,2}\/[^)#\s]+)/g)) {
        const target = resolve(DOCS_RUBRICS, m[1] as string);
        expect(existsSync(target), `${f} -> ${m[1]}`).toBe(true);
      }
    }
  });
  it('every rubric id appears in its generated doc', () => {
    for (const r of Object.values(RUBRICS)) {
      const text = readFileSync(resolve(DOCS_RUBRICS, `${r.domain}.md`), 'utf8');
      for (const item of r.items) expect(text).toContain(item.id);
    }
    expect(allRubricItems().length).toBeGreaterThan(0);
  });
});
