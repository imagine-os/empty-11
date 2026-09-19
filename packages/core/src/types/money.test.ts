import fc from 'fast-check';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ValidationError } from './error.js';
import {
  abs,
  add,
  allocate,
  assertSameCurrency,
  CurrencyMismatch,
  compare,
  currency,
  decimal,
  equals,
  fromMajorUnits,
  isMoney,
  isNegative,
  isPositive,
  isZero,
  type Money,
  minorUnits,
  money,
  moneyJson,
  moneyJsonSchema,
  moneySchema,
  multiply,
  negate,
  subtract,
  toMajorUnits,
  zeroMoney,
} from './money.js';

const usd = (minor: bigint | number | string): Money => money(minor, 'USD');

describe('currency and minor units', () => {
  it('normalises and validates the code', () => {
    expect(currency('usd')).toBe('USD');
    expect(() => currency('dollars')).toThrow(ValidationError);
  });

  it('knows the currencies that are not two-decimal', () => {
    expect(minorUnits('USD')).toBe(2);
    expect(minorUnits('JPY')).toBe(0);
    expect(minorUnits('BHD')).toBe(3);
    expect(minorUnits('KWD')).toBe(3);
    expect(minorUnits('CLF')).toBe(4);
  });
});

describe('construction', () => {
  it('accepts a bigint, a safe integer and an integer string', () => {
    expect(usd(1999n).amountMinor).toBe(1999n);
    expect(usd(1999).amountMinor).toBe(1999n);
    expect(usd('-1999').amountMinor).toBe(-1999n);
    expect(zeroMoney('eur')).toEqual({ amountMinor: 0n, currency: 'EUR' });
  });

  it('refuses a float, an unsafe integer and a non-integer string', () => {
    expect(() => usd(19.99)).toThrow(ValidationError);
    expect(() => usd(2 ** 53)).toThrow(ValidationError);
    expect(() => usd('19.99')).toThrow(ValidationError);
  });

  it('recognises its own shape', () => {
    expect(isMoney(usd(1n))).toBe(true);
    expect(isMoney(null)).toBe(false);
    expect(isMoney('USD')).toBe(false);
    expect(isMoney({ amountMinor: 1, currency: 'USD' })).toBe(false);
    expect(isMoney({ amountMinor: 1n, currency: 5 })).toBe(false);
    expect(isMoney({ amountMinor: 1n, currency: 'dollars' })).toBe(false);
  });
});

describe('arithmetic', () => {
  it('adds, subtracts, negates and takes an absolute value', () => {
    expect(add(usd(1999n), usd(1n))).toEqual(usd(2000n));
    expect(subtract(usd(1999n), usd(2000n))).toEqual(usd(-1n));
    expect(negate(usd(5n))).toEqual(usd(-5n));
    expect(abs(usd(-5n))).toEqual(usd(5n));
    expect(abs(usd(5n))).toEqual(usd(5n));
  });

  it('orders and compares', () => {
    expect(compare(usd(1n), usd(2n))).toBe(-1);
    expect(compare(usd(2n), usd(1n))).toBe(1);
    expect(compare(usd(2n), usd(2n))).toBe(0);
    expect(equals(usd(2n), usd(2n))).toBe(true);
    expect(equals(usd(2n), money(2n, 'EUR'))).toBe(false);
    expect(equals(usd(2n), usd(3n))).toBe(false);
    expect(isZero(zeroMoney('USD'))).toBe(true);
    expect(isNegative(usd(-1n))).toBe(true);
    expect(isPositive(usd(1n))).toBe(true);
  });

  it('throws CurrencyMismatch rather than guessing a rate', () => {
    const error = (): void => assertSameCurrency(usd(1n), money(1n, 'EUR'));
    expect(error).toThrow(CurrencyMismatch);
    expect(error).toThrow(/cannot combine USD and EUR/);
    expect(() => add(usd(1n), money(1n, 'EUR'))).toThrow(CurrencyMismatch);
    expect(() => subtract(usd(1n), money(1n, 'EUR'))).toThrow(CurrencyMismatch);
    expect(() => compare(usd(1n), money(1n, 'EUR'))).toThrow(CurrencyMismatch);
    try {
      assertSameCurrency(usd(1n), money(1n, 'EUR'));
    } catch (thrown) {
      const mismatch = thrown as CurrencyMismatch;
      expect(mismatch.code).toBe('VALIDATION');
      expect([mismatch.left, mismatch.right]).toEqual(['USD', 'EUR']);
    }
  });

  it('survives amounts past Number.MAX_SAFE_INTEGER', () => {
    const big = usd(9007199254740993n);
    expect(add(big, usd(1n)).amountMinor).toBe(9007199254740994n);
  });
});

describe('multiply', () => {
  it('applies an exact ratio and rounds half-even by default', () => {
    expect(multiply(usd(1999n), '0.0825').amountMinor).toBe(165n);
    expect(multiply(usd(1999n), 3n).amountMinor).toBe(5997n);
    expect(multiply(usd(1000n), 0.5).amountMinor).toBe(500n);
    expect(multiply(usd(1n), '1').amountMinor).toBe(1n);
  });

  it.each([
    ['halfEven', '2.5', 2n],
    ['halfEven', '3.5', 4n],
    ['halfEven', '2.4', 2n],
    ['halfEven', '2.6', 3n],
    ['halfUp', '2.5', 3n],
    ['halfUp', '2.4', 2n],
    ['down', '2.9', 2n],
    ['up', '2.1', 3n],
    ['floor', '2.9', 2n],
    ['ceil', '2.1', 3n],
  ] as const)('rounds %s of %s to %s', (mode, ratio, expected) => {
    expect(multiply(usd(1n), ratio, mode).amountMinor).toBe(expected);
  });

  it.each([
    ['halfEven', '-2.5', -2n],
    ['halfEven', '-3.5', -4n],
    ['halfEven', '-2.6', -3n],
    ['halfEven', '-2.4', -2n],
    ['halfUp', '-2.5', -3n],
    ['halfUp', '-2.4', -2n],
    ['down', '-2.9', -2n],
    ['up', '-2.1', -3n],
    ['floor', '-2.1', -3n],
    ['ceil', '-2.9', -2n],
  ] as const)('rounds %s of %s to %s', (mode, ratio, expected) => {
    expect(multiply(usd(1n), ratio, mode).amountMinor).toBe(expected);
  });

  it('refuses a ratio it cannot read exactly', () => {
    expect(() => multiply(usd(1n), 'half')).toThrow(ValidationError);
    expect(() => multiply(usd(1n), Number.POSITIVE_INFINITY)).toThrow(ValidationError);
    expect(() => multiply(usd(1n), 1e-7)).toThrow(/decimal string/);
  });
});

describe('decimal', () => {
  it('renders an exact decimal from every accepted input', () => {
    expect(decimal('+1.50')).toBe('1.50');
    expect(decimal(-2)).toBe('-2');
    expect(decimal(12n)).toBe('12');
    expect(decimal('-0.005')).toBe('-0.005');
  });
});

describe('allocate', () => {
  it('splits $19.99 three ways without losing or inventing a cent', () => {
    const parts = allocate(usd(1999n), [1, 1, 1]);
    expect(parts.map((part) => part.amountMinor)).toEqual([667n, 666n, 666n]);
  });

  it('gives the leftover to the largest remainder, ties by position', () => {
    expect(allocate(usd(100n), ['0.5', '0.3', '0.2']).map((p) => p.amountMinor)).toEqual([
      50n,
      30n,
      20n,
    ]);
    expect(allocate(usd(10n), [3, 1]).map((p) => p.amountMinor)).toEqual([8n, 2n]);
    expect(allocate(usd(100n), [1, 2, 3]).map((p) => p.amountMinor)).toEqual([17n, 33n, 50n]);
  });

  it('is exact when nothing is left over', () => {
    expect(allocate(usd(300n), [1, 1, 1]).map((p) => p.amountMinor)).toEqual([100n, 100n, 100n]);
  });

  it('handles negative amounts and zero-weight shares', () => {
    expect(allocate(usd(-1999n), [1, 1, 1]).map((p) => p.amountMinor)).toEqual([
      -666n,
      -666n,
      -667n,
    ]);
    expect(allocate(usd(100n), [1, 0]).map((p) => p.amountMinor)).toEqual([100n, 0n]);
  });

  it('allocates in the currency minor unit, whatever that is', () => {
    expect(allocate(money(1000n, 'JPY'), [1, 1, 1]).map((p) => p.amountMinor)).toEqual([
      334n,
      333n,
      333n,
    ]);
    expect(allocate(money(19990n, 'BHD'), [1, 1, 1]).map((p) => p.amountMinor)).toEqual([
      6664n,
      6663n,
      6663n,
    ]);
  });

  it('refuses ratios it cannot split by', () => {
    expect(() => allocate(usd(1n), [])).toThrow(/at least one ratio/);
    expect(() => allocate(usd(1n), [1, -1])).toThrow(/cannot be negative/);
    expect(() => allocate(usd(1n), [0, 0])).toThrow(/more than zero/);
  });

  it('always sums back to the original amount (property)', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 18n), max: 10n ** 18n }),
        fc.array(fc.nat({ max: 10_000 }), { minLength: 1, maxLength: 12 }),
        (amountMinor, ratios) => {
          fc.pre(ratios.some((ratio) => ratio > 0));
          const original = money(amountMinor, 'USD');
          const parts = allocate(original, ratios);
          expect(parts).toHaveLength(ratios.length);
          expect(parts.reduce((sum, part) => sum + part.amountMinor, 0n)).toBe(amountMinor);
          expect(parts.every((part) => part.currency === 'USD')).toBe(true);
        },
      ),
    );
  });
});

describe('major units', () => {
  it('converts both ways using the currency exponent', () => {
    expect(fromMajorUnits('19.99', 'USD').amountMinor).toBe(1999n);
    expect(fromMajorUnits('1999', 'JPY').amountMinor).toBe(1999n);
    expect(fromMajorUnits('19.99', 'BHD').amountMinor).toBe(19990n);
    expect(toMajorUnits(usd(1999n))).toBe('19.99');
    expect(toMajorUnits(usd(-5n))).toBe('-0.05');
    expect(toMajorUnits(money(1999n, 'JPY'))).toBe('1999');
  });

  it('refuses more decimals than the currency has', () => {
    expect(() => fromMajorUnits('19.999', 'USD')).toThrow(/more decimals than USD allows/);
  });
});

describe('JSON codec', () => {
  it('puts the amount on the wire as a string', () => {
    expect(moneyJson.encode(usd(1999n))).toEqual({ amountMinor: '1999', currency: 'USD' });
    expect(moneyJson.decode({ amountMinor: '1999', currency: 'USD' })).toEqual(usd(1999n));
  });

  it('round-trips exactly past 2^53', () => {
    const big = usd(9007199254740993n);
    expect(moneyJson.decode(JSON.parse(JSON.stringify(moneyJson.encode(big))))).toEqual(big);
  });

  it('round-trips any bigint amount (property)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 30n), max: 10n ** 30n }), (amountMinor) => {
        const value = money(amountMinor, 'USD');
        expect(moneyJson.decode(JSON.parse(JSON.stringify(moneyJson.encode(value))))).toEqual(
          value,
        );
      }),
    );
  });

  it('reports the offending path when the body is wrong', () => {
    try {
      moneyJson.decode({ amountMinor: 19.99, currency: 'USD' });
      expect.unreachable('should have thrown');
    } catch (thrown) {
      const error = thrown as ValidationError;
      expect(error.code).toBe('VALIDATION');
      expect(error.details?.[0]?.path).toEqual(['amountMinor']);
    }
  });
});

describe('schemas', () => {
  it('moneyJsonSchema is the wire shape', () => {
    expect(moneyJsonSchema.parse({ amountMinor: '1999', currency: 'USD' })).toEqual({
      amountMinor: '1999',
      currency: 'USD',
    });
    expect(moneyJsonSchema.safeParse({ amountMinor: '19.99', currency: 'USD' }).success).toBe(
      false,
    );
  });

  it('moneySchema accepts string, bigint and integer number and outputs bigint', () => {
    expect(moneySchema.parse({ amountMinor: '1999', currency: 'USD' }).amountMinor).toBe(1999n);
    expect(moneySchema.parse({ amountMinor: 1999n, currency: 'USD' }).amountMinor).toBe(1999n);
    expect(moneySchema.parse({ amountMinor: 1999, currency: 'USD' }).amountMinor).toBe(1999n);
    expectTypeOf<ReturnType<typeof moneySchema.parse>['amountMinor']>().toEqualTypeOf<bigint>();
    expectTypeOf<ReturnType<typeof moneySchema.parse>>().toEqualTypeOf<Money>();
  });
});
