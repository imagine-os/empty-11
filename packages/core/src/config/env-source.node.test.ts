import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNodeEnv, setNodeEnvFileReader } from './env-source.js';
import { findRepoRoot, nodeDotEnvFileReader } from './env-source.node.js';

describe('findRepoRoot', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'paperos-env-'));
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds the workspace root from a nested directory', () => {
    const nested = join(root, 'apps', 'web', 'src');
    expect(findRepoRoot(nested)).toBe(root);
  });

  it('finds it from the root itself', () => {
    expect(findRepoRoot(root)).toBe(root);
  });

  it('returns undefined when no pnpm-workspace.yaml exists above startDir', () => {
    expect(findRepoRoot('/')).toBeUndefined();
  });
});

describe('nodeDotEnvFileReader', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'paperos-env-'));
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads .env.test for the "test" mode, never .env.local', () => {
    writeFileSync(join(root, '.env.test'), 'FROM_FILE=test-value\n');
    writeFileSync(join(root, '.env.local'), 'FROM_FILE=local-value\n');

    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(nodeDotEnvFileReader('test')).toEqual({ FROM_FILE: 'test-value' });
    } finally {
      process.chdir(cwd);
    }
  });

  it('reads .env.local for a non-test mode, never .env.test', () => {
    writeFileSync(join(root, '.env.test'), 'FROM_FILE=test-value\n');
    writeFileSync(join(root, '.env.local'), 'FROM_FILE=local-value\n');

    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(nodeDotEnvFileReader('development')).toEqual({ FROM_FILE: 'local-value' });
    } finally {
      process.chdir(cwd);
    }
  });

  it('is quiet ({}) when no file exists at all', () => {
    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(nodeDotEnvFileReader('test')).toEqual({});
    } finally {
      process.chdir(cwd);
    }
  });
});

describe('readNodeEnv wired to the real file-backed reader (env-source.node.ts imported)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'paperos-env-'));
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(join(root, '.env.test'), 'FROM_FILE=test-value\n');
    writeFileSync(join(root, '.env.local'), 'FROM_FILE=local-value\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    setNodeEnvFileReader(nodeDotEnvFileReader); // restore: importing this file re-registers it anyway
  });

  it('end to end: NODE_ENV=test reads .env.test, never .env.local', () => {
    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(readNodeEnv({ NODE_ENV: 'test' }).FROM_FILE).toBe('test-value');
    } finally {
      process.chdir(cwd);
    }
  });

  it('end to end: a non-test mode reads .env.local, never .env.test', () => {
    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(readNodeEnv({ NODE_ENV: 'development' }).FROM_FILE).toBe('local-value');
    } finally {
      process.chdir(cwd);
    }
  });
});
