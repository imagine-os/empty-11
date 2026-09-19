import { describe, expect, it } from 'vitest';
import {
  flatten,
  mergeTrees,
  resolveAliases,
  TokenAliasError,
  TokenCycleError,
  type TokenGroup,
} from '../src/lib/dtcg.js';
import { resolveTheme, THEME_NAMES } from '../src/lib/theme.js';

describe('resolveAliases', () => {
  it('resolves a chain of aliases to the final literal value', () => {
    const tree: TokenGroup = {
      color: {
        blue: { 500: { $type: 'color', $value: 'oklch(60% 0.1 250)' } },
        accent: { $type: 'color', $value: '{color.blue.500}' },
      },
      button: { bg: { $type: 'color', $value: '{color.accent}' } },
    };
    const resolved = resolveAliases(tree);
    const flat = flatten(resolved);
    const button = flat.find((t) => t.path.join('.') === 'button.bg');
    expect(button?.value).toBe('oklch(60% 0.1 250)');
  });

  it('throws TokenAliasError, naming the source path, for an alias with no target', () => {
    const tree: TokenGroup = {
      a: { $type: 'color', $value: '{does.not.exist}' },
    };
    expect(() => resolveAliases(tree)).toThrow(TokenAliasError);
  });

  it('throws TokenCycleError naming the full cycle path', () => {
    const tree: TokenGroup = {
      a: { $type: 'color', $value: '{b}' },
      b: { $type: 'color', $value: '{a}' },
    };
    try {
      resolveAliases(tree);
      expect.unreachable('expected a TokenCycleError');
    } catch (err) {
      expect(err).toBeInstanceOf(TokenCycleError);
      const cycle = (err as InstanceType<typeof TokenCycleError>).cyclePath;
      expect(cycle).toContain('a');
      expect(cycle).toContain('b');
    }
  });

  it('merges trees left-to-right, later sources winning on leaf collisions', () => {
    const base: TokenGroup = { x: { $type: 'number', $value: 1 } };
    const override: TokenGroup = { x: { $type: 'number', $value: 2 } };
    const merged = mergeTrees(base, override);
    expect((merged.x as { $value: number }).$value).toBe(2);
  });

  it('merges sibling keys under the same group without collision (core ramp + theme role under color.accent)', () => {
    const core: TokenGroup = {
      color: { accent: { 500: { $type: 'color', $value: 'oklch(60% 0.1 250)' } } },
    };
    const theme: TokenGroup = {
      color: { accent: { default: { $type: 'color', $value: '{color.accent.500}' } } },
    };
    const merged = mergeTrees(core, theme);
    const resolved = resolveAliases(merged);
    const flat = flatten(resolved);
    expect(flat.map((t) => t.path.join('.'))).toEqual(
      expect.arrayContaining(['color.accent.500', 'color.accent.default']),
    );
  });
});

describe('real token files resolve cleanly for every theme', () => {
  for (const theme of THEME_NAMES) {
    it(`${theme} resolves with no thrown alias/cycle errors`, () => {
      expect(() => resolveTheme(theme)).not.toThrow();
    });
  }
});
