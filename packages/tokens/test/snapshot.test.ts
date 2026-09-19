import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOKENS_DIR } from '../src/lib/theme.js';

const GENERATED_DIR = join(TOKENS_DIR, '..', 'src', 'generated');

// Snapshots the committed generated output itself (not a freshly generated
// copy) so this test also catches "edited the .css by hand and forgot to
// re-run build" -- the same class of drift `build --check` guards in CI.
describe('generated files match their committed snapshot', () => {
  it('tokens.css', () => {
    expect(readFileSync(join(GENERATED_DIR, 'tokens.css'), 'utf8')).toMatchSnapshot();
  });

  it('theme.css', () => {
    expect(readFileSync(join(GENERATED_DIR, 'theme.css'), 'utf8')).toMatchSnapshot();
  });
});
