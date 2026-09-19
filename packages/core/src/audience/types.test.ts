import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  AUDIENCE_MODEL_VERSION,
  type AudienceId,
  type BuiltinAudienceId,
  type CustomRole,
  type customRoleSchema,
  type Permission,
  type Principal,
  type PrincipalType,
  type permissionSchema,
  type principalSchema,
  type principalTypeSchema,
  type Segment,
  type Surface,
  type segmentSchema,
  type surfaceSchema,
  type TenantRole,
  type tenantRoleSchema,
} from './index.js';

describe('audience model types (compile-time contract)', () => {
  it('PrincipalType is exactly the four-member union the contracts name', () => {
    expectTypeOf<PrincipalType>().toEqualTypeOf<'human' | 'agent' | 'service' | 'anonymous'>();
    expectTypeOf<z.infer<typeof principalTypeSchema>>().toEqualTypeOf<PrincipalType>();
  });

  it('Principal and its Zod schema infer the same shape', () => {
    expectTypeOf<z.infer<typeof principalSchema>>().toEqualTypeOf<Principal>();
    expectTypeOf<Principal['tenantId']>().toEqualTypeOf<string | null>();
    expectTypeOf<Principal['attributes']>().toEqualTypeOf<
      Record<string, string | number | boolean | string[]>
    >();
  });

  it('TenantRole is the five base roles', () => {
    expectTypeOf<TenantRole>().toEqualTypeOf<'owner' | 'admin' | 'staff' | 'member' | 'viewer'>();
    expectTypeOf<z.infer<typeof tenantRoleSchema>>().toEqualTypeOf<TenantRole>();
  });

  it('Permission strings and custom roles infer from their schemas', () => {
    expectTypeOf<z.infer<typeof permissionSchema>>().toEqualTypeOf<Permission>();
    expectTypeOf<z.infer<typeof customRoleSchema>>().toEqualTypeOf<CustomRole>();
  });

  it('Segment schema infers Segment; built-in ids are audience ids', () => {
    expectTypeOf<z.infer<typeof segmentSchema>>().toEqualTypeOf<Segment>();
    expectTypeOf<BuiltinAudienceId>().toExtend<AudienceId>();
    expectTypeOf<z.infer<typeof surfaceSchema>>().toEqualTypeOf<Surface>();
  });

  it('the model version is the literal 1', () => {
    expectTypeOf(AUDIENCE_MODEL_VERSION).toEqualTypeOf<1>();
  });
});
