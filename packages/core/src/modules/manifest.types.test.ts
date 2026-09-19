/**
 * Type-level tests. `defineModule` must keep the literals: the kernel's typed
 * tokens (`port<ViewQueryPort>('@paperos/contract-tables', …)`) and
 * `ModuleSettings<typeof module>` both depend on them, and a widened `string`
 * would make every one of those a cast.
 */

import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  type Diagnostic,
  type DiagnosticCode,
  defineModule,
  type ModuleKind,
  type ModuleManifest,
  type ModuleSettings,
  type OwnerAgent,
  type ProvidedContractNames,
  type SwapRisk,
  validateManifest,
} from './manifest.js';

const settingsSchema = z.object({
  pageSize: z.number().int().positive().default(50),
  showArchived: z.boolean().default(false),
});

const tables = defineModule({
  id: 'tables',
  kind: 'runtime',
  version: '0.1.0',
  owner: { agent: 'Nova', project: 'tables' },
  provides: [
    { contract: '@paperos/contract-tables', version: '0.1.0' },
    { contract: '@paperos/contract-tables-formulas', version: '0.1.0' },
  ],
  requires: [
    { contract: '@paperos/contract-data-layer', range: '^0.1.0', ports: ['RepositoryPort'] },
  ],
  swapRisk: 'high',
  settingsSchema,
});

describe('defineModule inference', () => {
  it('keeps the identity literals', () => {
    expectTypeOf(tables.id).toEqualTypeOf<'tables'>();
    expectTypeOf(tables.kind).toEqualTypeOf<'runtime'>();
    expectTypeOf(tables.swapRisk).toEqualTypeOf<'high'>();
    expectTypeOf(tables.owner.agent).toEqualTypeOf<'Nova'>();
  });

  it('keeps the provided contract names as literals', () => {
    expectTypeOf<ProvidedContractNames<typeof tables>>().toEqualTypeOf<
      '@paperos/contract-tables' | '@paperos/contract-tables-formulas'
    >();
    expectTypeOf(tables.requires[0].contract).toEqualTypeOf<'@paperos/contract-data-layer'>();
  });

  it('infers the settings type from the settingsSchema', () => {
    expectTypeOf<ModuleSettings<typeof tables>>().toEqualTypeOf<{
      pageSize: number;
      showArchived: boolean;
    }>();
  });

  it('falls back to unknown when there is no schema', () => {
    const plain = defineModule({
      id: 'libraries',
      kind: 'process',
      version: '0.1.0',
      owner: { agent: 'Scout', project: 'libraries' },
      provides: [{ contract: '@paperos/contract-libraries', version: '0.1.0' }],
      requires: [],
      swapRisk: 'low',
    });
    expectTypeOf<ModuleSettings<typeof plain>>().toEqualTypeOf<unknown>();
  });

  it('closes the enums', () => {
    expectTypeOf<'plugin'>().not.toExtend<ModuleKind>();
    expectTypeOf<'extreme'>().not.toExtend<SwapRisk>();
    expectTypeOf<'Justin'>().not.toExtend<OwnerAgent>();
    expectTypeOf<'runtime'>().toExtend<ModuleKind>();
    expectTypeOf<'critical'>().toExtend<SwapRisk>();
    expectTypeOf<'Nova'>().toExtend<OwnerAgent>();
  });
});

describe('validator types', () => {
  it('returns readonly diagnostics with a closed code union', () => {
    const result = validateManifest(tables);
    expectTypeOf(result.diagnostics).toEqualTypeOf<readonly Diagnostic[]>();
    expectTypeOf(result.ok).toEqualTypeOf<boolean>();
    expectTypeOf<DiagnosticCode>().toExtend<string>();
    expectTypeOf<Diagnostic['severity']>().toEqualTypeOf<'error' | 'warning'>();
  });

  it('parses into a manifest with the defaults filled in', () => {
    expectTypeOf<ModuleManifest['provides'][number]['impl']>().toEqualTypeOf<string>();
    expectTypeOf<ModuleManifest['capabilities']>().toEqualTypeOf<string[]>();
  });
});
