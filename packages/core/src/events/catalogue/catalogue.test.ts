import { describe, expect, it } from 'vitest';
import { topics } from '../registry.js';
import { catalogue } from './index.js';

/**
 * The topic list from Interface & Data Contracts section 3, plus `flags.changed` (runtime flags)
 * and `permission.changed` (PAP-591). Atlas reviews this list for completeness: a topic named in
 * the contracts document and missing here is a gap, not a choice.
 */
const CONTRACT_TOPICS = [
  'tenant.created',
  'tenant.deleted',
  'membership.invited',
  'membership.accepted',
  'membership.removed',
  'agent.session.started',
  'agent.session.finished',
  'agent.session.blocked',
  'agent.quota.exceeded',
  'issue.needs_justin',
  'review.gate_failed',
  'review.ready',
  'release.candidate',
  'record.created',
  'record.updated',
  'record.deleted',
  'view.shared',
  'comment.created',
  'comment.mentioned',
  'comment.resolved',
  'doc.published',
  'changelog.published',
  'file.ready',
  'file.failed',
  'job.finished',
  'job.failed',
  'import.finished',
  'invoice.issued',
  'invoice.paid',
  'invoice.voided',
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'subscription.updated',
  'payroll.run.approved',
  'payroll.run.paid',
  'ledger.entry.posted',
  'ledger.entry.reversed',
  'segment.entered',
  'segment.exited',
  'webhook.delivery.failed',
  'sync.conflict',
  'flags.changed',
  'permission.changed',
] as const;

describe('initial catalogue', () => {
  it('registers every topic the contracts document names', () => {
    const registered = new Set(topics().map((topic) => topic.name));
    const missing = CONTRACT_TOPICS.filter((name) => !registered.has(name));
    expect(missing).toEqual([]);
  });

  it('exports the same set it registers', () => {
    expect(Object.keys(catalogue).sort()).toEqual([...CONTRACT_TOPICS].sort());
  });

  it('gives every topic a description, a producer and a schema fingerprint', () => {
    for (const topic of topics()) {
      expect(topic.description.length, topic.name).toBeGreaterThan(10);
      expect(topic.producer.length, topic.name).toBeGreaterThan(3);
      expect(topic.schemaHash, topic.name).toMatch(/^[0-9a-f]{16}$/);
      expect(topic.version, topic.name).toBeGreaterThanOrEqual(1);
    }
  });

  it('keys the catalogue object by the topic name it holds', () => {
    for (const [key, topic] of Object.entries(catalogue)) {
      expect(topic.name).toBe(key);
    }
  });

  it('gives every schema fingerprint a distinct value per payload shape', () => {
    const hashes = topics().map((topic) => `${topic.name}:${topic.schemaHash}`);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
