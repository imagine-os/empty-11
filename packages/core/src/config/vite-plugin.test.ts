import { describe, expect, it } from 'vitest';
import { findEnvLeaks, isExemptModule, paperosEnvGuard } from './vite-plugin.js';

describe('findEnvLeaks', () => {
  it('finds a non-VITE_ import.meta.env read', () => {
    expect(findEnvLeaks('const leak = import.meta.env.SECRET;')).toEqual([
      'import.meta.env.SECRET',
    ]);
  });

  it('never flags a VITE_-prefixed read', () => {
    expect(findEnvLeaks('const ok = import.meta.env.VITE_API_URL;')).toEqual([]);
  });

  it('finds any process.env read, dot or bracket access', () => {
    const leaks = findEnvLeaks(
      'const a = process.env.DATABASE_URL;\nconst b = process.env["SECRET"];',
    );
    expect(leaks).toContain('process.env.DATABASE_URL');
    expect(leaks.some((leak) => leak.startsWith('process.env['))).toBe(true);
  });

  it('is clean for ordinary client code', () => {
    expect(findEnvLeaks('export function App() { return null; }')).toEqual([]);
  });

  it('deduplicates repeated offenders', () => {
    expect(findEnvLeaks('a(process.env.X); b(process.env.X);')).toEqual(['process.env.X']);
  });
});

describe('isExemptModule', () => {
  it('exempts anything under packages/core/src/config/', () => {
    expect(isExemptModule('/repo/packages/core/src/config/load.ts')).toBe(true);
  });

  it('exempts node_modules unconditionally', () => {
    expect(isExemptModule('/repo/node_modules/some-lib/index.js')).toBe(true);
  });

  it('does not exempt ordinary app source', () => {
    expect(isExemptModule('/repo/apps/web/src/App.tsx')).toBe(false);
  });

  it('honours extra allowed segments', () => {
    expect(isExemptModule('/repo/apps/web/src/fixtures/leak.ts', ['fixtures/'])).toBe(true);
  });

  it('normalizes Windows-style separators before matching', () => {
    expect(isExemptModule('C:\\repo\\packages\\core\\src\\config\\load.ts')).toBe(true);
  });
});

describe('paperosEnvGuard (as a Vite transform hook)', () => {
  const plugin = paperosEnvGuard();
  const transform = plugin.transform as (
    this: { error: (message: string) => never },
    code: string,
    id: string,
  ) => string | null;

  function run(code: string, id: string): { threw: boolean; message?: string } {
    try {
      transform.call(
        {
          error(message: string): never {
            throw new Error(message);
          },
        },
        code,
        id,
      );
      return { threw: false };
    } catch (error) {
      return { threw: true, message: (error as Error).message };
    }
  }

  it('fails a stray SECRET= read in application source', () => {
    const result = run('const leaked = import.meta.env.SECRET;', '/repo/apps/web/src/App.tsx');
    expect(result.threw).toBe(true);
    expect(result.message).toContain('import.meta.env.SECRET');
  });

  it('passes clean application source', () => {
    const result = run('const url = import.meta.env.VITE_API_URL;', '/repo/apps/web/src/App.tsx');
    expect(result.threw).toBe(false);
  });

  it('does not scan the config folder itself, even though it legitimately reads process.env', () => {
    const result = run(
      'export const x = process.env.DATABASE_URL;',
      '/repo/packages/core/src/config/env-source.ts',
    );
    expect(result.threw).toBe(false);
  });
});
