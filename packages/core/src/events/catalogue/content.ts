/** Record, view, comment and document topics. Producers: PAP-38, PAP-172, PAP-131, PAP-128, PAP-133. */
import { z } from 'zod';
import { defineTopic } from '../registry.js';
import { at, changedFields, key, nullableUuid, uuid } from './_shared.js';

const datasetKey = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/);

export const recordCreated = defineTopic(
  'record.created',
  z.object({ dataset: datasetKey, recordId: uuid, workspaceId: nullableUuid }),
  {
    description: 'A row was inserted in a registered dataset (audit trigger, filtered by dataset).',
    producer: 'PAP-38 audit log',
    consumers: ['PAP-174 automation triggers', 'PAP-195 segments', 'PAP-39 search'],
  },
);

export const recordUpdated = defineTopic(
  'record.updated',
  z.object({ dataset: datasetKey, recordId: uuid, workspaceId: nullableUuid, changedFields }),
  {
    description: 'A row changed; the event names the fields, never their values.',
    producer: 'PAP-38 audit log',
    consumers: ['PAP-174 automation triggers', 'PAP-195 segments', 'PAP-39 search', 'PAP-148 sync'],
  },
);

export const recordDeleted = defineTopic(
  'record.deleted',
  z.object({ dataset: datasetKey, recordId: uuid, workspaceId: nullableUuid, soft: z.boolean() }),
  {
    description: 'A row was soft-deleted or purged.',
    producer: 'PAP-38 audit log',
    consumers: ['PAP-174 automation triggers', 'PAP-39 search', 'PAP-355 retention'],
  },
);

export const viewShared = defineTopic(
  'view.shared',
  z.object({
    viewId: uuid,
    visibility: z.enum(['personal', 'shared', 'public']),
    audienceKind: z.enum(['user', 'workspace', 'tenant', 'link']),
    audienceId: nullableUuid,
  }),
  {
    description: 'A saved view was shared with a wider audience.',
    producer: 'PAP-172 view sharing',
    consumers: ['PAP-136 notifications'],
  },
);

export const commentCreated = defineTopic(
  'comment.created',
  z.object({
    threadId: uuid,
    commentId: uuid,
    anchorKey: key,
    authorKind: z.enum(['human', 'agent', 'service']),
  }),
  {
    description: 'A comment was posted on an entity, element, doc block, canvas node or frame.',
    producer: 'PAP-131 annotations',
    consumers: ['PAP-136 notifications', 'PAP-100 pm mirror'],
  },
);

export const commentMentioned = defineTopic(
  'comment.mentioned',
  z.object({ threadId: uuid, commentId: uuid, mentionedPrincipalId: uuid }),
  {
    description: 'A comment mentioned a principal, who gets a notification.',
    producer: 'PAP-131 annotations',
    consumers: ['PAP-136 notifications'],
  },
);

export const commentResolved = defineTopic(
  'comment.resolved',
  z.object({ threadId: uuid, commentId: nullableUuid, resolvedBy: uuid }),
  {
    description: 'A comment thread was resolved.',
    producer: 'PAP-131 annotations',
    consumers: ['PAP-136 notifications', 'PAP-100 pm mirror'],
  },
);

export const docPublished = defineTopic(
  'doc.published',
  z.object({ docPath: key, revision: key, publishedAt: at }),
  {
    description: 'A documentation page was published at a new revision.',
    producer: 'PAP-128 docs',
    consumers: ['PAP-39 search', 'PAP-136 notifications'],
  },
);

export const changelogPublished = defineTopic(
  'changelog.published',
  z.object({ version: key, releaseId: uuid, entryCount: z.number().int().nonnegative() }),
  {
    description: 'A changelog was assembled from the unreleased fragments and published.',
    producer: 'PAP-133 changelog',
    consumers: ['PAP-136 notifications', 'PAP-222 webhooks'],
  },
);

export const contentTopics = {
  'record.created': recordCreated,
  'record.updated': recordUpdated,
  'record.deleted': recordDeleted,
  'view.shared': viewShared,
  'comment.created': commentCreated,
  'comment.mentioned': commentMentioned,
  'comment.resolved': commentResolved,
  'doc.published': docPublished,
  'changelog.published': changelogPublished,
} as const;
