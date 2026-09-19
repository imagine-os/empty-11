/**
 * Unit tests for the manifest schema, `defineModule()` and `validateManifest()`.
 * `manifest.ts` is held at 100% coverage (see `vitest.config.ts`): every branch
 * here is a rule somebody will hit while writing a manifest.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as barrel from '../index.js';
import { loadGoldenManifests, loadInvalidCases, loadInvalidManifest } from './fixtures/load.js';
import {
  DIAGNOSTIC_CODES,
  type Diagnostic,
  type DiagnosticCode,
  defineModule,
  deriveDependsOn,
  isStandardSchema,
  MODULE_MANIFEST_SCHEMA_ID,
  type ModuleManifest,
  type ModuleManifestInput,
  ModuleManifestSchema,
  OWNER_PROJECTS,
  toManifestJson,
  validateManifest,
  validateManifests,
} from './manifest.js';

const goldens = loadGoldenManifests();

/** The smallest manifest the schema accepts: a process module with nothing but identity. */
function minimal(overrides: Partial<ModuleManifestInput> = {}): ModuleManifestInput {
  return {
    id: 'demo',
    kind: 'process',
    version: '0.1.0',
    owner: { agent: 'Atlas', project: 'module-system' },
    provides: [{ contract: '@paperos/contract-demo', version: '0.1.0' }],
    requires: [],
    swapRisk: 'low',
    ...overrides,
  };
}

const codesOf = (diagnostics: readonly Diagnostic[]): DiagnosticCode[] => [
  ...new Set(diagnostics.map((diagnostic) => diagnostic.code)),
];

describe('@paperos/core barrel', () => {
  it('re-exports the manifest contract', () => {
    expect(barrel.validateManifest).toBe(validateManifest);
    expect(barrel.MODULE_MANIFEST_SCHEMA_ID).toBe(MODULE_MANIFEST_SCHEMA_ID);
  });
});

describe('golden manifests', () => {
  it('ships the seventeen modules plus the kernel', () => {
    expect(goldens).toHaveLength(18);
    expect(goldens.map((manifest) => manifest.id)).toContain('module-system');
  });

  it.each(goldens.map((manifest) => [manifest.id, manifest] as const))(
    '%s parses',
    (_id, manifest) => {
      expect(ModuleManifestSchema.safeParse(manifest).success).toBe(true);
    },
  );

  it.each(goldens.map((manifest) => [manifest.id, manifest] as const))(
    '%s validates against the whole workspace',
    (_id, manifest) => {
      const result = validateManifest(manifest, { others: goldens });
      expect(result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
    },
  );

  it('validates as a set', () => {
    expect(validateManifests(goldens)).toEqual({ ok: true, diagnostics: [] });
  });

  it('names an owner project that exists in plan.json', () => {
    for (const manifest of goldens) {
      expect(OWNER_PROJECTS).toContain(manifest.owner.project);
    }
  });

  it('derives dependsOn that matches every manifest that authored it', () => {
    for (const manifest of goldens) {
      if (manifest.dependsOn === undefined) continue;
      expect(deriveDependsOn(manifest, goldens)).toEqual([...manifest.dependsOn].sort());
    }
    /* tables is the worked example in docs/platform/manifest.md. */
    const tables = goldens.find((manifest) => manifest.id === 'tables') as ModuleManifest;
    expect(deriveDependsOn(tables, goldens)).toEqual([
      'data-layer',
      'design-system',
      'identity',
      'input',
    ]);
  });

  it('exposes every slot the goldens fill', () => {
    const exposed = new Set(
      goldens.flatMap((manifest) => (manifest.slots?.exposes ?? []).map((slot) => slot.id)),
    );
    const filled = goldens.flatMap((manifest) =>
      (manifest.slots?.fills ?? []).map((fill) => fill.slot),
    );
    expect(filled.length).toBeGreaterThan(0);
    for (const slot of filled) expect(exposed).toContain(slot);
  });
});

describe('invalid fixtures', () => {
  const cases = loadInvalidCases();

  it('covers every stable diagnostic code', () => {
    expect([...cases.map((entry) => entry.code)].sort()).toEqual([...DIAGNOSTIC_CODES].sort());
  });

  it.each(cases.map((entry) => [entry.code, entry] as const))(
    '%s fails with exactly its code',
    (code, entry) => {
      const subject = loadInvalidManifest(entry.subject);
      const others = [
        ...(entry.withGoldens ? goldens : []),
        ...entry.others.map((file) => loadInvalidManifest(file)),
      ];
      const result = validateManifest(subject, {
        others,
        ...(entry.contracts === null ? {} : { contracts: entry.contracts }),
      });
      expect(result.ok).toBe(false);
      expect(codesOf(result.diagnostics)).toEqual([code]);
    },
  );

  it('names both modules and both versions in a range mismatch', () => {
    const subject = loadInvalidManifest('requires-range-mismatch.json');
    const [diagnostic] = validateManifest(subject, { others: goldens }).diagnostics;
    expect(diagnostic?.message).toContain(
      'requires-range-mismatch requires @paperos/contract-collab ^0.2.0',
    );
    expect(diagnostic?.message).toContain('collab provides 0.1.0');
  });

  it('names the whole path in a cycle', () => {
    const a = loadInvalidManifest('cycle-a.json');
    const b = loadInvalidManifest('cycle-b.json');
    const [diagnostic] = validateManifest(a, { others: [b] }).diagnostics;
    expect(diagnostic?.message).toBe('dependency cycle: cycle-a -> cycle-b -> cycle-a.');
    expect(diagnostic?.related).toEqual(['cycle-a', 'cycle-b', 'cycle-a']);
  });
});

describe('schema', () => {
  it('requires only identity, owner, provides, requires and swap risk', () => {
    expect(ModuleManifestSchema.safeParse(minimal()).success).toBe(true);
  });

  it('applies the documented defaults', () => {
    const parsed = ModuleManifestSchema.parse(minimal());
    expect(parsed.provides[0]?.impl).toBe('default');
    expect(parsed.optional).toBe(true);
    expect(parsed).toMatchObject({ capabilities: [], routes: [], secrets: [], issues: [] });
    expect(parsed.slots).toBeUndefined();
  });

  it('rejects an unknown field', () => {
    const result = ModuleManifestSchema.safeParse({ ...minimal(), nope: 1 });
    expect(result.success).toBe(false);
  });

  it.each([
    ['id', { id: 'X' }],
    ['id too short', { id: 'a' }],
    ['kind', { kind: 'plugin' }],
    ['version', { version: 'one' }],
    ['owner.agent', { owner: { agent: 'Justin', project: 'module-system' } }],
    ['swapRisk', { swapRisk: 'extreme' }],
    ['contract name', { provides: [{ contract: 'tables', version: '0.1.0' }] }],
    ['requires range', { requires: [{ contract: '@paperos/contract-x', range: 'latest' }] }],
    ['topic name', { events: { publishes: ['Tables.View'] } }],
    ['slot id', { slots: { exposes: [{ id: 'nav' }] } }],
    ['issue id', { issues: ['ENG-1'] }],
    ['lifecycle', { lifecycle: { startupBudgetMs: 0, healthIntervalMs: 1, drainTimeoutMs: 1 } }],
    ['resilience', { resilience: { Port: { backoff: 'linear' } } }],
    ['route path', { routes: [{ path: 'settings' }] }],
  ])('rejects a bad %s', (_what, patch) => {
    expect(ModuleManifestSchema.safeParse({ ...minimal(), ...patch }).success).toBe(false);
  });

  it('accepts every round-4 reserved field', () => {
    const parsed = ModuleManifestSchema.parse(
      minimal({
        secrets: ['STRIPE_SECRET_KEY'],
        lifecycle: { startupBudgetMs: 1000, healthIntervalMs: 5000, drainTimeoutMs: 2000 },
        resilience: {
          LedgerPort: { timeoutMs: 100, retries: 1, backoff: 'exponential', fallback: 'queue' },
        },
        issues: ['PAP-433'],
      }),
    );
    expect(parsed.secrets).toEqual(['STRIPE_SECRET_KEY']);
    expect(parsed.resilience?.LedgerPort?.backoff).toBe('exponential');
  });

  it('pins the schema id', () => {
    expect(MODULE_MANIFEST_SCHEMA_ID).toBe('https://paperos.dev/schema/module-manifest/1');
  });
});

describe('defineModule', () => {
  it('returns the frozen manifest it was given', () => {
    const module = defineModule(minimal());
    expect(Object.isFrozen(module)).toBe(true);
    expect(module.id).toBe('demo');
  });

  it('throws with every problem listed', () => {
    expect(() => defineModule({ ...minimal(), id: 'X', swapRisk: 'extreme' } as never)).toThrow(
      /Invalid module manifest "X"/,
    );
  });

  it('accepts a Zod settingsSchema and keeps it usable at runtime', () => {
    const settingsSchema = z.object({ pageSize: z.number().int().positive().default(50) });
    const module = defineModule({ ...minimal(), settingsSchema });
    expect(module.settingsSchema).toBe(settingsSchema);
    expect(toManifestJson(module).settingsSchema).toMatchObject({ type: 'object' });
  });

  it('leaves a JSON Schema settingsSchema alone', () => {
    const settingsSchema = { type: 'object', properties: {} };
    expect(toManifestJson({ ...minimal(), settingsSchema }).settingsSchema).toBe(settingsSchema);
  });

  it('omits settingsSchema when there is none', () => {
    expect(toManifestJson(minimal())).not.toHaveProperty('settingsSchema');
  });

  it.each([
    [null, false],
    ['zod', false],
    [{}, false],
    [z.string(), true],
  ])('isStandardSchema(%o) is %s', (value, expected) => {
    expect(isStandardSchema(value)).toBe(expected);
  });
});

describe('validateManifest', () => {
  it('reports schema problems as SCHEMA_INVALID and stops there', () => {
    const result = validateManifest({ ...minimal(), id: 'X', nope: 1 });
    expect(result.ok).toBe(false);
    expect(codesOf(result.diagnostics)).toEqual(['SCHEMA_INVALID']);
    expect(result.diagnostics[0]?.module).toBe('X');
  });

  it.each([
    ['a non-object', 42],
    ['null', null],
    ['an object with no id', { kind: 'process' }],
    ['a non-string id', { id: 7 }],
    ['an empty id', { id: '' }],
  ])('labels %s as <unknown>', (_what, value) => {
    expect(validateManifest(value).diagnostics[0]?.module).toBe('<unknown>');
  });

  it('formats array paths', () => {
    const result = validateManifest({
      ...minimal(),
      requires: [{ contract: 'nope', range: '^1' }],
    });
    expect(result.diagnostics[0]?.path).toBe('requires[0].contract');
  });

  it('flags an owner project that is not in plan.json', () => {
    const result = validateManifest(minimal({ owner: { agent: 'Atlas', project: 'marketing' } }));
    expect(codesOf(result.diagnostics)).toEqual(['OWNER_UNKNOWN']);
    expect(result.diagnostics[0]?.path).toBe('owner.project');
  });

  it('ignores an unparseable sibling and a duplicate of itself', () => {
    const result = validateManifest(minimal(), { others: [{ id: 'broken' }, minimal()] });
    expect(result).toEqual({ ok: true, diagnostics: [] });
  });

  it('warns rather than fails on an unresolved optional requirement', () => {
    const result = validateManifest(
      minimal({
        requires: [{ contract: '@paperos/contract-ghost', range: '^0.1.0', optional: true }],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'REQUIRES_UNRESOLVED',
      severity: 'warning',
    });
  });

  it('accepts a provider that offers several versions of one contract', () => {
    const provider = minimal({
      id: 'provider',
      provides: [
        { contract: '@paperos/contract-thing', version: '0.1.0' },
        { contract: '@paperos/contract-thing', version: '0.2.0', impl: 'next' },
      ],
    });
    const consumer = minimal({
      id: 'consumer',
      requires: [{ contract: '@paperos/contract-thing', range: '^0.2.0' }],
    });
    expect(validateManifest(consumer, { others: [provider] }).ok).toBe(true);
  });

  it('allows two implementations of one contract and rejects two with the same impl', () => {
    const v1 = minimal({
      id: 'shell-a',
      provides: [{ contract: '@paperos/contract-shell', version: '0.1.0' }],
    });
    const v2 = minimal({
      id: 'shell-b',
      provides: [{ contract: '@paperos/contract-shell', version: '0.1.0', impl: 'next' }],
    });
    expect(validateManifest(v1, { others: [v2] }).ok).toBe(true);

    const clash = minimal({
      id: 'shell-c',
      provides: [{ contract: '@paperos/contract-shell', version: '0.1.0' }],
    });
    const result = validateManifest(clash, { others: [v1] });
    expect(codesOf(result.diagnostics)).toEqual(['DUPLICATE_PROVIDER']);
    expect(result.diagnostics[0]?.related).toEqual(['shell-c', 'shell-a']);
  });

  it('does not report a duplicate between two other modules', () => {
    const a = minimal({
      id: 'other-a',
      provides: [{ contract: '@paperos/contract-shared', version: '0.1.0' }],
    });
    const b = minimal({
      id: 'other-b',
      provides: [{ contract: '@paperos/contract-shared', version: '0.1.0' }],
    });
    expect(validateManifest(minimal(), { others: [a, b] }).diagnostics).toEqual([]);
  });

  it('reports a duplicate inside one manifest', () => {
    const result = validateManifest(
      minimal({
        provides: [
          { contract: '@paperos/contract-demo', version: '0.1.0' },
          { contract: '@paperos/contract-demo', version: '0.1.0' },
        ],
      }),
    );
    expect(codesOf(result.diagnostics)).toEqual(['DUPLICATE_PROVIDER']);
  });

  it('checks provided versions only against contract packages it was given', () => {
    const manifest = minimal();
    expect(validateManifest(manifest, { contracts: {} }).ok).toBe(true);
    expect(validateManifest(manifest, { contracts: { '@paperos/contract-demo': {} } }).ok).toBe(
      true,
    );
    expect(
      validateManifest(manifest, { contracts: { '@paperos/contract-demo': { version: '0.1.0' } } })
        .ok,
    ).toBe(true);
    const mismatch = validateManifest(manifest, {
      contracts: { '@paperos/contract-demo': { version: '0.2.0' } },
    });
    expect(codesOf(mismatch.diagnostics)).toEqual(['PROVIDES_VERSION_MISMATCH']);
    const garbage = validateManifest(manifest, {
      contracts: { '@paperos/contract-demo': { version: 'nightly' } },
    });
    expect(codesOf(garbage.diagnostics)).toEqual(['PROVIDES_VERSION_MISMATCH']);
  });

  it('accepts dependsOn that agrees with requires and derives it for an unresolved contract', () => {
    const provider = minimal({
      id: 'store',
      provides: [{ contract: '@paperos/contract-store', version: '0.1.0' }],
    });
    const consumer = minimal({
      id: 'consumer',
      requires: [
        { contract: '@paperos/contract-store', range: '^0.1.0' },
        { contract: '@paperos/contract-ghost', range: '^0.1.0', optional: true },
      ],
      dependsOn: ['ghost', 'store'],
    });
    const result = validateManifest(consumer, { others: [provider] });
    expect(codesOf(result.diagnostics)).toEqual(['REQUIRES_UNRESOLVED']);
    expect(deriveDependsOn({ requires: [] })).toEqual([]);
  });

  it('accepts a slot exposed by a contract package', () => {
    const manifest = minimal({
      slots: { fills: [{ slot: 'shell.nav', component: 'ui.demo.Nav' }] },
    });
    expect(validateManifest(manifest).ok).toBe(false);
    expect(
      validateManifest(manifest, {
        contracts: { '@paperos/contract-app-shell': { slots: ['shell.nav'] } },
      }).ok,
    ).toBe(true);
  });

  it('skips topic checks when no contract information was passed', () => {
    const manifest = minimal({ events: { publishes: ['demo.thing.happened'] } });
    expect(validateManifest(manifest).diagnostics).toEqual([]);
  });

  it('warns when the contract package was found but its topics could not be read', () => {
    const manifest = minimal({ events: { publishes: ['demo.thing.happened'] } });
    const result = validateManifest(manifest, {
      contracts: { '@paperos/contract-demo': { version: '0.1.0' } },
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics[0]).toMatchObject({ code: 'TOPIC_UNDECLARED', severity: 'warning' });
    expect(result.diagnostics[0]?.message).toContain(
      'the topics of @paperos/contract-demo could not be read',
    );
    expect(result.diagnostics[0]?.related).toEqual(['@paperos/contract-demo']);
  });

  it('stays silent about contract packages the caller knows nothing about', () => {
    const manifest = minimal({ events: { publishes: ['demo.thing.happened'] } });
    expect(
      validateManifest(manifest, { contracts: { '@paperos/contract-other': { topics: [] } } })
        .diagnostics,
    ).toEqual([]);
    const noContracts = minimal({ provides: [], events: { publishes: ['demo.thing.happened'] } });
    expect(validateManifest(noContracts, { contracts: {} }).diagnostics).toEqual([]);
  });

  it('accepts a topic the contract declares', () => {
    const manifest = minimal({
      events: { publishes: ['demo.thing.happened'], subscribes: ['other.thing.happened'] },
    });
    const contracts = {
      '@paperos/contract-demo': { version: '0.1.0', topics: ['demo.thing.happened'] },
    };
    expect(validateManifest(manifest, { contracts }).diagnostics).toEqual([]);
  });

  it('ignores optional edges when looking for cycles', () => {
    const a = minimal({
      id: 'ring-a',
      provides: [{ contract: '@paperos/contract-ring-a', version: '0.1.0' }],
      requires: [{ contract: '@paperos/contract-ring-b', range: '^0.1.0', optional: true }],
    });
    const b = minimal({
      id: 'ring-b',
      provides: [{ contract: '@paperos/contract-ring-b', version: '0.1.0' }],
      requires: [{ contract: '@paperos/contract-ring-a', range: '^0.1.0' }],
    });
    expect(validateManifest(a, { others: [b] }).ok).toBe(true);
  });

  it('does not report a cycle that does not pass through this module', () => {
    const entry = minimal({
      id: 'entry',
      requires: [{ contract: '@paperos/contract-node-x', range: '^0.1.0' }],
    });
    const x = minimal({
      id: 'node-x',
      provides: [{ contract: '@paperos/contract-node-x', version: '0.1.0' }],
      requires: [{ contract: '@paperos/contract-node-y', range: '^0.1.0' }],
    });
    const y = minimal({
      id: 'node-y',
      provides: [{ contract: '@paperos/contract-node-y', version: '0.1.0' }],
      requires: [{ contract: '@paperos/contract-node-x', range: '^0.1.0' }],
    });
    expect(validateManifest(entry, { others: [x, y] }).diagnostics).toEqual([]);
  });

  it('reports a cycle through two contracts of one module once', () => {
    const self = minimal({
      id: 'twin-a',
      provides: [{ contract: '@paperos/contract-twin-a', version: '0.1.0' }],
      requires: [
        { contract: '@paperos/contract-twin-b1', range: '^0.1.0' },
        { contract: '@paperos/contract-twin-b2', range: '^0.1.0' },
      ],
    });
    const other = minimal({
      id: 'twin-b',
      provides: [
        { contract: '@paperos/contract-twin-b1', version: '0.1.0' },
        { contract: '@paperos/contract-twin-b2', version: '0.1.0' },
      ],
      requires: [{ contract: '@paperos/contract-twin-a', range: '^0.1.0' }],
    });
    const result = validateManifest(self, { others: [other] });
    expect(result.diagnostics.filter((diagnostic) => diagnostic.code === 'CYCLE')).toHaveLength(1);
  });

  it('reports every module in a broken set', () => {
    const a = minimal({
      id: 'set-a',
      provides: [{ contract: '@paperos/contract-set-a', version: '0.1.0' }],
      requires: [{ contract: '@paperos/contract-missing', range: '^0.1.0' }],
    });
    const b = minimal({ id: 'set-b', owner: { agent: 'Atlas', project: 'nope' } });
    const result = validateManifests([a, b]);
    expect(result.ok).toBe(false);
    expect(codesOf(result.diagnostics).sort()).toEqual(['OWNER_UNKNOWN', 'REQUIRES_UNRESOLVED']);
  });
});
