/**
 * `@paperos/core/events` — the domain event contract (PAP-555, ADR 0013).
 *
 * One way to say "something happened": a typed envelope, a registry of topics with Zod payloads,
 * and a `publish()` that writes to a transactional outbox in the same transaction as the row
 * change. Importing this module registers the catalogue, so an unregistered topic fails at boot.
 *
 * ```ts
 * import { publish, on } from '@paperos/core/events';
 *
 * on('invoice.paid', async (event) => { await sendReceipt(event.payload.invoiceId); },
 *    { name: 'billing.receipt', idempotent: true });
 *
 * await db.transaction(async (tx) => {
 *   await tx.update(invoice).set({ status: 'paid' }).where(eq(invoice.id, id));
 *   await publish(tx, { topic: 'invoice.paid', tenantId, actor, subject: { type: 'invoice', id }, payload });
 * });
 * ```
 *
 * Dispatch, fan-out, dead-lettering and replay are the sibling issue PAP-556; until it merges,
 * `drainInProcess(tx)` delivers to in-process subscribers after commit.
 */

// Registers every catalogue topic as a side effect of importing the barrel.
import './catalogue/index.js';

export { type Catalogue, type CataloguePayloads, catalogue } from './catalogue/index.js';

export {
  type DomainEvent,
  domainEventSchema,
  type PublishInputBase,
  publishInputBaseSchema,
  TOPIC_NAME_MAX_LENGTH,
  TOPIC_NAME_PATTERN,
  topicNameProblem,
  topicNameSchema,
} from './envelope.js';
export {
  isPiiKey,
  MAX_PAYLOAD_BYTES as MAX_EVENT_PAYLOAD_BYTES,
  normaliseKey,
  payloadByteLength,
  piiPolicyVersion,
  piiReasonFor,
} from './pii.js';
export {
  getOutboxDriver,
  hasOutboxDriver,
  NoOutboxDriverError,
  NotInTransactionError,
  type OutboxDriver,
  type OutboxEventRow,
  type OutboxInsertResult,
  type PublishInput,
  publish,
  setOutboxDriver,
  TopicVersionMismatchError,
  type Tx,
} from './publish.js';
export {
  type ActorKind,
  type ActorRef,
  actorKindSchema,
  actorRefSchema,
  type EntityRef,
  entityRefSchema,
  formatEntityKey,
  isoDateTimeSchema,
  SYSTEM_ACTOR,
  SYSTEM_ACTOR_ID,
  type Uuid,
  uuidSchema,
  uuidv7,
} from './refs.js';
export {
  defineTopic,
  getTopic,
  isRegisteredTopic,
  MAX_PAYLOAD_BYTES,
  requireTopic,
  schemaFingerprint,
  type TopicDefinition,
  type TopicMap,
  type TopicName,
  type TopicOptions,
  type TopicPayload,
  TopicRegistrationError,
  type TopicStatus,
  topics,
  UnknownTopicError,
  unregisterTopicForTests,
} from './registry.js';
export {
  type DrainFailure,
  type DrainResult,
  drainInProcess,
  type EventHandler,
  off,
  on,
  pendingEvents,
  resetSubscriptionsForTests,
  type Subscription,
  SubscriptionError,
  type SubscriptionKind,
  type SubscriptionOptions,
  subscriptions,
} from './subscribe.js';
