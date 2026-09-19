import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { checkEnvExample, formatEnvCheckTable } from './env-check.js';
import { findRepoRoot } from './env-source.node.js';
import { registerServerEnvExtension, resetConfigRegistry } from './registry.js';

const FULL_EXAMPLE = `
VITE_API_URL=https://api.example.test
VITE_APP_NAME=PaperOS
VITE_GIT_SHA=dev
VITE_ELECTRIC_URL=https://electric.example.test
VITE_YJS_URL=wss://yjs.example.test
VITE_SENTRY_DSN=
VITE_FLAGS=

NODE_ENV=development
DATABASE_URL=postgres://app@localhost:5432/paperos
DATABASE_URL_MIGRATOR=postgres://migrator@localhost:5432/paperos
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=dev
S3_SECRET_KEY=dev
S3_BUCKET=paperos-dev
BETTER_AUTH_SECRET=dev-secret
BETTER_AUTH_URL=http://localhost:3000
STRIPE_SECRET_KEY=
OTEL_EXPORTER_OTLP_ENDPOINT=
APP_ENCRYPTION_KEY=
`;

describe('checkEnvExample', () => {
  afterEach(() => {
    resetConfigRegistry();
  });

  it('passes when every schema key is declared', () => {
    const result = checkEnvExample(FULL_EXAMPLE);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('fails with a table naming the removed key and its schema when one is dropped', () => {
    const withoutIt = FULL_EXAMPLE.replace(/^VITE_API_URL=.*$/m, '');
    const result = checkEnvExample(withoutIt);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([{ key: 'VITE_API_URL', source: 'public' }]);
    expect(formatEnvCheckTable(result)).toContain('VITE_API_URL');
    expect(formatEnvCheckTable(result)).toContain('public schema');
  });

  it('a registered extension key must also be declared', () => {
    registerServerEnvExtension(
      'data-layer',
      z.object({ DATABASE_URL_ELECTRIC: z.string().min(1) }),
    );
    const result = checkEnvExample(FULL_EXAMPLE);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([{ key: 'DATABASE_URL_ELECTRIC', source: 'server' }]);
  });

  it('an extra, unknown key is reported but never fails the check', () => {
    const result = checkEnvExample(`${FULL_EXAMPLE}\nBASE_PATH=/\n`);
    expect(result.ok).toBe(true);
    expect(result.extra).toContain('BASE_PATH');
  });

  it("the repo's real .env.example passes today", () => {
    const root = findRepoRoot();
    expect(root).toBeDefined();
    const contents = readFileSync(`${root}/.env.example`, 'utf8');
    const result = checkEnvExample(contents);
    expect(formatEnvCheckTable(result)).not.toMatch(/missing/);
    expect(result.ok).toBe(true);
  });
});
