/** Tenant, membership and permission topics. Producers: PAP-58 (identity), PAP-591. */
import { z } from 'zod';
import { defineTopic } from '../registry.js';
import { at, changedFields, key, nullableUuid, reasonCode, slug, uuid } from './_shared.js';

export const tenantCreated = defineTopic(
  'tenant.created',
  z.object({ tenantId: uuid, slug, plan: key, createdBy: uuid }),
  {
    description: 'A tenant (organisation) was provisioned with its default workspace.',
    producer: 'PAP-58 identity',
    consumers: ['PAP-136 notifications', 'PAP-97 orchestrator', 'PAP-222 webhooks'],
  },
);

export const tenantDeleted = defineTopic(
  'tenant.deleted',
  z.object({ tenantId: uuid, purgeAfter: at, requestedBy: uuid }),
  {
    description: 'A tenant was soft-deleted; the 30-day purge grace period starts at occurredAt.',
    producer: 'PAP-58 identity',
    consumers: ['PAP-432 tenant lifecycle', 'PAP-355 retention'],
  },
);

export const membershipInvited = defineTopic(
  'membership.invited',
  z.object({
    membershipId: uuid,
    tenantId: uuid,
    workspaceId: nullableUuid,
    /** `null` until the invitee has a user row; the address itself never travels. */
    inviteeUserId: nullableUuid,
    roleId: uuid,
    invitedBy: uuid,
  }),
  {
    description: 'Someone was invited to a tenant or workspace.',
    producer: 'PAP-58 identity',
    consumers: ['PAP-136 notifications', 'PAP-370 transactional email'],
  },
);

export const membershipAccepted = defineTopic(
  'membership.accepted',
  z.object({
    membershipId: uuid,
    tenantId: uuid,
    workspaceId: nullableUuid,
    userId: uuid,
    roleId: uuid,
  }),
  {
    description: 'An invitation was accepted and the membership became active.',
    producer: 'PAP-58 identity',
    consumers: ['PAP-136 notifications', 'PAP-195 segments'],
  },
);

export const membershipRemoved = defineTopic(
  'membership.removed',
  z.object({
    membershipId: uuid,
    tenantId: uuid,
    workspaceId: nullableUuid,
    userId: uuid,
    reasonCode,
  }),
  {
    description: 'A membership was revoked or the member left.',
    producer: 'PAP-58 identity',
    consumers: ['PAP-136 notifications', 'PAP-591 permission propagation'],
  },
);

export const permissionChanged = defineTopic(
  'permission.changed',
  z.object({
    tenantId: uuid,
    /** What the grant hangs off: a role, one membership, or a single principal. */
    subjectKind: z.enum(['role', 'membership', 'principal']),
    subjectId: uuid,
    added: changedFields,
    removed: changedFields,
    changedBy: uuid,
  }),
  {
    description:
      'A permission grant changed; caches and open sessions re-evaluate access (PAP-591).',
    producer: 'PAP-591 permission propagation',
    consumers: ['PAP-59 policy engine', 'PAP-591 permission propagation', 'PAP-97 orchestrator'],
  },
);

export const tenancyTopics = {
  'tenant.created': tenantCreated,
  'tenant.deleted': tenantDeleted,
  'membership.invited': membershipInvited,
  'membership.accepted': membershipAccepted,
  'membership.removed': membershipRemoved,
  'permission.changed': permissionChanged,
} as const;
