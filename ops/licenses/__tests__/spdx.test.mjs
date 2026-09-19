import { describe, expect, it } from 'vitest';
import {
  evaluate,
  formatExpression,
  licenseIds,
  normalizeExpression,
  parseExpression,
} from '../lib/spdx.mjs';

const tierOf = (map) => (node) => map[node.id] ?? 'deny';

describe('normalizeExpression', () => {
  it('folds the non-SPDX strings npm really publishes', () => {
    expect(normalizeExpression('SEE LICENSE IN LICENSE.md')).toBe('SEE-LICENSE-IN');
    expect(normalizeExpression('see licence in COPYING')).toBe('SEE-LICENSE-IN');
    expect(normalizeExpression('UNLICENSED')).toBe('UNLICENSED');
    expect(normalizeExpression(undefined)).toBe('NONE');
    expect(normalizeExpression('   ')).toBe('NONE');
  });
});

describe('parseExpression', () => {
  it('parses a bare id', () => {
    expect(parseExpression('MIT')).toEqual({
      type: 'license',
      id: 'MIT',
      plus: false,
      exception: null,
    });
  });

  it('parses OR, AND, parentheses and WITH', () => {
    const ast = parseExpression('(MIT OR Apache-2.0) AND BSD-3-Clause');
    expect(formatExpression(ast)).toBe('((MIT OR Apache-2.0) AND BSD-3-Clause)');
    expect(licenseIds(ast)).toEqual(['MIT', 'Apache-2.0', 'BSD-3-Clause']);
    expect(parseExpression('Apache-2.0 WITH LLVM-exception').exception).toBe('LLVM-exception');
    expect(parseExpression('GPL-2.0+').plus).toBe(true);
  });

  it('binds AND tighter than OR', () => {
    expect(formatExpression(parseExpression('MIT OR GPL-3.0-only AND ISC'))).toBe(
      '(MIT OR (GPL-3.0-only AND ISC))',
    );
  });

  it('throws rather than guessing at a malformed expression', () => {
    expect(() => parseExpression('(MIT OR')).toThrow();
    expect(() => parseExpression('MIT)')).toThrow();
    expect(() => parseExpression('MIT WITH')).toThrow();
  });
});

describe('evaluate', () => {
  const tiers = {
    MIT: 'allow',
    'Apache-2.0': 'allow',
    'GPL-3.0-only': 'review',
    'SSPL-1.0': 'deny',
  };

  it('OR takes the most permissive branch', () => {
    expect(evaluate(parseExpression('MIT OR GPL-3.0-only'), tierOf(tiers))).toBe('allow');
    expect(evaluate(parseExpression('SSPL-1.0 OR GPL-3.0-only'), tierOf(tiers))).toBe('review');
  });

  it('AND takes the strictest branch', () => {
    expect(evaluate(parseExpression('GPL-3.0-only AND MIT'), tierOf(tiers))).toBe('review');
    expect(evaluate(parseExpression('MIT AND SSPL-1.0'), tierOf(tiers))).toBe('deny');
  });

  it('nests', () => {
    expect(evaluate(parseExpression('(MIT OR SSPL-1.0) AND Apache-2.0'), tierOf(tiers))).toBe(
      'allow',
    );
  });
});
