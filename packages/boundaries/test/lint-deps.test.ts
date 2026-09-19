/**
 * Integration: the lint really fails a cross-module import and really passes
 * without it (PAP-305). It runs the installed `depcruise` binary over the
 * fixture tree in `test/fixtures/violation`, with rules generated from a
 * fixture boundary map — the committed config is never touched.
 */

import { describe, expect, it } from 'vitest';
import { findRepoRoot } from '../src/repo.js';
import { generateRuleSet } from '../src/rules.js';
import { cruise, fixtureOwnership } from './helpers.js';

const repoRoot = findRepoRoot();
const FIXTURE = 'packages/boundaries/test/fixtures/violation';
const config = generateRuleSet(fixtureOwnership(), { pathPrefix: `${FIXTURE}/` });

describe('pnpm lint:deps', () => {
  it('fails packages/finance -> packages/crm with R3 and the owner to ask', () => {
    const violations = cruise(repoRoot, config, `${FIXTURE}/packages/finance/src/index.ts`);
    const crossModule = violations.filter((violation) =>
      violation.rule.name.startsWith('R3-cross-module'),
    );
    expect(crossModule).toHaveLength(1);
    expect(crossModule[0]?.rule.name).toBe('R3-cross-module-packages-crm');
    expect(crossModule[0]?.from).toBe(`${FIXTURE}/packages/finance/src/index.ts`);
    expect(crossModule[0]?.to).toBe(`${FIXTURE}/packages/crm/src/index.ts`);
    const comment = config.forbidden.find(
      (rule) => rule.name === 'R3-cross-module-packages-crm',
    )?.comment;
    expect(comment).toContain('Owner: growth');
  });

  it('passes the same module once the import is gone', () => {
    const violations = cruise(repoRoot, config, `${FIXTURE}/packages/finance/src/legal.ts`);
    expect(violations).toEqual([]);
  });

  it('is green on the repo as it stands', () => {
    const violations = cruise(repoRoot, generateRuleSet(fixtureOwnership({})), 'packages/core');
    expect(violations).toEqual([]);
  });
});
