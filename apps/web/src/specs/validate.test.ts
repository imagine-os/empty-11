/**
 * Real schema validation for every `specs/pages/*.spec.yaml` PAP-16 ships,
 * using `@paperos/spec`'s actual `parseSpec` (PAP-114) — this is the gate
 * `vite-plugin-paperos-specs.ts` itself cannot run at Vite-config load time
 * (see that file's header comment). `pnpm check` runs this suite, so an
 * invalid fixture fails the build here, not silently at runtime.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSpec } from '@paperos/spec';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const specsDir = resolve(here, '../../../../specs/pages');

describe.each(['home', 'dashboard', 'settings'])('specs/pages/%s.spec.yaml', (name) => {
  it('parses and validates with no errors or warnings', () => {
    const source = readFileSync(resolve(specsDir, `${name}.spec.yaml`), 'utf8');
    const result = parseSpec(source);

    expect(result.ok, result.ok ? '' : JSON.stringify(result.error, null, 2)).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('declares every slot its nav/sidebar/inspector components target under layout.slots', () => {
    const source = readFileSync(resolve(specsDir, `${name}.spec.yaml`), 'utf8');
    const result = parseSpec(source);
    if (!result.ok) throw new Error('spec did not parse');

    for (const component of result.value.components) {
      if (component.slot && component.slot !== 'main') {
        expect(Object.keys(result.value.layout.slots)).toContain(component.slot);
      }
    }
  });
});
