import { describe, expect, it } from 'vitest';
import { EnvSecretStore, maskSecret } from './node.js';

describe('EnvSecretStore', () => {
  it('has()/get() treat an unset key and an empty-string key the same: absent', () => {
    const store = new EnvSecretStore({ SET_KEY: 'value', EMPTY_KEY: '' });
    expect(store.has('SET_KEY')).toBe(true);
    expect(store.get('SET_KEY')).toBe('value');
    expect(store.has('EMPTY_KEY')).toBe(false);
    expect(store.get('EMPTY_KEY')).toBeUndefined();
    expect(store.has('MISSING_KEY')).toBe(false);
    expect(store.get('MISSING_KEY')).toBeUndefined();
  });

  it('list() reports only the names that are actually set, never values', () => {
    const store = new EnvSecretStore({ A: '1', B: '', C: '3' });
    expect(store.list(['A', 'B', 'C', 'D'])).toEqual(['A', 'C']);
  });

  it('defaults its source to process.env', () => {
    process.env.PAPEROS_TEST_ENV_SECRET_STORE_PROBE = 'present';
    try {
      expect(new EnvSecretStore().has('PAPEROS_TEST_ENV_SECRET_STORE_PROBE')).toBe(true);
    } finally {
      delete process.env.PAPEROS_TEST_ENV_SECRET_STORE_PROBE;
    }
  });
});

describe('maskSecret', () => {
  it('keeps only the last 4 characters visible for a long value', () => {
    const value = 'sk_live_51H0000000000000009f2c';
    const masked = maskSecret(value);
    expect(masked).toHaveLength(value.length);
    expect(masked.endsWith('9f2c')).toBe(true);
    expect(masked.slice(0, -4)).toBe('*'.repeat(value.length - 4));
  });

  it('masks a short value entirely rather than revealing it whole', () => {
    expect(maskSecret('abc')).toBe('***');
  });

  it('never returns the original value', () => {
    const value = 'super-secret-value';
    expect(maskSecret(value)).not.toBe(value);
    expect(maskSecret(value)).not.toContain(value.slice(0, -4));
  });
});
