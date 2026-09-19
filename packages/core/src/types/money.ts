/**
 * Money.
 *
 * One representation, everywhere: an **exact integer count of minor units** and
 * an ISO 4217 code. `19.99 USD` is `{ amountMinor: 1999n, currency: 'USD' }`;
 * `1999 JPY` is `{ amountMinor: 1999n, currency: 'JPY' }` because the yen has no
 * minor unit; `19.990 BHD` is `{ amountMinor: 19990n, currency: 'BHD' }` because
 * the dinar has three.
 *
 * Why `bigint` and not `number`: a ledger can exceed 2^53 minor units (that is
 * only about 90 billion dollars, and cent-level journals in IDR or VND get
 * there sooner), and float arithmetic cannot represent `0.1 + 0.2`. Why a
 * string on the wire: JSON has no bigint, and `JSON.parse` silently rounds a
 * large number literal. So the JSON form of the amount is always a decimal
 * **string** of minor units: `{ "amountMinor": "1999", "currency": "USD" }`.
 *
 * Display formatting is not here — it is locale work and belongs to
 * `formatMoney` (PAP-27). Currency conversion is not here either (PAP-175).
 * This module is exact arithmetic and nothing else.
 */

import { z } from 'zod';
import type { Brand } from './brand.js';
import { ValidationError } from './error.js';

/** An ISO 4217 alpha-3 code, upper case. */
export type Iso4217 = Brand<string, 'Iso4217'>;

/**
 * An exact decimal written as a string: `'0.075'`, `'-1.5'`, `'3'`. Used for
 * ratios and for major-unit amounts. Never a float.
 */
export type Decimal = Brand<string, 'Decimal'>;

/** Anything this module will read an exact decimal out of. */
export type DecimalLike = Decimal | string | number | bigint;

export interface Money {
  /** Exact count of the currency's minor units. Negative means a credit. */
  amountMinor: bigint;
  currency: Iso4217;
}

/** The JSON form of {@link Money}. The amount is a decimal string of minor units. */
export interface MoneyJson {
  amountMinor: string;
  currency: string;
}

/** Thrown when two amounts in different currencies meet. */
export class CurrencyMismatch extends ValidationError {
  readonly left: Iso4217;
  readonly right: Iso4217;

  constructor(left: Iso4217, right: Iso4217) {
    super(`cannot combine ${left} and ${right}: convert first (PAP-175)`);
    this.left = left;
    this.right = right;
  }
}

const ISO_4217_RE = /^[A-Z]{3}$/;
const INTEGER_RE = /^[+-]?\d+$/;
const DECIMAL_RE = /^[+-]?\d+(?:\.\d+)?$/;

/**
 * Digits after the decimal point for each currency that is not the default 2
 * (ISO 4217 table A.1). `minorUnits('USD')` is 2, `minorUnits('JPY')` is 0,
 * `minorUnits('KWD')` is 3.
 */
const MINOR_UNITS: Readonly<Record<string, number>> = {
  BHD: 3,
  BIF: 0,
  CLF: 4,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  IQD: 3,
  ISK: 0,
  JOD: 3,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  PYG: 0,
  RWF: 0,
  TND: 3,
  UGX: 0,
  UYI: 0,
  UYW: 4,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

/** How many minor units make one major unit, as a power of ten. Default 2. */
export function minorUnits(currency: Iso4217 | string): number {
  return MINOR_UNITS[currency] ?? 2;
}

/** Narrow a currency code, or throw `VALIDATION`. */
export function currency(code: string): Iso4217 {
  const upper = code.toUpperCase();
  if (!ISO_4217_RE.test(upper)) {
    throw new ValidationError(`not an ISO 4217 alpha-3 code: ${JSON.stringify(code)}`);
  }
  return upper as Iso4217;
}

/** Build a `Money`. The amount is minor units: `money(1999, 'USD')` is $19.99. */
export function money(amountMinor: bigint | number | string, code: string): Money {
  return { amountMinor: toMinor(amountMinor), currency: currency(code) };
}

function toMinor(amountMinor: bigint | number | string): bigint {
  if (typeof amountMinor === 'bigint') return amountMinor;
  if (typeof amountMinor === 'number') {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new ValidationError(
        `minor units must be a safe integer, got ${amountMinor}; pass a bigint or a string instead`,
      );
    }
    return BigInt(amountMinor);
  }
  if (!INTEGER_RE.test(amountMinor)) {
    throw new ValidationError(
      `minor units must be an integer string, got ${JSON.stringify(amountMinor)}`,
    );
  }
  return BigInt(amountMinor);
}

export function zeroMoney(code: string): Money {
  return { amountMinor: 0n, currency: currency(code) };
}

export function isMoney(value: unknown): value is Money {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { amountMinor?: unknown; currency?: unknown };
  return (
    typeof candidate.amountMinor === 'bigint' &&
    typeof candidate.currency === 'string' &&
    ISO_4217_RE.test(candidate.currency)
  );
}

/** Throw {@link CurrencyMismatch} unless both amounts are in the same currency. */
export function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) throw new CurrencyMismatch(left.currency, right.currency);
}

export function add(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amountMinor: left.amountMinor + right.amountMinor, currency: left.currency };
}

export function subtract(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return { amountMinor: left.amountMinor - right.amountMinor, currency: left.currency };
}

export function negate(value: Money): Money {
  return { amountMinor: -value.amountMinor, currency: value.currency };
}

export function abs(value: Money): Money {
  return value.amountMinor < 0n ? negate(value) : value;
}

/** `-1`, `0` or `1`. Throws {@link CurrencyMismatch} across currencies. */
export function compare(left: Money, right: Money): -1 | 0 | 1 {
  assertSameCurrency(left, right);
  if (left.amountMinor < right.amountMinor) return -1;
  if (left.amountMinor > right.amountMinor) return 1;
  return 0;
}

export function equals(left: Money, right: Money): boolean {
  return left.currency === right.currency && left.amountMinor === right.amountMinor;
}

export const isZero = (value: Money): boolean => value.amountMinor === 0n;
export const isNegative = (value: Money): boolean => value.amountMinor < 0n;
export const isPositive = (value: Money): boolean => value.amountMinor > 0n;

/**
 * Rounding modes. `halfEven` (banker's rounding) is the default because it does
 * not bias a long run of roundings upwards, which is what a ledger cares about.
 */
export type Rounding = 'halfEven' | 'halfUp' | 'down' | 'up' | 'floor' | 'ceil';

/** An exact decimal as `numerator / 10 ** scale`. */
interface Rational {
  numerator: bigint;
  scale: number;
}

function parseDecimal(value: DecimalLike): Rational {
  if (typeof value === 'bigint') return { numerator: value, scale: 0 };
  const text = typeof value === 'number' ? numberToDecimalText(value) : value;
  if (!DECIMAL_RE.test(text))
    throw new ValidationError(`not an exact decimal: ${JSON.stringify(text)}`);
  const negative = text.startsWith('-');
  const unsigned = negative || text.startsWith('+') ? text.slice(1) : text;
  const point = unsigned.indexOf('.');
  const digits = point === -1 ? unsigned : unsigned.slice(0, point) + unsigned.slice(point + 1);
  const scale = point === -1 ? 0 : unsigned.length - point - 1;
  const magnitude = BigInt(digits);
  return { numerator: negative ? -magnitude : magnitude, scale };
}

function numberToDecimalText(value: number): string {
  if (!Number.isFinite(value)) throw new ValidationError(`not an exact decimal: ${value}`);
  const text = String(value);
  if (text.includes('e') || text.includes('E')) {
    throw new ValidationError(
      `${text} needs exponent notation and cannot be read exactly; pass a decimal string`,
    );
  }
  return text;
}

/** Narrow a decimal string, or throw `VALIDATION`. */
export function decimal(value: DecimalLike): Decimal {
  const { numerator, scale } = parseDecimal(value);
  if (scale === 0) return String(numerator) as Decimal;
  const negative = numerator < 0n;
  const digits = (negative ? -numerator : numerator).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${whole}.${fraction}` as Decimal;
}

/** `numerator / denominator` with `denominator > 0`, rounded as asked. */
function divideRounded(numerator: bigint, denominator: bigint, mode: Rounding): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;
  const negative = numerator < 0n;
  const away = negative ? quotient - 1n : quotient + 1n;
  const twiceRemainder = (negative ? -remainder : remainder) * 2n;
  switch (mode) {
    case 'down':
      return quotient;
    case 'up':
      return away;
    case 'floor':
      return negative ? away : quotient;
    case 'ceil':
      return negative ? quotient : away;
    case 'halfUp':
      return twiceRemainder >= denominator ? away : quotient;
    default: {
      if (twiceRemainder > denominator) return away;
      if (twiceRemainder < denominator) return quotient;
      return quotient % 2n === 0n ? quotient : away;
    }
  }
}

/**
 * Multiply by an exact ratio. `multiply(money(1999, 'USD'), '0.0825')` is the
 * 8.25 % tax on $19.99, rounded half-even to 165 minor units.
 */
export function multiply(value: Money, ratio: DecimalLike, mode: Rounding = 'halfEven'): Money {
  const { numerator, scale } = parseDecimal(ratio);
  const amountMinor = divideRounded(value.amountMinor * numerator, 10n ** BigInt(scale), mode);
  return { amountMinor, currency: value.currency };
}

function floorDivide(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return numerator % denominator < 0n ? quotient - 1n : quotient;
}

/**
 * Split an amount across ratios with the **largest remainder** method: every
 * share is a whole minor unit, the shares sum back to the original amount
 * exactly, and the leftover units go to the largest fractional remainders,
 * ties broken by position. `allocate(money(1999, 'USD'), [1, 1, 1])` is
 * `[667, 666, 666]` — no cent is lost and none is invented.
 *
 * The unit of allocation is the currency's minor unit ({@link minorUnits}), so
 * JPY splits into whole yen and BHD into thousandths of a dinar.
 */
export function allocate(value: Money, ratios: readonly DecimalLike[]): Money[] {
  if (ratios.length === 0) throw new ValidationError('allocate() needs at least one ratio');
  const parsed = ratios.map(parseDecimal);
  const maxScale = parsed.reduce((widest, one) => Math.max(widest, one.scale), 0);
  const weights = parsed.map((one) => one.numerator * 10n ** BigInt(maxScale - one.scale));
  if (weights.some((weight) => weight < 0n))
    throw new ValidationError('allocate() ratios cannot be negative');
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  if (total === 0n) throw new ValidationError('allocate() ratios must sum to more than zero');

  const shares = weights.map((weight, index) => {
    const exact = value.amountMinor * weight;
    const base = floorDivide(exact, total);
    return { index, base, remainder: exact - base * total };
  });

  let leftover = value.amountMinor - shares.reduce((sum, share) => sum + share.base, 0n);
  const byRemainder = [...shares].sort((left, right) =>
    left.remainder === right.remainder
      ? left.index - right.index
      : right.remainder > left.remainder
        ? 1
        : -1,
  );
  for (const share of byRemainder) {
    if (leftover <= 0n) break;
    share.base += 1n;
    leftover -= 1n;
  }

  return shares.map((share) => ({ amountMinor: share.base, currency: value.currency }));
}

/** Read a major-unit amount: `fromMajorUnits('19.99', 'USD')` is 1999 minor units. */
export function fromMajorUnits(major: DecimalLike, code: string): Money {
  const iso = currency(code);
  const { numerator, scale } = parseDecimal(major);
  const exponent = minorUnits(iso);
  if (scale > exponent) {
    throw new ValidationError(
      `${decimal(major)} has more decimals than ${iso} allows (${exponent})`,
    );
  }
  return { amountMinor: numerator * 10n ** BigInt(exponent - scale), currency: iso };
}

/** The major-unit decimal for an amount. `toMajorUnits(money(1999, 'USD'))` is `'19.99'`. */
export function toMajorUnits(value: Money): Decimal {
  const exponent = minorUnits(value.currency);
  if (exponent === 0) return String(value.amountMinor) as Decimal;
  const negative = value.amountMinor < 0n;
  const digits = (negative ? -value.amountMinor : value.amountMinor)
    .toString()
    .padStart(exponent + 1, '0');
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = digits.slice(digits.length - exponent);
  return `${negative ? '-' : ''}${whole}.${fraction}` as Decimal;
}

/**
 * **The wire schema.** `{ amountMinor: string, currency: string }` and nothing
 * else: it holds no `z.bigint()`, so `z.toJSONSchema()` renders it and the
 * OpenAPI document and the SDK stay honest.
 */
export const moneyJsonSchema = z.object({
  amountMinor: z.string().regex(INTEGER_RE, 'minor units must be an integer string'),
  currency: z.string().regex(ISO_4217_RE, 'must be an ISO 4217 alpha-3 code'),
});

/**
 * The domain parser: it accepts the wire form **or** an in-memory `bigint` and
 * always produces a `Money` with a `bigint` amount. It contains a `z.bigint()`
 * and therefore must never be used to generate JSON Schema — use
 * {@link moneyJsonSchema} for that.
 */
export const moneySchema = z
  .object({
    amountMinor: z.union([
      z.string().regex(INTEGER_RE, 'minor units must be an integer string'),
      z.bigint(),
      z.number().int(),
    ]),
    currency: z.string().regex(ISO_4217_RE, 'must be an ISO 4217 alpha-3 code'),
  })
  .transform((value): Money => money(value.amountMinor, value.currency));

/** JSON codec. `encode` is total; `decode` throws `VALIDATION` on a bad body. */
export const moneyJson = {
  encode(value: Money): MoneyJson {
    return { amountMinor: value.amountMinor.toString(), currency: value.currency };
  },
  decode(value: unknown): Money {
    const parsed = moneyJsonSchema.safeParse(value);
    if (!parsed.success) {
      throw new ValidationError('not a Money JSON body', {
        details: parsed.error.issues.map((issue) => ({
          path: [...issue.path] as (string | number)[],
          issue: issue.message,
        })),
      });
    }
    return money(parsed.data.amountMinor, parsed.data.currency);
  },
} as const;
