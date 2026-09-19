/**
 * Rule generation: the shape of `.dependency-cruiser.cjs` and its freshness
 * (PAP-305).
 */

import { describe, expect, it } from 'vitest';
import { findStaleGeneratedFiles } from '../src/check.js';
import { findRepoRoot, loadOwnership } from '../src/repo.js';
import { generateBiomeBoundaries, generateRuleSet } from '../src/rules.js';
import { fixtureOwnership } from './helpers.js';

const repoRoot = findRepoRoot();

describe('generateRuleSet', () => {
  it('generates one allow-list rule per source and one cross-module rule per module', () => {
    const { forbidden } = generateRuleSet(fixtureOwnership());
    expect(forbidden.map((rule) => rule.name)).toMatchInlineSnapshot(`
      [
        "R9-no-circular",
        "R5-no-generated-or-sql",
        "R6-react-only-in-ui-layers",
        "R11-conformance-only-from-tests",
        "R12-core-barrel-reexports-folder-indexes",
        "R1-packages-core-allowed-deps",
        "R3-packages-finance-allowed-deps",
        "R3-packages-crm-allowed-deps",
        "R3-cross-module-packages-finance",
        "R3-cross-module-packages-crm",
      ]
    `);
  });

  it('names the owner of the imported module in the cross-module message', () => {
    const rule = generateRuleSet(fixtureOwnership()).forbidden.find(
      (entry) => entry.name === 'R3-cross-module-packages-crm',
    );
    expect(rule?.comment).toContain('Owner: growth');
    expect(rule?.comment).toContain('type-only imports included');
    expect(rule?.to).toEqual({ path: '^packages/crm/' });
  });

  it('lets a module import what ownership.json allows and nothing else', () => {
    const rule = generateRuleSet(fixtureOwnership()).forbidden.find(
      (entry) => entry.name === 'R3-packages-finance-allowed-deps',
    );
    expect(rule?.to.pathNot).toContain('^packages/core/');
    expect(rule?.comment).toContain('Owner: business-core');
  });

  it('anchors every path under the prefix when generating for a fixture tree', () => {
    const { forbidden } = generateRuleSet(fixtureOwnership(), { pathPrefix: 'fixtures/x/' });
    const rule = forbidden.find((entry) => entry.name === 'R3-cross-module-packages-crm');
    expect(rule?.to).toEqual({ path: '^fixtures/x/packages/crm/' });
  });

  it('exempts test files from the source allow-list rules', () => {
    const rule = generateRuleSet(fixtureOwnership()).forbidden.find(
      (entry) => entry.name === 'R3-packages-finance-allowed-deps',
    );
    expect(rule?.from.pathNot).toEqual([
      '^(?:|.*/)[^/]*\\.test\\.ts$',
      '^(?:|.*/)[^/]*\\.spec\\.ts$',
    ]);
  });

  it('covers every rule id the docs promise', () => {
    const names = generateRuleSet(loadOwnership(repoRoot))
      .forbidden.map((rule) => rule.name.split('-')[0])
      .filter((id, index, all) => all.indexOf(id) === index);
    for (const id of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R8', 'R9', 'R10', 'R11', 'R12']) {
      expect(names, `rule ${id} is generated`).toContain(id);
    }
  });
});

describe('the committed generated files', () => {
  it('match ownership.json and the working tree', () => {
    const stale = findStaleGeneratedFiles(repoRoot);
    expect(
      stale.map((entry) => `${entry.file}: ${entry.reason} (fix: ${entry.fix})`),
      'run `pnpm gen:deps-rules` and `pnpm gen:dep-map`, then commit',
    ).toEqual([]);
  });
});

describe('generateBiomeBoundaries', () => {
  it('bans every module a package may not import, by package name', () => {
    const { overrides } = generateBiomeBoundaries(fixtureOwnership());
    const finance = overrides.find((entry) => entry.includes[0] === 'packages/finance/**');
    const paths = finance?.linter.rules.style.noRestrictedImports.options.paths ?? {};
    expect(Object.keys(paths)).toEqual(['@paperos/crm']);
    expect(paths['@paperos/crm']).toContain('owner: growth');
  });

  it('says nothing about a package with no module to ban', () => {
    const { overrides } = generateBiomeBoundaries({
      ...fixtureOwnership(),
      packages: {
        'packages/core': {
          owner: 'app-shell',
          issues: ['PAP-13'],
          kind: 'core',
          optional: false,
          allowedDeps: [],
        },
      },
    });
    expect(overrides).toEqual([]);
  });
});
