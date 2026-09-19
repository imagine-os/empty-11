import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseYaml } from '../lib/yaml-lite.mjs';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
export const OPS_LICENSES = join(REPO_ROOT, 'ops', 'licenses');

export function loadRealPolicy() {
  return parseYaml(readFileSync(join(OPS_LICENSES, 'policy.yaml'), 'utf8'));
}

export function fixture(name, file) {
  return JSON.parse(readFileSync(join(OPS_LICENSES, 'fixtures', name, file), 'utf8'));
}

/** One inventory row, with only the fields the classifier reads. */
export function row(overrides = {}) {
  return {
    package: 'example',
    version: '1.0.0',
    declared: 'MIT',
    detected: null,
    contexts: ['bundled'],
    paths: [],
    homepage: null,
    production: true,
    ...overrides,
  };
}

export function waiver(overrides = {}) {
  return {
    package: 'example',
    versionRange: '*',
    license: 'GPL-3.0-or-later',
    context: 'server',
    reason: 'the one thing that reads our legacy format',
    adr: 'docs/adr/0027-license-policy.md',
    approvedBy: 'Atlas',
    expires: '2027-01-01',
    from: 'ops/licenses/waivers.yaml',
    ...overrides,
  };
}

export const TODAY = new Date('2026-09-19T00:00:00Z');
