import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { actorRefSchema, principalTypeSchema } from './actor.js';
import { cursorPayloadSchema } from './cursor.js';
import { entityKeySchema, entityRefSchema, entityTypeSchema } from './entity.js';
import { apiErrorBodySchema, apiErrorCodeSchema } from './error.js';
import type { Uuid } from './ids.js';
import { uuidSchema } from './ids.js';
import { type Money, moneyJsonSchema } from './money.js';
import { durationSchema, isoDateSchema, isoDateTimeSchema } from './time.js';

/** Every schema that describes something crossing a process boundary. */
const WIRE_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  actorRefSchema,
  apiErrorBodySchema,
  apiErrorCodeSchema,
  cursorPayloadSchema,
  durationSchema,
  entityKeySchema,
  entityRefSchema,
  entityTypeSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneyJsonSchema,
  principalTypeSchema,
  uuidSchema,
};

describe('wire schemas', () => {
  it.each(Object.keys(WIRE_SCHEMAS))('%s renders as JSON Schema', (name) => {
    const schema = WIRE_SCHEMAS[name] as z.ZodType;
    const json = JSON.stringify(z.toJSONSchema(schema, { io: 'input' }));
    expect(json).not.toContain('bigint');
  });

  it('puts money on the wire as a string, never a number or a bigint', () => {
    const json = z.toJSONSchema(moneyJsonSchema) as unknown as {
      properties: { amountMinor: { type: string } };
    };
    expect(json.properties.amountMinor.type).toBe('string');
  });

  it('proves the rule: a schema holding z.bigint() cannot be rendered', () => {
    expect(() => z.toJSONSchema(z.object({ amountMinor: z.bigint() }))).toThrow();
  });

  it('keeps the branded types branded through the schemas', () => {
    expectTypeOf<z.output<typeof uuidSchema>>().toEqualTypeOf<Uuid>();
    expectTypeOf<z.output<typeof entityRefSchema>['id']>().toEqualTypeOf<Uuid>();
    expectTypeOf<z.output<typeof actorRefSchema>['id']>().toEqualTypeOf<Uuid>();
    expectTypeOf<Money['amountMinor']>().toEqualTypeOf<bigint>();
  });
});
