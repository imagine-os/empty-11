/**
 * Tenant roles and permission strings (Interface & Data Contracts §2, row Membership / Role).
 *
 * Five base roles, mapped one-to-one to Better Auth organization roles by PAP-58. Custom
 * roles are named strings that extend one of the five. `role.permissions` is a list of
 * `resource:action` strings; this file owns the grammar, PAP-59's `can()` owns evaluation.
 */
import { z } from 'zod';

/** Highest to lowest. The order is the rank order used by `roleAtLeast`. */
export const TENANT_ROLES = ['owner', 'admin', 'staff', 'member', 'viewer'] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const tenantRoleSchema = z.enum(TENANT_ROLES);

/** Numeric rank, higher is more powerful. Custom roles rank as the base role they extend. */
export const TENANT_ROLE_RANK: Readonly<Record<TenantRole, number>> = {
  owner: 5,
  admin: 4,
  staff: 3,
  member: 2,
  viewer: 1,
};

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === 'string' && (TENANT_ROLES as readonly string[]).includes(value);
}

/** `true` when `role` ranks at or above `minimum` (`roleAtLeast('admin', 'staff')` is `true`). */
export function roleAtLeast(role: TenantRole, minimum: TenantRole): boolean {
  return TENANT_ROLE_RANK[role] >= TENANT_ROLE_RANK[minimum];
}

/**
 * Permission grammar: `<resource>:<action>`.
 *
 * - `resource`: lowercase identifier, dot-namespaced (`invoice`, `pm.issue`, `agent.session`).
 * - `action`: lowercase verb (`read`, `create`, `update`, `archive`, `restore`, `export`, ...)
 *   or `*`, reserved for "every action on the resource".
 *
 * Evaluation (wildcards, inheritance, row conditions) is PAP-59's; this is the string
 * shape stored on `role.permissions` and declared on page actions.
 */
export const PERMISSION_PATTERN =
  /^(?<resource>[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)*):(?<action>[a-z][a-z0-9_-]*|\*)$/;

export type Permission = `${string}:${string}`;

/** The permission string validated against {@link PERMISSION_PATTERN}. */
export const permissionSchema = z
  .string()
  .regex(
    PERMISSION_PATTERN,
    'expected <resource>:<action>, e.g. "invoice:read"',
  ) as unknown as z.ZodType<Permission, string>;

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSION_PATTERN.test(value);
}

export type ParsedPermission = { resource: string; action: string };

/** Split a permission into its parts, or `null` when it does not follow the grammar. */
export function parsePermission(value: string): ParsedPermission | null {
  const m = PERMISSION_PATTERN.exec(value);
  if (!m?.groups) return null;
  return { resource: m.groups.resource as string, action: m.groups.action as string };
}

/** kebab-case name for a custom role; must not be one of the five base roles. */
export const customRoleNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'custom role names are kebab-case')
  .refine((n) => !isTenantRole(n), 'custom role names cannot shadow a base role');

/**
 * A tenant-defined role. It always extends one of the five base roles, which is the role
 * audiences and rank comparisons see; `permissions` is what `can()` evaluates.
 */
export const customRoleSchema = z
  .object({
    name: customRoleNameSchema,
    extends: tenantRoleSchema,
    permissions: z.array(permissionSchema),
  })
  .strict();

export type CustomRole = { name: string; extends: TenantRole; permissions: Permission[] };

/** The base role a role name resolves to, given the tenant's custom roles. `undefined` when unknown. */
export function baseRoleOf(
  roleName: string,
  customRoles: readonly CustomRole[] = [],
): TenantRole | undefined {
  if (isTenantRole(roleName)) return roleName;
  return customRoles.find((r) => r.name === roleName)?.extends;
}
