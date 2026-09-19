import { describe, expect, it } from 'vitest';
import {
  domainEventSchema,
  TOPIC_NAME_MAX_LENGTH,
  topicNameProblem,
  topicNameSchema,
} from './envelope.js';
import { uuidv7 } from './refs.js';

const validEvent = {
  id: uuidv7(),
  topic: 'invoice.paid',
  version: 1,
  occurredAt: '2026-09-19T10:00:00.000Z',
  tenantId: uuidv7(),
  actor: { id: uuidv7(), type: 'human' as const },
  subject: { type: 'invoice', id: uuidv7() },
  payload: { invoiceId: uuidv7() },
};

describe('domainEventSchema', () => {
  it('accepts the envelope from Interface & Data Contracts section 3', () => {
    expect(domainEventSchema.parse(validEvent)).toMatchObject({ topic: 'invoice.paid' });
  });

  it('accepts a platform event with no tenant', () => {
    expect(domainEventSchema.parse({ ...validEvent, tenantId: null }).tenantId).toBeNull();
  });

  it('accepts the optional correlation fields', () => {
    const parsed = domainEventSchema.parse({
      ...validEvent,
      requestId: 'req_01J8',
      causationId: uuidv7(),
      correlationId: uuidv7(),
      idempotencyKey: 'invoice-paid-42',
    });
    expect(parsed.idempotencyKey).toBe('invoice-paid-42');
  });

  it('rejects a missing subject', () => {
    const { subject: _subject, ...withoutSubject } = validEvent;
    expect(domainEventSchema.safeParse(withoutSubject).success).toBe(false);
  });

  it('rejects an upper-case topic', () => {
    expect(domainEventSchema.safeParse({ ...validEvent, topic: 'Invoice.Paid' }).success).toBe(
      false,
    );
  });

  it('rejects a non-UUID id', () => {
    expect(domainEventSchema.safeParse({ ...validEvent, id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects a version of zero', () => {
    expect(domainEventSchema.safeParse({ ...validEvent, version: 0 }).success).toBe(false);
  });
});

describe('topic names', () => {
  it.each([
    'invoice.paid',
    'agent.session.started',
    'payroll.run.approved',
    'issue.needs_justin',
    'webhook.delivery.failed',
  ])('accepts %s', (name) => {
    expect(topicNameProblem(name)).toBeUndefined();
    expect(topicNameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    ['Invoice.Paid', 'upper case'],
    ['invoice', 'one segment'],
    ['invoice..paid', 'empty segment'],
    ['invoice-paid', 'no dot'],
    ['invoice.paid.by.card.today', 'five segments'],
    ['1invoice.paid', 'leading digit'],
  ])('rejects %s (%s)', (name) => {
    expect(topicNameProblem(name)).toBeDefined();
  });

  it(`rejects a name longer than ${TOPIC_NAME_MAX_LENGTH} characters`, () => {
    const long = `${'a'.repeat(TOPIC_NAME_MAX_LENGTH)}.created`;
    expect(topicNameProblem(long)).toContain('the limit is');
  });
});
