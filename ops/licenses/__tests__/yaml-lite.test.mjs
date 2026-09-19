import { describe, expect, it } from 'vitest';
import { parseYaml, YamlLiteError } from '../lib/yaml-lite.mjs';
import { loadRealPolicy } from './helpers.mjs';

describe('yaml-lite', () => {
  it('parses nested maps, sequences and scalars', () => {
    const parsed = parseYaml(
      [
        '# a comment',
        'version: 1',
        'adr: "0027"',
        'enabled: true',
        'missing: null',
        'tiers:',
        '  allow:',
        '    - MIT',
        '    - Apache-2.0 WITH LLVM-exception',
        '  deny: []',
        'exceptions:',
        '  - package: tldraw',
        '    versionRange: "3.15.6"',
        '    approvedBy: Justin',
      ].join('\n'),
    );
    expect(parsed).toEqual({
      version: 1,
      adr: '0027',
      enabled: true,
      missing: null,
      tiers: { allow: ['MIT', 'Apache-2.0 WITH LLVM-exception'], deny: [] },
      exceptions: [{ package: 'tldraw', versionRange: '3.15.6', approvedBy: 'Justin' }],
    });
  });

  it('refuses what it cannot read instead of misreading it', () => {
    expect(() => parseYaml('a: [1, 2]')).toThrow(YamlLiteError);
    expect(() => parseYaml('a: 1\n\tb: 2')).toThrow(YamlLiteError);
    expect(() => parseYaml('a: 1\n b: 2')).toThrow(YamlLiteError);
    expect(() => parseYaml('a: 1\na: 2')).toThrow(/duplicate key/);
    expect(() => parseYaml('just a scalar')).toThrow(YamlLiteError);
  });

  it('reads the real policy file', () => {
    const policy = loadRealPolicy();
    expect(policy.version).toBe(1);
    expect(policy.issue).toBe('PAP-211');
    expect(policy.tiers.allow).toContain('MIT');
    expect(policy.contextRules.bundled.denyFamilies).toContain('AGPL-');
  });
});
