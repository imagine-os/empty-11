import { afterEach, describe, expect, it } from 'vitest';
import {
  assertEntityType,
  entityKeySchema,
  entityRef,
  entityRefSchema,
  formatEntityKey,
  isEntityKey,
  parseEntityKey,
  setEntityTypeValidator,
} from './entity.js';
import { ValidationError } from './error.js';
import { uuidv7 } from './ids.js';

const id = uuidv7();
const restorers: (() => void)[] = [];

afterEach(() => {
  while (restorers.length > 0) (restorers.pop() as () => void)();
});

describe('EntityRef', () => {
  it('formats and parses the PAP-131 anchor grammar', () => {
    const ref = entityRef('invoice', id);
    expect(formatEntityKey(ref)).toBe(`entity:invoice:${id}`);
    expect(parseEntityKey(`entity:invoice:${id}`)).toEqual(ref);
    expect(isEntityKey(`entity:pm_issue:${id}`)).toBe(true);
  });

  it('rejects anything that is not the grammar', () => {
    expect(() => parseEntityKey(`invoice:${id}`)).toThrow(ValidationError);
    expect(() => parseEntityKey(`element:/invoices:total`)).toThrow(ValidationError);
    expect(() => parseEntityKey(`entity:Invoice:${id}`)).toThrow(/lower_snake_case/);
    expect(() => parseEntityKey('entity:invoice:nope')).toThrow(/UUID/);
    expect(() => formatEntityKey({ type: 'invoice', id: 'nope' as never })).toThrow(/UUID/);
    expect(isEntityKey(`entity:invoice:nope`)).toBe(false);
    expect(isEntityKey(7)).toBe(false);
  });

  it('is free-form until the dataset registry installs a validator', () => {
    expect(() => assertEntityType('anything_at_all')).not.toThrow();
    restorers.push(setEntityTypeValidator((type) => type === 'invoice'));
    expect(() => assertEntityType('invoice')).not.toThrow();
    expect(() => assertEntityType('anything_at_all')).toThrow(/unknown entity type/);
  });

  it('restores the previous validator', () => {
    const restore = setEntityTypeValidator(() => false);
    restore();
    expect(() => assertEntityType('invoice')).not.toThrow();
  });

  it('parses the wire shapes', () => {
    expect(entityRefSchema.parse({ type: 'invoice', id })).toEqual({ type: 'invoice', id });
    expect(entityRefSchema.safeParse({ type: 'Invoice', id }).success).toBe(false);
    expect(entityKeySchema.parse(`entity:invoice:${id}`)).toBe(`entity:invoice:${id}`);
    expect(entityKeySchema.safeParse('entity:invoice').success).toBe(false);
  });
});
