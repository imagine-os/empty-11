/** File, job, import, flag and sync topics. Producers: PAP-37, PAP-43, PAP-199, PAP-222, PAP-148. */
import { z } from 'zod';
import { defineTopic } from '../registry.js';
import { errorCode, key, nullableUuid, uuid } from './_shared.js';

export const fileReady = defineTopic(
  'file.ready',
  z.object({
    fileId: uuid,
    sizeBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    mediaType: key,
  }),
  {
    description: 'An uploaded file finished processing and can be linked.',
    producer: 'PAP-37 object storage',
    consumers: ['PAP-136 notifications', 'PAP-39 search', 'PAP-354 media pipeline'],
  },
);

export const fileFailed = defineTopic(
  'file.failed',
  z.object({ fileId: uuid, errorCode, attempt: z.number().int().positive() }),
  {
    description: 'An upload or a processing step failed for a file.',
    producer: 'PAP-37 object storage',
    consumers: ['PAP-136 notifications'],
  },
);

export const jobFinished = defineTopic(
  'job.finished',
  z.object({
    jobId: uuid,
    jobName: key,
    queue: key,
    durationMs: z.number().int().nonnegative(),
  }),
  {
    description: 'A background job completed successfully.',
    producer: 'PAP-43 jobs',
    consumers: ['PAP-174 automation triggers', 'PAP-113 agent console'],
  },
);

export const jobFailed = defineTopic(
  'job.failed',
  z.object({
    jobId: uuid,
    jobName: key,
    queue: key,
    attempt: z.number().int().positive(),
    errorCode,
    deadLettered: z.boolean(),
  }),
  {
    description: 'A background job failed; `deadLettered` marks the final attempt.',
    producer: 'PAP-43 jobs',
    consumers: ['PAP-136 notifications', 'PAP-40 observability'],
  },
);

export const importFinished = defineTopic(
  'import.finished',
  z.object({
    importId: uuid,
    source: key,
    rowsImported: z.number().int().nonnegative(),
    rowsFailed: z.number().int().nonnegative(),
  }),
  {
    description: 'A data import run finished, successfully or with rejected rows.',
    producer: 'PAP-199 importers',
    consumers: ['PAP-136 notifications'],
  },
);

export const flagsChanged = defineTopic(
  'flags.changed',
  z.object({
    flagKey: key,
    scope: z.enum(['global', 'tenant', 'workspace', 'principal']),
    scopeId: nullableUuid,
    enabled: z.boolean(),
    variant: key.nullable(),
  }),
  {
    description: 'A runtime feature flag changed; caches and open clients re-read it.',
    producer: 'app-shell runtime flags',
    consumers: ['PAP-435 module swap', 'PAP-97 orchestrator'],
  },
);

export const syncConflict = defineTopic(
  'sync.conflict',
  z.object({
    dataset: key,
    recordId: uuid,
    clientMutationId: key,
    resolution: z.enum(['server_wins', 'client_wins', 'merged', 'manual']),
  }),
  {
    description: 'An offline write collided with the server row and was resolved.',
    producer: 'PAP-148 local-first sync',
    consumers: ['PAP-136 notifications', 'PAP-272 offline outbox'],
  },
);

export const webhookDeliveryFailed = defineTopic(
  'webhook.delivery.failed',
  z.object({
    endpointId: uuid,
    deliveryId: uuid,
    sourceEventId: uuid,
    attempt: z.number().int().positive(),
    statusCode: z.number().int().nullable(),
    errorCode,
  }),
  {
    description: 'A tenant webhook delivery failed; repeated failures disable the endpoint.',
    producer: 'PAP-222 tenant webhooks',
    consumers: ['PAP-136 notifications', 'PAP-222 tenant webhooks'],
  },
);

export const platformTopics = {
  'file.ready': fileReady,
  'file.failed': fileFailed,
  'job.finished': jobFinished,
  'job.failed': jobFailed,
  'import.finished': importFinished,
  'flags.changed': flagsChanged,
  'sync.conflict': syncConflict,
  'webhook.delivery.failed': webhookDeliveryFailed,
} as const;
