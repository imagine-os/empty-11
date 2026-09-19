import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type ActorRef,
  ANONYMOUS_ACTOR,
  actorRefSchema,
  isAnonymous,
  isPrincipalType,
  type PrincipalType,
  toActorRef,
} from './actor.js';
import { ValidationError } from './error.js';
import { NIL_UUID, uuidv7 } from './ids.js';

describe('ActorRef', () => {
  const id = uuidv7();

  it('projects a Principal down to what a row stores', () => {
    expect(toActorRef({ id, type: 'human' })).toEqual({ id, type: 'human' });
    expect(toActorRef({ id, type: 'agent', attributes: { character: 'forge' } })).toEqual({
      id,
      type: 'agent',
      character: 'forge',
    });
    expect(toActorRef({ id, type: 'service', attributes: null })).toEqual({ id, type: 'service' });
    expect(toActorRef({ id, type: 'human', attributes: { character: 42 } })).toEqual({
      id,
      type: 'human',
    });
    expect(toActorRef({ id, type: 'human', attributes: { character: '' } })).toEqual({
      id,
      type: 'human',
    });
  });

  it('records impersonation', () => {
    const behalf = uuidv7();
    expect(toActorRef({ id, type: 'agent' }, { onBehalfOf: behalf }).onBehalfOf).toBe(behalf);
  });

  it('refuses an id or a type it does not recognise', () => {
    expect(() => toActorRef({ id: 'nope', type: 'human' })).toThrow();
    expect(() => toActorRef({ id, type: 'robot' as PrincipalType })).toThrow(ValidationError);
  });

  it('has one anonymous actor, frozen, with the nil id', () => {
    expect(ANONYMOUS_ACTOR).toEqual({ id: NIL_UUID, type: 'anonymous' });
    expect(Object.isFrozen(ANONYMOUS_ACTOR)).toBe(true);
    expect(isAnonymous(ANONYMOUS_ACTOR)).toBe(true);
    expect(isAnonymous(toActorRef({ id, type: 'human' }))).toBe(false);
  });

  it('knows the four principal types', () => {
    expect(isPrincipalType('human')).toBe(true);
    expect(isPrincipalType('robot')).toBe(false);
    expect(isPrincipalType(7)).toBe(false);
  });

  it('parses the wire shape', () => {
    expect(actorRefSchema.parse({ id, type: 'agent', character: 'forge' })).toEqual({
      id,
      type: 'agent',
      character: 'forge',
    });
    expect(actorRefSchema.safeParse({ id, type: 'robot' }).success).toBe(false);
  });

  it('uses exactly the PAP-55 PrincipalType enum', () => {
    // When PAP-55 lands, replace the local declaration in actor.ts with a
    // re-export of `@paperos/core/audience` and this assertion keeps its
    // meaning: the two unions must stay identical.
    expectTypeOf<ActorRef['type']>().toEqualTypeOf<PrincipalType>();
    expectTypeOf<PrincipalType>().toEqualTypeOf<'human' | 'agent' | 'service' | 'anonymous'>();
  });
});
