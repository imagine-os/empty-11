import { afterEach, describe, expect, it } from 'vitest';
import {
  envFileNameForMode,
  isBrowserLike,
  parseDotEnv,
  readNodeEnv,
  setNodeEnvFileReader,
} from './env-source.js';

describe('parseDotEnv', () => {
  it('reads KEY=VALUE pairs, skipping comments and blank lines', () => {
    const parsed = parseDotEnv(['# a comment', '', 'A=1', 'B=hello world'].join('\n'));
    expect(parsed).toEqual({ A: '1', B: 'hello world' });
  });

  it('strips a single matching pair of quotes', () => {
    expect(parseDotEnv('A="quoted"\nB=\'single\'')).toEqual({
      A: 'quoted',
      B: 'single',
    });
  });

  it('ignores lines with no "="', () => {
    expect(parseDotEnv('not a line\nA=1')).toEqual({ A: '1' });
  });
});

describe('envFileNameForMode', () => {
  it('is .env.test for test mode', () => {
    expect(envFileNameForMode('test')).toBe('.env.test');
  });

  it('is .env.local for every other mode', () => {
    expect(envFileNameForMode('development')).toBe('.env.local');
    expect(envFileNameForMode('production')).toBe('.env.local');
  });
});

describe('readNodeEnv', () => {
  afterEach(() => {
    setNodeEnvFileReader(undefined);
  });

  it('with no reader registered, is just process.env — never throws, never touches a file', () => {
    expect(readNodeEnv({ NODE_ENV: 'test', SOMETHING: 'x' })).toEqual({
      NODE_ENV: 'test',
      SOMETHING: 'x',
    });
  });

  it('calls the registered reader with the current NODE_ENV as "mode"', () => {
    const seenModes: string[] = [];
    setNodeEnvFileReader((mode) => {
      seenModes.push(mode);
      return { FROM_FILE: `file-for-${mode}` };
    });

    readNodeEnv({ NODE_ENV: 'test' });

    expect(seenModes).toEqual(['test']);
  });

  it('real process.env values win over whatever the reader returns', () => {
    setNodeEnvFileReader(() => ({ FROM_FILE: 'file-value' }));

    const result = readNodeEnv({ NODE_ENV: 'test', FROM_FILE: 'shell-value' });

    expect(result.FROM_FILE).toBe('shell-value');
  });

  it('defaults NODE_ENV to development when unset', () => {
    const seenModes: string[] = [];
    setNodeEnvFileReader((mode) => {
      seenModes.push(mode);
      return {};
    });

    readNodeEnv({});

    expect(seenModes).toEqual(['development']);
  });
});

describe('isBrowserLike', () => {
  it('is false with no document', () => {
    expect(isBrowserLike({})).toBe(false);
  });

  it('is true once a document exists', () => {
    expect(isBrowserLike({ document: {} })).toBe(true);
  });
});
