import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILTIN_AUDIENCE_IDS, BUILTIN_AUDIENCES } from './builtin.js';
import { describe as describeSegment } from './describe.js';
import { explainPrincipal } from './explain.js';
import { principalSchema } from './principal.js';
import { createAudienceRegistry } from './registry.js';

const readJson = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));

describe('explainPrincipal', () => {
  it('lists every audience with a match flag and the segment in words', () => {
    const p = principalSchema.parse(readJson('./fixtures/principals/customer-partner.json'));
    const rows = explainPrincipal(p);
    expect(rows.map((r) => r.id)).toEqual([...BUILTIN_AUDIENCE_IDS]);
    expect(rows.filter((r) => r.matches).map((r) => r.id)).toEqual([
      'everyone',
      'authenticated',
      'customer',
      'customer-pro',
      'partner',
    ]);
    for (const row of rows) {
      expect(row.name).toBe(BUILTIN_AUDIENCES[row.id as keyof typeof BUILTIN_AUDIENCES].name);
      expect(row.because).toBe(
        describeSegment(BUILTIN_AUDIENCES[row.id as keyof typeof BUILTIN_AUDIENCES].match),
      );
    }
  });

  it('falls back to the id when a registry lists an id it cannot get', () => {
    const p = principalSchema.parse(readJson('./fixtures/principals/anonymous.json'));
    const odd = {
      ...createAudienceRegistry(),
      ids: ['ghost'],
      get: () => undefined,
      matches: () => false,
    };
    expect(explainPrincipal(p, odd)).toEqual([
      { id: 'ghost', name: 'ghost', matches: false, because: 'ghost' },
    ]);
  });

  it('includes app-declared audiences when given a registry', () => {
    const reg = createAudienceRegistry(readJson('./fixtures/app-spec.audiences.json').audiences);
    const p = principalSchema.parse(readJson('./fixtures/principals/agent-acting-for-staff.json'));
    const rows = explainPrincipal(p, reg);
    expect(rows.find((r) => r.id === 'agent.forge')).toEqual({
      id: 'agent.forge',
      name: 'Agent forge',
      matches: true,
      because: 'agents whose character is forge',
    });
  });
});
