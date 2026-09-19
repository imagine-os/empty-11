import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ActorRef, EntityRef } from './refs.js';
import { actorRefSchema, entityRefSchema, formatEntityKey, uuidv7 } from './refs.js';

describe('uuidv7', () => {
  it('produces a canonical version 7, variant 10 uuid', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('sorts lexicographically by creation time', () => {
    const early = uuidv7(Date.UTC(2026, 0, 1));
    const late = uuidv7(Date.UTC(2026, 8, 19));
    expect(early < late).toBe(true);
  });

  it('is unique across a tight loop', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uuidv7()));
    expect(ids.size).toBe(2000);
  });
});

describe('ActorRef and EntityRef', () => {
  it('matches the PAP-302 shape the contracts document fixes', () => {
    // Type-equality guard: when `@paperos/core/types` lands, this file re-exports from it and
    // this assertion still has to hold (PAP-302, ADR 0011).
    expectTypeOf<ActorRef['type']>().toEqualTypeOf<'human' | 'agent' | 'service' | 'anonymous'>();
    expectTypeOf<EntityRef>().toMatchObjectType<{ type: string; id: string }>();
  });

  it('accepts an agent actor with a character', () => {
    const actor = actorRefSchema.parse({ id: uuidv7(), type: 'agent', character: 'forge' });
    expect(actor.character).toBe('forge');
  });

  it('rejects an unknown actor type', () => {
    expect(actorRefSchema.safeParse({ id: uuidv7(), type: 'robot' }).success).toBe(false);
  });

  it('formats the PAP-131 anchor key', () => {
    const id = uuidv7();
    const ref = entityRefSchema.parse({ type: 'invoice', id });
    expect(formatEntityKey(ref)).toBe(`entity:invoice:${id}`);
  });

  it('rejects a camelCase entity type', () => {
    expect(entityRefSchema.safeParse({ type: 'pmIssue', id: uuidv7() }).success).toBe(false);
  });
});
