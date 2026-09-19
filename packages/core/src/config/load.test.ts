import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ConfigError, getPublicEnv, getServerEnv, loadConfig, resetLoadedConfig } from './load.js';
import { registerServerEnvExtension, resetConfigRegistry } from './registry.js';

const VALID_PUBLIC = {
  VITE_API_URL: 'https://api.example.test',
  VITE_APP_NAME: 'PaperOS',
  VITE_GIT_SHA: 'abc1234',
  VITE_ELECTRIC_URL: 'https://electric.example.test',
  VITE_YJS_URL: 'wss://yjs.example.test',
};

const VALID_SERVER = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://app@localhost:5432/paperos',
  DATABASE_URL_MIGRATOR: 'postgres://migrator@localhost:5432/paperos',
  S3_ENDPOINT: 'https://s3.example.test',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'paperos-dev',
  BETTER_AUTH_SECRET: 'a-secret-value',
  BETTER_AUTH_URL: 'https://auth.example.test',
};

function withEnv(vars: Record<string, string>, fn: () => void): void {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) original[key] = process.env[key];
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('config load', () => {
  beforeEach(() => {
    resetLoadedConfig();
    resetConfigRegistry();
  });

  afterEach(() => {
    resetLoadedConfig();
    resetConfigRegistry();
  });

  it('parses a fully valid environment', () => {
    withEnv({ ...VALID_PUBLIC, ...VALID_SERVER }, () => {
      expect(getPublicEnv().VITE_APP_NAME).toBe('PaperOS');
      expect(getServerEnv().DATABASE_URL).toBe(VALID_SERVER.DATABASE_URL);
    });
  });

  it('throws ConfigError naming the missing key, never a value, when a required key is absent', () => {
    withEnv({ ...VALID_PUBLIC, VITE_API_URL: '' }, () => {
      let caught: unknown;
      try {
        getPublicEnv();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ConfigError);
      const error = caught as ConfigError;
      expect(error.table.some((row) => row.key === 'VITE_API_URL')).toBe(true);
      expect(error.message).not.toContain('example.test');
    });
  });

  it('treats an empty string as missing, same as an absent key', () => {
    withEnv({ ...VALID_PUBLIC, VITE_APP_NAME: '' }, () => {
      expect(() => getPublicEnv()).toThrow(ConfigError);
    });
  });

  it('memoizes: a second call does not re-read the environment', () => {
    withEnv({ ...VALID_PUBLIC }, () => {
      const first = getPublicEnv();
      process.env.VITE_APP_NAME = 'Changed';
      const second = getPublicEnv();
      expect(second).toBe(first);
      expect(second.VITE_APP_NAME).toBe('PaperOS');
    });
  });

  it('loadConfig(web) validates only the public schema for a browser build', () => {
    withEnv({ ...VALID_PUBLIC }, () => {
      const config = loadConfig('web', { includeServer: false });
      expect(config.serverEnv).toBeUndefined();
      expect(config.publicEnv.VITE_APP_NAME).toBe('PaperOS');
    });
  });

  it('loadConfig(desktop) validates both schemas', () => {
    withEnv({ ...VALID_PUBLIC, ...VALID_SERVER }, () => {
      const config = loadConfig('desktop');
      expect(config.serverEnv?.DATABASE_URL).toBe(VALID_SERVER.DATABASE_URL);
    });
  });

  it('a registered extension key is required alongside the base schema', () => {
    registerServerEnvExtension(
      'data-layer',
      z.object({ DATABASE_URL_ELECTRIC: z.string().min(1) }),
    );
    withEnv({ ...VALID_PUBLIC, ...VALID_SERVER }, () => {
      expect(() => getServerEnv()).toThrow(ConfigError);
    });
    withEnv(
      { ...VALID_PUBLIC, ...VALID_SERVER, DATABASE_URL_ELECTRIC: 'postgres://electric' },
      () => {
        // The extension key is validated at runtime; TypeScript only knows the
        // base `ServerEnv` shape, so a consumer of an extension reads it through
        // its own typed schema (see the registry.ts doc comment).
        const env = getServerEnv() as unknown as Record<string, string>;
        expect(env.DATABASE_URL_ELECTRIC).toBe('postgres://electric');
      },
    );
  });
});
