import { describe, expect, it } from 'vitest';
import { ValidationError } from './error.js';
import {
  addDuration,
  days,
  durationSchema,
  hours,
  isIsoDate,
  isIsoDateTime,
  isoDateSchema,
  isoDateTimeSchema,
  isoDateToUtcInstant,
  milliseconds,
  minutes,
  nowIso,
  parseIsoDateTime,
  seconds,
  toIsoDate,
  toIsoDateOrThrow,
  toIsoDateTime,
} from './time.js';

describe('IsoDateTime', () => {
  it('is UTC with milliseconds and nothing else', () => {
    expect(isIsoDateTime('2026-09-19T14:03:11.482Z')).toBe(true);
    expect(isIsoDateTime('2026-09-19T14:03:11Z')).toBe(false);
    expect(isIsoDateTime('2026-09-19T14:03:11.482+02:00')).toBe(false);
    expect(isIsoDateTime('2026-02-30T00:00:00.000Z')).toBe(false);
    expect(isIsoDateTime(1_758_290_591_482)).toBe(false);
  });

  it('formats and parses', () => {
    const instant = new Date('2026-09-19T14:03:11.482Z');
    expect(toIsoDateTime(instant)).toBe('2026-09-19T14:03:11.482Z');
    expect(parseIsoDateTime('2026-09-19T14:03:11.482Z').getTime()).toBe(instant.getTime());
    expect(() => parseIsoDateTime('19/09/2026')).toThrow(ValidationError);
    expect(() => toIsoDateTime(new Date(Number.NaN))).toThrow(ValidationError);
    expect(isIsoDateTime(nowIso())).toBe(true);
  });
});

describe('IsoDate', () => {
  it('is a calendar day, never an instant', () => {
    expect(isIsoDate('2026-09-19')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-9-1')).toBe(false);
    expect(isIsoDate(new Date())).toBe(false);
    expect(toIsoDate(new Date('2026-09-19T23:59:59.999Z'))).toBe('2026-09-19');
    expect(toIsoDateOrThrow('2026-09-19')).toBe('2026-09-19');
    expect(() => toIsoDateOrThrow('2026-02-30')).toThrow(ValidationError);
    expect(() => toIsoDate(new Date(Number.NaN))).toThrow(ValidationError);
    expect(isoDateToUtcInstant(toIsoDateOrThrow('2026-09-19')).toISOString()).toBe(
      '2026-09-19T00:00:00.000Z',
    );
  });
});

describe('Duration', () => {
  it('counts whole milliseconds', () => {
    expect(milliseconds(5)).toBe(5);
    expect(seconds(2)).toBe(2_000);
    expect(minutes(2)).toBe(120_000);
    expect(hours(1)).toBe(3_600_000);
    expect(days(1)).toBe(86_400_000);
    expect(() => milliseconds(1.5)).toThrow(ValidationError);
  });

  it('shifts an instant', () => {
    expect(addDuration(toIsoDateTime(new Date('2026-09-19T00:00:00.000Z')), hours(25))).toBe(
      '2026-09-20T01:00:00.000Z',
    );
  });
});

describe('schemas', () => {
  it('accept the wire forms', () => {
    expect(isoDateTimeSchema.parse('2026-09-19T14:03:11.482Z')).toBe('2026-09-19T14:03:11.482Z');
    expect(isoDateTimeSchema.safeParse('2026-02-30T00:00:00.000Z').success).toBe(false);
    expect(isoDateSchema.parse('2026-09-19')).toBe('2026-09-19');
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(durationSchema.parse(1_000)).toBe(1_000);
    expect(durationSchema.safeParse(1.5).success).toBe(false);
  });
});
