import { describe, expect, it } from 'vitest';
import { WebSecretStore } from './web.js';

describe('WebSecretStore', () => {
  it('round-trips get/set/delete', async () => {
    const store = new WebSecretStore('shell');
    expect(await store.get('token')).toBeUndefined();

    await store.set('token', 'abc123');
    expect(await store.get('token')).toBe('abc123');

    await store.delete('token');
    expect(await store.get('token')).toBeUndefined();
  });

  it("list() returns bare names, immediately, for the store's own app only", async () => {
    const shell = new WebSecretStore('shell');
    const other = new WebSecretStore('other-app');
    await shell.set('a', '1');
    await shell.set('b', '2');
    await other.set('a', 'from-other-app');

    expect(new Set(await shell.list())).toEqual(new Set(['a', 'b']));
  });

  it('is never persisted: a fresh instance starts empty even after writes to a previous one', async () => {
    const first = new WebSecretStore('shell');
    await first.set('token', 'abc123');

    const second = new WebSecretStore('shell');
    expect(await second.get('token')).toBeUndefined();
  });

  it('two writers to logically the same key: last write wins', async () => {
    const store = new WebSecretStore('shell');
    await store.set('token', 'first');
    await store.set('token', 'second');
    expect(await store.get('token')).toBe('second');
  });

  it('reports its target', () => {
    expect(new WebSecretStore().target).toBe('web');
  });
});
