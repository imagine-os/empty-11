import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findException,
  leafTier,
  loadPolicy,
  strictestContext,
  tierOfExpression,
  validateException,
  validatePolicy,
  versionMatches,
} from '../lib/policy.mjs';
import { parseExpression } from '../lib/spdx.mjs';
import { loadRealPolicy, OPS_LICENSES, REPO_ROOT, TODAY, waiver } from './helpers.mjs';

const policy = loadRealPolicy();
const tier = (expression, context) => tierOfExpression(policy, expression, context).tier;

describe('the shipped policy files', () => {
  it('load and validate with no errors', () => {
    const loaded = loadPolicy(REPO_ROOT);
    expect(loaded.errors).toEqual([]);
    expect(loaded.policy.issue).toBe('PAP-211');
  });

  it('nothing is waived today', () => {
    expect(loadPolicy(REPO_ROOT).exceptions).toEqual([]);
  });

  it('catches a licence listed in two tiers', () => {
    const broken = { ...policy, tiers: { ...policy.tiers, deny: [...policy.tiers.deny, 'MIT'] } };
    expect(validatePolicy(broken).join('\n')).toMatch(/"MIT" is in both allow and deny/);
  });
});

describe('tiers per context', () => {
  it('allows the permissive set everywhere', () => {
    for (const context of ['bundled', 'server', 'dev', 'service']) {
      for (const id of [
        'MIT',
        'Apache-2.0',
        'BSD-3-Clause',
        'ISC',
        '0BSD',
        'MPL-2.0',
        'BlueOak-1.0.0',
      ]) {
        expect(tier(id, context), `${id} in ${context}`).toBe('allow');
      }
    }
  });

  it('denies SSPL, Commons Clause and unlicensed code in every context', () => {
    for (const context of ['bundled', 'server', 'dev', 'service']) {
      expect(tier('SSPL-1.0', context)).toBe('deny');
      expect(tier('Apache-2.0 WITH Commons-Clause', context)).toBe('deny');
      expect(tier('UNLICENSED', context)).toBe('deny');
      expect(tier(undefined, context)).toBe('deny');
      expect(tier('NoSuchLicense-9.9', context)).toBe('deny');
    }
  });

  it('denies every copyleft family in a bundled context, listed or not', () => {
    for (const id of [
      'GPL-3.0-only',
      'LGPL-2.1-or-later',
      'AGPL-3.0-or-later',
      'EUPL-1.2',
      'CDDL-1.0',
    ]) {
      expect(tier(id, 'bundled'), id).toBe('deny');
    }
    // An id nobody tiered but whose family is denied still fails.
    expect(tier('GPL-4.0-only', 'bundled')).toBe('deny');
  });

  it('reviews LGPL/GPL on the server and allows them in dev', () => {
    expect(tier('GPL-3.0-or-later', 'server')).toBe('review');
    expect(tier('LGPL-3.0-or-later', 'server')).toBe('review');
    expect(tier('GPL-3.0-or-later', 'dev')).toBe('allow');
  });

  it('keeps AGPL to the service context', () => {
    expect(tier('AGPL-3.0-or-later', 'service')).toBe('review');
    expect(tier('AGPL-3.0-or-later', 'server')).toBe('deny');
    expect(tier('AGPL-3.0-or-later', 'bundled')).toBe('deny');
    expect(tier('AGPL-3.0-or-later', 'dev')).toBe('review');
  });

  it('treats a bespoke SEE LICENSE IN text as review, never allow (tldraw, ADR 0006)', () => {
    expect(tier('SEE LICENSE IN LICENSE.md', 'service')).toBe('review');
    expect(tier('SEE LICENSE IN LICENSE.md', 'server')).toBe('review');
    expect(tier('SEE LICENSE IN LICENSE.md', 'bundled')).toBe('deny');
  });

  it('reads a deprecated bare GPL id as its -or-later form', () => {
    expect(leafTier(policy, parseExpression('GPL-3.0'), 'server')).toBe('review');
    expect(leafTier(policy, parseExpression('AGPL-3.0'), 'bundled')).toBe('deny');
    expect(tier('GPL-2.0+', 'server')).toBe('review');
  });

  it('folds compound expressions the way the policy says', () => {
    expect(tier('(MIT OR Apache-2.0)', 'bundled')).toBe('allow');
    expect(tier('MIT OR GPL-3.0-only', 'bundled')).toBe('allow');
    expect(tier('(GPL-3.0-only AND MIT)', 'server')).toBe('review');
    expect(tier('(GPL-3.0-only AND MIT)', 'bundled')).toBe('deny');
  });

  it('takes the strictest context a package appears in', () => {
    expect(strictestContext(policy, ['dev', 'bundled'])).toBe('bundled');
    expect(strictestContext(policy, ['dev', 'server'])).toBe('server');
    expect(strictestContext(policy, ['dev'])).toBe('dev');
  });
});

describe('versionMatches', () => {
  it('handles the four forms the waiver schema allows', () => {
    expect(versionMatches('*', '1.2.3')).toBe(true);
    expect(versionMatches('1.2.3', '1.2.3')).toBe(true);
    expect(versionMatches('1.2.3', '1.2.4')).toBe(false);
    expect(versionMatches('^1.2.3', '1.9.0')).toBe(true);
    expect(versionMatches('^1.2.3', '2.0.0')).toBe(false);
    expect(versionMatches('^0.2.3', '0.2.9')).toBe(true);
    expect(versionMatches('^0.2.3', '0.3.0')).toBe(false);
    expect(versionMatches('~1.2.3', '1.2.9')).toBe(true);
    expect(versionMatches('~1.2.3', '1.3.0')).toBe(false);
    expect(versionMatches('3.15.*', '3.15.6')).toBe(true);
    expect(versionMatches('3.15.*', '3.16.0')).toBe(false);
  });
});

describe('exception schema', () => {
  it('requires every field', () => {
    const errors = validateException({ package: 'x', from: 'waivers.yaml' }, 0);
    for (const field of [
      'versionRange',
      'license',
      'context',
      'reason',
      'adr',
      'approvedBy',
      'expires',
    ]) {
      expect(errors.join('\n'), field).toMatch(new RegExp(`\`${field}\` is required`));
    }
  });

  it('rejects an unknown context, approver or date', () => {
    const errors = validateException(
      waiver({ context: 'everywhere', approvedBy: 'Scout', expires: 'never' }),
      0,
    );
    expect(errors.join('\n')).toMatch(/context "everywhere"/);
    expect(errors.join('\n')).toMatch(/approvedBy must be Atlas or Justin/);
    expect(errors.join('\n')).toMatch(/expires must be an ISO date/);
  });
});

describe('findException', () => {
  const finding = {
    package: 'example',
    version: '1.4.0',
    license: 'GPL-3.0-or-later',
    context: 'server',
  };

  it('matches on package, context, version range and licence', () => {
    expect(findException([waiver({ versionRange: '^1.2.0' })], finding, TODAY).expired).toBe(false);
    expect(findException([waiver({ versionRange: '^2.0.0' })], finding, TODAY)).toBeNull();
    expect(findException([waiver({ context: 'bundled' })], finding, TODAY)).toBeNull();
    expect(findException([waiver({ license: 'MIT' })], finding, TODAY)).toBeNull();
    expect(findException([waiver({ license: '*' })], finding, TODAY).expired).toBe(false);
  });

  it('reports an expired waiver rather than ignoring it', () => {
    expect(findException([waiver({ expires: '2026-09-18' })], finding, TODAY).expired).toBe(true);
    expect(findException([waiver({ expires: '2026-09-19' })], finding, TODAY).expired).toBe(false);
  });
});

describe('deny.toml mirrors the policy', () => {
  it('allows exactly the same SPDX ids as tiers.allow, minus the WITH clause', () => {
    const toml = readFileSync(join(OPS_LICENSES, 'deny.toml'), 'utf8');
    const block = toml.slice(
      toml.indexOf('allow = ['),
      toml.indexOf(']', toml.indexOf('allow = [')),
    );
    const inToml = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
    const inPolicy = policy.tiers.allow.filter((id) => !id.includes(' WITH ')).sort();
    expect(inToml).toEqual(inPolicy);
  });
});
