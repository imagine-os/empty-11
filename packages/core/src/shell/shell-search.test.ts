import { describe, expect, it } from 'vitest';
import {
  INSPECTOR_DEFAULT,
  parseShellSearch,
  SIDEBAR_DEFAULT,
  validateShellSearch,
} from './shell-search.js';

describe('parseShellSearch', () => {
  it('accepts valid values unchanged', () => {
    expect(parseShellSearch({ inspector: 'open', sidebar: 'collapsed' })).toEqual({
      inspector: 'open',
      sidebar: 'collapsed',
    });
  });

  it('falls back to defaults for missing keys', () => {
    expect(parseShellSearch({})).toEqual({
      inspector: INSPECTOR_DEFAULT,
      sidebar: SIDEBAR_DEFAULT,
    });
  });

  it('falls back only the invalid field, keeping the other valid one', () => {
    expect(parseShellSearch({ inspector: 'sideways', sidebar: 'collapsed' })).toEqual({
      inspector: INSPECTOR_DEFAULT,
      sidebar: 'collapsed',
    });
  });

  it('falls back entirely for non-object input', () => {
    expect(parseShellSearch(null)).toEqual({
      inspector: INSPECTOR_DEFAULT,
      sidebar: SIDEBAR_DEFAULT,
    });
    expect(parseShellSearch('nope')).toEqual({
      inspector: INSPECTOR_DEFAULT,
      sidebar: SIDEBAR_DEFAULT,
    });
    expect(parseShellSearch(undefined)).toEqual({
      inspector: INSPECTOR_DEFAULT,
      sidebar: SIDEBAR_DEFAULT,
    });
  });

  it('validateShellSearch is the same behavior under the name createFileRoute expects', () => {
    expect(validateShellSearch({ inspector: 'open' })).toEqual({
      inspector: 'open',
      sidebar: SIDEBAR_DEFAULT,
    });
  });
});
