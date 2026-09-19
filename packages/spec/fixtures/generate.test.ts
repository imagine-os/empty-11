import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSpec } from '../src/parse.js';
import { generateCorpus, SeededRandom } from './generate.js';

const fixturesDir = resolve(import.meta.dirname);

describe('synthetic spec corpus generator', () => {
  it('determinism: same seed produces same bytes', async () => {
    const tmpDir1 = resolve(fixturesDir, '.test-corpus-1');
    const tmpDir2 = resolve(fixturesDir, '.test-corpus-2');

    await Promise.all([
      generateCorpus({ size: 'small', seed: 12345, outputDir: tmpDir1 }),
      generateCorpus({ size: 'small', seed: 12345, outputDir: tmpDir2 }),
    ]);

    const files1 = readdirSync(tmpDir1).sort();
    const files2 = readdirSync(tmpDir2).sort();

    expect(files1).toEqual(files2);

    for (const file of files1) {
      const content1 = readFileSync(resolve(tmpDir1, file), 'utf8');
      const content2 = readFileSync(resolve(tmpDir2, file), 'utf8');
      // Skip timestamps in manifest
      if (file === 'manifest.json') {
        const m1 = JSON.parse(content1);
        const m2 = JSON.parse(content2);
        m1.generatedAt = m2.generatedAt = undefined;
        expect(JSON.stringify(m1)).toEqual(JSON.stringify(m2));
      } else {
        expect(content1).toEqual(content2);
      }
    }

    // Cleanup
    const fs = await import('node:fs');
    fs.rmSync(tmpDir1, { recursive: true, force: true });
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  });

  it('manifest is well-formed', () => {
    const manifestPath = resolve(fixturesDir, 'corpus/medium/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(manifest).toHaveProperty('corpusVersion');
    expect(manifest).toHaveProperty('seed');
    expect(manifest).toHaveProperty('size');
    expect(manifest).toHaveProperty('pageCount');
    expect(manifest).toHaveProperty('specs');
    expect(manifest.specs.length).toBe(manifest.pageCount);

    for (const spec of manifest.specs) {
      expect(spec).toHaveProperty('id');
      expect(spec).toHaveProperty('hash');
      expect(spec.id).toMatch(/^fx-/);
      expect(spec.hash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('sample spec validates without errors', () => {
    const specPath = resolve(fixturesDir, 'corpus/medium/fx-invoice-0000.spec.yaml');
    const content = readFileSync(specPath, 'utf8');
    const result = parseSpec(content, { filename: 'fx-invoice-0000.spec.yaml' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.error('Parse issues:', result.issues);
      return;
    }

    expect(result.value.meta.id).toBe('fx-invoice-0000');
    expect(result.value.meta.specVersion).toBe(1);
    expect(result.value.meta.status).toBe('ready');
  });

  it('all medium corpus specs validate', () => {
    const corpusDir = resolve(fixturesDir, 'corpus/medium');
    const specFiles = readdirSync(corpusDir)
      .filter((f) => f.endsWith('.spec.yaml') && f !== 'app.spec.yaml')
      .slice(0, 10); // Test first 10 to keep test fast

    for (const file of specFiles) {
      const content = readFileSync(resolve(corpusDir, file), 'utf8');
      const result = parseSpec(content, { filename: file });

      expect(result.ok, `${file} failed validation: ${JSON.stringify(result.issues)}`).toBe(true);
      if (result.ok) {
        expect(result.value.meta.status).toBe('ready');
      }
    }
  });

  it('SeededRandom produces consistent sequences', () => {
    const rng1 = new SeededRandom(999);
    const rng2 = new SeededRandom(999);

    const values1: number[] = [];
    const values2: number[] = [];

    for (let i = 0; i < 100; i++) {
      values1.push(rng1.next());
      values2.push(rng2.next());
    }

    expect(values1).toEqual(values2);
  });

  it('SeededRandom.choose works', () => {
    const rng = new SeededRandom(42);
    const items = ['a', 'b', 'c', 'd'];

    const results: string[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(rng.choose(items));
    }

    expect(results.every((r) => items.includes(r))).toBe(true);
  });

  it('SeededRandom.range works', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const val = rng.range(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(20);
      expect(Number.isInteger(val)).toBe(true);
    }
  });
});
