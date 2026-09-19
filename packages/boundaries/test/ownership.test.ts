/**
 * `ownership.json` schema fixtures (PAP-305).
 */

import { findAllowedDepCycles, matchesDep, parseOwnership } from '@paperos/core';
import { describe, expect, it } from 'vitest';
import { loadOwnership } from '../src/repo.js';
import { fixtureOwnership } from './helpers.js';

function errorsOf(input: unknown): string[] {
  const result = parseOwnership(input);
  return result.ok ? [] : result.errors.map((error) => `${error.path}: ${error.message}`);
}

describe('parseOwnership', () => {
  it('accepts a well-formed map', () => {
    expect(parseOwnership(fixtureOwnership()).ok).toBe(true);
  });

  it("accepts the repo's own ownership.json", () => {
    expect(() => loadOwnership()).not.toThrow();
  });

  it('rejects an owner that is not a project key', () => {
    const map = fixtureOwnership();
    const packages = {
      ...map.packages,
      'packages/crm': { ...map.packages['packages/crm'], owner: 'marketing' },
    };
    expect(errorsOf({ ...map, packages }).join('\n')).toMatch(
      /packages\.packages\/crm\.owner: unknown owner "marketing"/,
    );
  });

  it('rejects an unknown kind and a non-boolean optional', () => {
    const map = fixtureOwnership();
    const packages = {
      ...map.packages,
      'packages/crm': { ...map.packages['packages/crm'], kind: 'library', optional: 'yes' },
    };
    const errors = errorsOf({ ...map, packages });
    expect(errors.some((error) => error.includes('.kind: must be one of'))).toBe(true);
    expect(errors.some((error) => error.includes('.optional: must be a boolean'))).toBe(true);
  });

  it('rejects an issue reference that is not a PAP key', () => {
    const map = fixtureOwnership();
    const packages = {
      ...map.packages,
      'packages/crm': { ...map.packages['packages/crm'], issues: ['CRM-1'] },
    };
    expect(errorsOf({ ...map, packages }).join('\n')).toMatch(/CRM-1 is not a PAP-<n> identifier/);
  });

  it('rejects an allowedDeps target that no entry defines', () => {
    const map = fixtureOwnership();
    const packages = {
      ...map.packages,
      'packages/crm': { ...map.packages['packages/crm'], allowedDeps: ['packages/ghost'] },
    };
    expect(errorsOf({ ...map, packages }).join('\n')).toMatch(
      /packages\/ghost matches no entry in "packages"/,
    );
  });

  it('rejects a package that lists itself', () => {
    const map = fixtureOwnership();
    const packages = {
      ...map.packages,
      'packages/crm': { ...map.packages['packages/crm'], allowedDeps: ['packages/crm'] },
    };
    expect(errorsOf({ ...map, packages }).join('\n')).toMatch(/must not list itself/);
  });

  it('rejects a cyclic allowed graph and names the loop', () => {
    const map = fixtureOwnership();
    const packages = {
      ...map.packages,
      'packages/crm': { ...map.packages['packages/crm'], allowedDeps: ['packages/finance'] },
      'packages/finance': { ...map.packages['packages/finance'], allowedDeps: ['packages/crm'] },
    };
    expect(errorsOf({ ...map, packages }).join('\n')).toMatch(/allowedDeps cycle: packages\//);
  });

  it('rejects a key outside apps/ and packages/', () => {
    const map = fixtureOwnership();
    const packages = { ...map.packages, 'tools/cli': map.packages['packages/crm'] };
    expect(errorsOf({ ...map, packages }).join('\n')).toMatch(
      /must be an apps\/\* or packages\/\* path/,
    );
  });
});

describe('matchesDep', () => {
  it('matches exact paths and one-level wildcards only', () => {
    expect(matchesDep('packages/core', 'packages/core')).toBe(true);
    expect(matchesDep('packages/contracts/*', 'packages/contracts/quality')).toBe(true);
    expect(matchesDep('packages/contracts/*', 'packages/contracts/quality/src')).toBe(false);
    expect(matchesDep('packages/core', 'packages/core-extra')).toBe(false);
  });
});

describe('findAllowedDepCycles', () => {
  it('finds nothing in an acyclic map', () => {
    expect(findAllowedDepCycles(fixtureOwnership().packages)).toEqual([]);
  });

  it('finds a two-package loop', () => {
    const cycles = findAllowedDepCycles({
      a: { allowedDeps: ['b'] },
      b: { allowedDeps: ['a'] },
    });
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(['a', 'b', 'a']);
  });
});
