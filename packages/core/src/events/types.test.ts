/**
 * Type-level contract. `pnpm typecheck` is the real gate; the assertions run under Vitest too so
 * a regression shows up as a failing test and not only as a red editor.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { DomainEvent } from './envelope.js';
import { publish } from './publish.js';
import type { TopicName, TopicPayload } from './registry.js';
import { on } from './subscribe.js';
import { createTestTransaction } from './testing.js';
import './catalogue/index.js';

describe('topic payload inference', () => {
  it("infers the payload of on('invoice.paid', h)", () => {
    on(
      'invoice.paid',
      (event) => {
        expectTypeOf(event).toEqualTypeOf<DomainEvent<TopicPayload<'invoice.paid'>>>();
        expectTypeOf(event.payload.invoiceId).toEqualTypeOf<string>();
        expectTypeOf(event.payload.amountMinor).toEqualTypeOf<string>();
        expectTypeOf(event.payload.paymentId).toEqualTypeOf<string | null>();
        expectTypeOf(event.tenantId).toEqualTypeOf<string | null>();
        // @ts-expect-error the invoice.paid payload has no `total`
        event.payload.total;
      },
      { name: 'types.invoice.paid', idempotent: true },
    );
  });

  it('infers a different payload for a different topic', () => {
    on(
      'agent.session.started',
      (event) => {
        expectTypeOf(event.payload.character).toEqualTypeOf<string>();
        expectTypeOf(event.payload.issueKey).toEqualTypeOf<string>();
      },
      { name: 'types.agent.session.started', idempotent: true },
    );
  });

  it('rejects an unregistered topic at compile time', () => {
    // @ts-expect-error 'invoice.hugged' is not a registered topic
    const bad: TopicName = 'invoice.hugged';
    expectTypeOf(bad).toEqualTypeOf<TopicName>();
  });

  it('types the publish payload and return value', async () => {
    const promise = publish(createTestTransaction(), {
      topic: 'flags.changed',
      tenantId: null,
      actor: { id: '00000000-0000-7000-8000-000000000000', type: 'service' },
      subject: { type: 'flag', id: '00000000-0000-7000-8000-000000000001' },
      payload: {
        flagKey: 'events.dispatcher',
        scope: 'global',
        scopeId: null,
        enabled: true,
        variant: null,
      },
    });
    expectTypeOf(promise).resolves.toEqualTypeOf<DomainEvent<TopicPayload<'flags.changed'>>>();
    await promise.catch(() => undefined);
  });

  it('rejects a payload that does not match the topic', () => {
    // @ts-expect-error `invoiceId` is required on invoice.paid
    const wrong: TopicPayload<'invoice.paid'> = { amountMinor: '1' };
    expectTypeOf(wrong).not.toBeNever();
  });
});
