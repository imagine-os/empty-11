/**
 * Time on the wire.
 *
 * Three shapes, and only three:
 *
 * * `IsoDateTime` — an instant. `timestamptz` in Postgres, `Date` in memory,
 *   ISO-8601 UTC **with milliseconds and a `Z`** in JSON. Never a local offset,
 *   never a Unix number.
 * * `IsoDate` — a calendar day with no instant attached (fiscal periods, due
 *   dates, birthdays). `date` in Postgres, a `YYYY-MM-DD` string everywhere
 *   else. Never a `Date`, which would drag a timezone in and move the day.
 * * `Duration` — a length of time in whole milliseconds. A JSON number.
 */

import { z } from 'zod';
import type { Brand } from './brand.js';
import { ValidationError } from './error.js';

/** ISO-8601 UTC instant with milliseconds, e.g. `2026-09-19T14:03:11.482Z`. */
export type IsoDateTime = Brand<string, 'IsoDateTime'>;
/** Calendar day, `YYYY-MM-DD`. No timezone, no instant. */
export type IsoDate = Brand<string, 'IsoDate'>;
/** A length of time in whole milliseconds. */
export type Duration = Brand<number, 'Duration'>;

const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDateTime(value: unknown): value is IsoDateTime {
  return (
    typeof value === 'string' &&
    ISO_DATE_TIME_RE.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_RE.exec(value);
  if (match === null) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Render an instant. `Date.prototype.toISOString` already emits exactly this shape. */
export function toIsoDateTime(value: Date): IsoDateTime {
  if (Number.isNaN(value.getTime())) throw new ValidationError('cannot format an Invalid Date');
  return value.toISOString() as IsoDateTime;
}

/** Parse an instant, or throw `VALIDATION`. */
export function parseIsoDateTime(value: string): Date {
  if (!isIsoDateTime(value)) {
    throw new ValidationError(
      `not an ISO-8601 UTC instant with milliseconds: ${JSON.stringify(value)}`,
    );
  }
  return new Date(value);
}

/** The current instant. */
export function nowIso(now: Date = new Date()): IsoDateTime {
  return toIsoDateTime(now);
}

/** The UTC calendar day of an instant. */
export function toIsoDate(value: Date): IsoDate {
  if (Number.isNaN(value.getTime())) throw new ValidationError('cannot format an Invalid Date');
  return value.toISOString().slice(0, 10) as IsoDate;
}

/** Narrow a `YYYY-MM-DD` string, or throw `VALIDATION`. Rejects `2026-02-30`. */
export function toIsoDateOrThrow(value: string): IsoDate {
  if (!isIsoDate(value))
    throw new ValidationError(`not a YYYY-MM-DD calendar date: ${JSON.stringify(value)}`);
  return value;
}

/** Midnight UTC on a calendar day, for the one place a day has to become an instant. */
export function isoDateToUtcInstant(value: IsoDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function duration(milliseconds: number): Duration {
  if (!Number.isInteger(milliseconds)) {
    throw new ValidationError(`a Duration is whole milliseconds, got ${milliseconds}`);
  }
  return milliseconds as Duration;
}

export const milliseconds = (count: number): Duration => duration(count);
export const seconds = (count: number): Duration => duration(count * 1_000);
export const minutes = (count: number): Duration => duration(count * 60_000);
export const hours = (count: number): Duration => duration(count * 3_600_000);
export const days = (count: number): Duration => duration(count * 86_400_000);

/** Shift an instant by a duration. */
export function addDuration(instant: IsoDateTime, length: Duration): IsoDateTime {
  return toIsoDateTime(new Date(parseIsoDateTime(instant).getTime() + length));
}

export const isoDateTimeSchema = z
  .string()
  .regex(ISO_DATE_TIME_RE, 'must be an ISO-8601 UTC instant with milliseconds')
  .refine(isIsoDateTime, 'must be a real instant') as unknown as z.ZodType<IsoDateTime, string>;

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_RE, 'must be a YYYY-MM-DD calendar date')
  .refine(isIsoDate, 'must be a real calendar date') as unknown as z.ZodType<IsoDate, string>;

export const durationSchema = z.number().int() as unknown as z.ZodType<Duration, number>;
