import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { characterJsonSchema, rosterJsonSchema, stringifySchema } from './json-schema.ts';

const PKG = resolve(import.meta.dirname, '../..');

describe('generated files are committed and current', () => {
  it('schema/character.schema.json matches the Zod schema (run gen:schemas after a schema change)', () => {
    const committed = readFileSync(resolve(PKG, 'schema/character.schema.json'), 'utf8');
    expect(committed).toBe(stringifySchema(characterJsonSchema()));
  });

  it('schema/roster.schema.json matches the Zod schema', () => {
    const committed = readFileSync(resolve(PKG, 'schema/roster.schema.json'), 'utf8');
    expect(committed).toBe(stringifySchema(rosterJsonSchema()));
  });

  it('the character JSON Schema lists every field of the spec', () => {
    const schema = characterJsonSchema() as {
      $defs: { Character: { properties: Record<string, unknown>; required: string[] } };
    };
    const props = Object.keys(schema.$defs.Character.properties).sort();
    expect(props).toEqual(
      [
        'schemaVersion',
        'name',
        'displayName',
        'role',
        'kind',
        'reportsTo',
        'parent',
        'description',
        'model',
        'fallbackModel',
        'effort',
        'permissionMode',
        'maxParallelSessions',
        'tools',
        'mcpServers',
        'access',
        'plugins',
        'skills',
        'memory',
        'budget',
        'escalation',
        'denyList',
        'linearLabel',
        'subCharacters',
      ].sort(),
    );
    expect(schema.$defs.Character.required).toEqual(
      expect.arrayContaining([
        'schemaVersion',
        'name',
        'displayName',
        'role',
        'kind',
        'reportsTo',
        'description',
      ]),
    );
  });

  const SPAWN = { timeout: 60_000 };

  it('fixtures/valid/roster.json is current (gen:fixtures --check)', SPAWN, () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/gen-fixtures.ts', '--check'], {
        cwd: PKG,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it(
    'plan.json agents[] converts to 37 characters that agree with the golden fixtures (convert:plan --check)',
    SPAWN,
    () => {
      const out = execFileSync(process.execPath, ['scripts/convert-plan.ts', '--check'], {
        cwd: PKG,
        stdio: 'pipe',
        encoding: 'utf8',
      });
      expect(out).toBe('');
    },
  );

  it('pnpm validate exits 1 on an invalid fixture and 0 on the golden set', SPAWN, () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/validate.ts', 'fixtures/valid', '--quiet'], {
        cwd: PKG,
        stdio: 'pipe',
      }),
    ).not.toThrow();
    expect(() =>
      execFileSync(
        process.execPath,
        ['scripts/validate.ts', 'fixtures/invalid/cycle.yaml', '--quiet'],
        { cwd: PKG, stdio: 'pipe' },
      ),
    ).toThrow();
  });
});
