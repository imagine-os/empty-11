import { describe, expect, it } from 'vitest';
import {
  baseRoleOf,
  customRoleSchema,
  isPermission,
  isTenantRole,
  parsePermission,
  permissionSchema,
  roleAtLeast,
  TENANT_ROLES,
  tenantRoleSchema,
} from './role.js';

describe('tenant roles', () => {
  it('has exactly the five base roles, highest first', () => {
    expect(TENANT_ROLES).toEqual(['owner', 'admin', 'staff', 'member', 'viewer']);
    expect(tenantRoleSchema.safeParse('editor').success).toBe(false);
    expect(isTenantRole('admin')).toBe(true);
    expect(isTenantRole(3)).toBe(false);
  });

  it('ranks roles', () => {
    expect(roleAtLeast('owner', 'viewer')).toBe(true);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
    expect(roleAtLeast('member', 'staff')).toBe(false);
  });

  it('resolves custom roles to the base role they extend', () => {
    const custom = [{ name: 'billing-clerk', extends: 'staff' as const, permissions: [] }];
    expect(baseRoleOf('owner')).toBe('owner');
    expect(baseRoleOf('billing-clerk', custom)).toBe('staff');
    expect(baseRoleOf('nobody', custom)).toBeUndefined();
  });

  it('custom roles are kebab-case, extend a base role and cannot shadow one', () => {
    expect(
      customRoleSchema.safeParse({
        name: 'billing-clerk',
        extends: 'staff',
        permissions: ['invoice:read'],
      }).success,
    ).toBe(true);
    expect(
      customRoleSchema.safeParse({ name: 'admin', extends: 'staff', permissions: [] }).success,
    ).toBe(false);
    expect(
      customRoleSchema.safeParse({ name: 'Billing', extends: 'staff', permissions: [] }).success,
    ).toBe(false);
    expect(customRoleSchema.safeParse({ name: 'x', extends: 'god', permissions: [] }).success).toBe(
      false,
    );
    expect(
      customRoleSchema.safeParse({ name: 'x', extends: 'staff', permissions: ['bad'] }).success,
    ).toBe(false);
  });
});

describe('permission grammar resource:action', () => {
  it.each(['invoice:read', 'pm.issue:update', 'agent.session:*', 'file_upload:create', 'a-b:c-d'])(
    'accepts %s',
    (p) => {
      expect(isPermission(p)).toBe(true);
      expect(permissionSchema.safeParse(p).success).toBe(true);
    },
  );

  it.each([
    'invoice',
    'Invoice:read',
    'invoice:Read',
    ':read',
    'invoice:',
    'invoice:read:all',
    '*:read',
    'in voice:read',
  ])('rejects %s', (p) => {
    expect(isPermission(p)).toBe(false);
    expect(permissionSchema.safeParse(p).success).toBe(false);
    expect(parsePermission(p)).toBeNull();
  });

  it('parses into resource and action', () => {
    expect(parsePermission('pm.issue:update')).toEqual({ resource: 'pm.issue', action: 'update' });
    expect(parsePermission('invoice:*')).toEqual({ resource: 'invoice', action: '*' });
  });
});
