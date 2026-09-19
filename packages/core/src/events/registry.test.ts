import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import './catalogue/index.js';
import {
  defineTopic,
  getTopic,
  MAX_PAYLOAD_BYTES,
  requireTopic,
  schemaFingerprint,
  TopicRegistrationError,
  topics,
  UnknownTopicError,
  unregisterTopicForTests,
} from './registry.js';

const registered: string[] = [];

function define(name: string, schema: z.ZodType = z.object({ thingId: z.string() })) {
  registered.push(name);
  return defineTopic(name, schema, { description: 'fixture', producer: 'PAP-555 test' });
}

afterEach(() => {
  for (const name of registered.splice(0)) unregisterTopicForTests(name);
});

describe('defineTopic', () => {
  it('registers a topic and lists it', () => {
    const topic = define('fixture.created');
    expect(topic.version).toBe(1);
    expect(topic.status).toBe('placeholder');
    expect(getTopic('fixture.created')).toBe(topic);
    expect(topics().map((t) => t.name)).toContain('fixture.created');
  });

  it('rejects a duplicate name at import time', () => {
    define('fixture.duplicated');
    expect(() => define('fixture.duplicated')).toThrow(TopicRegistrationError);
  });

  it('rejects a name that breaks the pattern', () => {
    expect(() => define('Fixture.Created')).toThrow(/does not match/);
    expect(() => define('fixture')).toThrow(/does not match/);
  });

  it('rejects a PII key in the payload schema', () => {
    expect(() => define('fixture.leaked', z.object({ email: z.string() }))).toThrow(/denylist/);
  });

  it('rejects a PII key nested inside the payload schema', () => {
    const schema = z.object({ actorRef: z.object({ firstName: z.string() }) });
    expect(() => define('fixture.nested', schema)).toThrow(/firstName/);
  });

  it('rejects a key that ends in a denied token', () => {
    expect(() => define('fixture.suffixed', z.object({ billingEmail: z.string() }))).toThrow(
      /billingEmail/,
    );
  });

  it('allows a key that merely contains a denied word', () => {
    expect(() => define('fixture.allowed', z.object({ jobName: z.string() }))).not.toThrow();
  });

  it('rejects a payload schema that is not expressible as JSON Schema', () => {
    expect(() => define('fixture.bigint', z.object({ total: z.bigint() }))).toThrow(
      TopicRegistrationError,
    );
  });

  it('rejects a version that is not a positive integer', () => {
    registered.push('fixture.versioned');
    expect(() =>
      defineTopic('fixture.versioned', z.object({ a: z.string() }), {
        version: 0,
        description: 'fixture',
        producer: 'PAP-555 test',
      }),
    ).toThrow(/positive integer/);
  });
});

describe('payload guards', () => {
  it('rejects a payload over 64 KB', () => {
    const topic = define('fixture.oversized', z.object({ blob: z.string() }));
    const result = topic.schema.safeParse({ blob: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('the limit is');
  });

  it('accepts a payload just under the limit', () => {
    const topic = define('fixture.sized', z.object({ blob: z.string() }));
    expect(topic.schema.safeParse({ blob: 'x'.repeat(1000) }).success).toBe(true);
  });

  it('catches a PII key that escapes the schema through a record', () => {
    const topic = define('fixture.recorded', z.record(z.string(), z.string()));
    expect(topic.schema.safeParse({ ssn: '123' }).success).toBe(false);
    expect(topic.schema.safeParse({ invoiceId: 'abc' }).success).toBe(true);
  });
});

describe('requireTopic', () => {
  it('throws UnknownTopicError for an unregistered topic', () => {
    expect(() => requireTopic('nope.happened')).toThrow(UnknownTopicError);
  });

  it('returns a catalogue topic', () => {
    expect(requireTopic('invoice.paid').name).toBe('invoice.paid');
  });
});

describe('schemaFingerprint', () => {
  it('is stable across key order', () => {
    expect(schemaFingerprint({ a: 1, b: 2 })).toBe(schemaFingerprint({ b: 2, a: 1 }));
  });

  it('changes when the schema changes', () => {
    expect(schemaFingerprint({ a: 1 })).not.toBe(schemaFingerprint({ a: 2 }));
  });
});
