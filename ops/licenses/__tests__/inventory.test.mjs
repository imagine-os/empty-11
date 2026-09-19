import { describe, expect, it } from 'vitest';
import { buildInventory, contextOfProject, flattenLicenses, walkTree } from '../lib/inventory.mjs';
import { detectLicenseFromText } from '../lib/text.mjs';
import { fixture, loadRealPolicy } from './helpers.mjs';

const policy = loadRealPolicy();

describe('contextOfProject', () => {
  it('maps a workspace project onto its usage context', () => {
    expect(contextOfProject(policy, 'apps/web')).toBe('bundled');
    expect(contextOfProject(policy, 'apps/api')).toBe('server');
    expect(contextOfProject(policy, '/somewhere/else/apps/desktop')).toBe('bundled');
    expect(contextOfProject(policy, 'packages/core')).toBeNull();
  });
});

describe('walkTree', () => {
  it("follows workspace links so a package's own dependencies inherit the app's context", () => {
    const [web] = fixture('clean', 'ls-prod.json');
    expect([...walkTree(web).keys()].sort()).toEqual(['drizzle-orm@0.45.2', 'react@19.3.0']);
  });
});

describe('flattenLicenses', () => {
  it('produces one row per name and version', () => {
    const flat = flattenLicenses(fixture('clean', 'licenses-all.json'));
    expect(flat.get('react@19.3.0')).toMatchObject({ name: 'react', license: 'MIT' });
    expect(flat.size).toBe(3);
  });
});

describe('buildInventory', () => {
  const inventory = buildInventory({
    policy,
    root: '/repo',
    licensesAll: fixture('gpl-dev-tool', 'licenses-all.json'),
    licensesProd: fixture('gpl-dev-tool', 'licenses-prod.json'),
    lsProd: fixture('gpl-dev-tool', 'ls-prod.json'),
    readText: () => null,
  });
  const find = (name) => inventory.find((entry) => entry.package === name);

  it("puts an app's production dependencies in the app's context", () => {
    expect(find('react').contexts).toEqual(['bundled']);
    expect(find('drizzle-orm').contexts).toEqual(['bundled']);
  });

  it('leaves everything nothing shippable reaches in dev', () => {
    expect(find('vitest').contexts).toEqual(['dev']);
    expect(find('gpl-cli').contexts).toEqual(['dev']);
    expect(find('gpl-cli').production).toBe(false);
  });
});

describe('detectLicenseFromText', () => {
  it('tells 0BSD and ISC apart by the copyright proviso', () => {
    expect(
      detectLicenseFromText(
        'Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.',
      ),
    ).toBe('0BSD');
    expect(
      detectLicenseFromText(
        'Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.',
      ),
    ).toBe('ISC');
  });

  it('recognises the texts the policy cares most about', () => {
    expect(
      detectLicenseFromText('GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007'),
    ).toBe('AGPL-3.0-or-later');
    expect(detectLicenseFromText('Server Side Public License VERSION 1')).toBe('SSPL-1.0');
    expect(detectLicenseFromText('Business Source License 1.1 Parameters')).toBe('BUSL-1.1');
  });

  it('flags a Commons Clause rider on top of the base licence', () => {
    expect(
      detectLicenseFromText(
        'Apache License Version 2.0 ... "Commons Clause" License Condition v1.0',
      ),
    ).toBe('Apache-2.0 WITH Commons-Clause');
  });

  it('returns null rather than guessing', () => {
    expect(detectLicenseFromText('Copyright 2026. All rights reserved.')).toBeNull();
    expect(detectLicenseFromText('')).toBeNull();
    expect(detectLicenseFromText(null)).toBeNull();
  });
});

describe('workspace packages', () => {
  it('are never scanned as third parties — their licence is NJ-7, not this gate', () => {
    const licensesAll = {
      MIT: [{ name: 'react', versions: ['19.3.0'], paths: [], license: 'MIT' }],
      UNLICENSED: [{ name: '@paperos/web', versions: ['0.1.0'], paths: [], license: 'UNLICENSED' }],
    };
    const inventory = buildInventory({
      policy,
      root: '/repo',
      licensesAll,
      licensesProd: {},
      lsProd: fixture('clean', 'ls-prod.json'),
      readText: () => null,
    });
    expect(inventory.map((entry) => entry.package)).toEqual(['react']);
  });
});
