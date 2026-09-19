/**
 * Type-level tests: `FieldSchema` narrows `value` per field type and operator.
 * These assertions are checked by `tsc` (`pnpm typecheck`), not at runtime.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  type Condition,
  condition,
  defineFields,
  type FilterTree,
  type filterTreeSchema,
  type JsonPathMatch,
  type OperatorsFor,
  type ScalarFor,
  type TypedCondition,
  type ValueFor,
  type VarRef,
} from './index.js';

const fields = defineFields({
  name: { type: 'string' },
  amount: { type: 'number' },
  active: { type: 'boolean' },
  status: { type: 'enum', values: ['open', 'closed'] },
  tags: { type: 'array', items: 'integer' },
  meta: { type: 'json' },
  due: { type: 'date' },
});
type F = typeof fields;

describe('FieldSchema narrows value types', () => {
  it('ScalarFor follows the field type, including enum members and array items', () => {
    expectTypeOf<ScalarFor<F['name']>>().toEqualTypeOf<string>();
    expectTypeOf<ScalarFor<F['amount']>>().toEqualTypeOf<number>();
    expectTypeOf<ScalarFor<F['active']>>().toEqualTypeOf<boolean>();
    expectTypeOf<ScalarFor<F['status']>>().toEqualTypeOf<'open' | 'closed'>();
    expectTypeOf<ScalarFor<F['tags']>>().toEqualTypeOf<number>();
  });

  it('OperatorsFor limits operators per type', () => {
    expectTypeOf<OperatorsFor<F['active']>>().toEqualTypeOf<
      'eq' | 'neq' | 'in' | 'nin' | 'isNull' | 'isNotNull'
    >();
    expectTypeOf<OperatorsFor<F['tags']>>().toEqualTypeOf<'has' | 'isNull' | 'isNotNull'>();
    expectTypeOf<OperatorsFor<F['meta']>>().toEqualTypeOf<'matches' | 'isNull' | 'isNotNull'>();
    expectTypeOf<'contains'>().toMatchTypeOf<OperatorsFor<F['name']>>();
    expectTypeOf<'contains'>().not.toMatchTypeOf<OperatorsFor<F['amount']>>();
  });

  it('ValueFor follows operator arity', () => {
    expectTypeOf<ValueFor<F, 'amount', 'gt'>>().toEqualTypeOf<number | VarRef>();
    expectTypeOf<ValueFor<F, 'status', 'in'>>().toEqualTypeOf<
      readonly ('open' | 'closed')[] | VarRef
    >();
    expectTypeOf<ValueFor<F, 'due', 'between'>>().toEqualTypeOf<
      readonly [string, string] | VarRef
    >();
    expectTypeOf<ValueFor<F, 'meta', 'matches'>>().toEqualTypeOf<JsonPathMatch>();
    expectTypeOf<ValueFor<F, 'name', 'isNull'>>().toEqualTypeOf<undefined>();
    expectTypeOf<ValueFor<F, 'tags', 'has'>>().toEqualTypeOf<number | VarRef>();
  });

  it('condition() rejects wrong operators and values at compile time', () => {
    expectTypeOf(condition(fields, 'amount', 'gt', 1)).toEqualTypeOf<Condition>();
    condition(fields, 'status', 'eq', 'open');
    condition(fields, 'tags', 'has', { $var: 'principal.tag' });
    // @ts-expect-error a string is not a number
    condition(fields, 'amount', 'gt', 'ten');
    // @ts-expect-error contains is not allowed on a number field
    condition(fields, 'amount', 'contains', 1);
    // @ts-expect-error "gone" is not a member of the enum
    condition(fields, 'status', 'eq', 'gone');
    // @ts-expect-error isNull takes no value
    condition(fields, 'name', 'isNull', 'x');
    // @ts-expect-error unknown field
    condition(fields, 'nope', 'isNull');
  });

  it('TypedCondition is assignable to Condition and FilterTree', () => {
    const typed: TypedCondition<F> = { field: 'status', operator: 'in', value: ['open'] };
    expectTypeOf(typed).toMatchTypeOf<Condition>();
    expectTypeOf(typed).toMatchTypeOf<FilterTree>();
    // @ts-expect-error a number field cannot use contains
    const wrong: TypedCondition<F> = { field: 'amount', operator: 'contains', value: 'x' };
    void wrong;
  });

  it('the Zod schema output is the FilterTree type', () => {
    expectTypeOf<z.output<typeof filterTreeSchema>>().toEqualTypeOf<FilterTree>();
  });
});
