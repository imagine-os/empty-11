import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  ApiError,
  type ApiErrorBody,
  apiErrorBodySchema,
  HTTP_STATUS_BY_API_ERROR_CODE,
  ValidationError,
} from './error.js';

describe('ApiError', () => {
  it('carries the code, the status and the optional parts', () => {
    const error = new ApiError('RATE_LIMITED', 'slow down', { retryAfter: 30 });
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(429);
    expect(error.toBody('req_1')).toEqual({
      code: 'RATE_LIMITED',
      message: 'slow down',
      requestId: 'req_1',
      retryAfter: 30,
    });
  });

  it('omits what was not set and keeps the cause', () => {
    const cause = new Error('underlying');
    const error = new ApiError('INTERNAL', 'boom', { cause });
    expect(error.cause).toBe(cause);
    expect(error.toBody('req_2')).toEqual({
      code: 'INTERNAL',
      message: 'boom',
      requestId: 'req_2',
    });
    expect(new ApiError('NOT_FOUND', 'gone').cause).toBeUndefined();
  });

  it('renders details', () => {
    const error = new ValidationError('bad body', {
      details: [{ path: ['amountMinor'], issue: 'expected string' }],
    });
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION');
    expect(error.status).toBe(400);
    expect(error.toBody('req_3').details).toEqual([
      { path: ['amountMinor'], issue: 'expected string' },
    ]);
  });

  it('is recognisable across the workspace', () => {
    expect(ApiError.is(new ValidationError('x'))).toBe(true);
    expect(ApiError.is(new Error('x'))).toBe(false);
  });

  it('maps every code to a status and parses every body', () => {
    for (const code of API_ERROR_CODES) {
      const body: ApiErrorBody = { code, message: 'm', requestId: 'req' };
      expect(apiErrorBodySchema.parse(body)).toEqual(body);
      expect(HTTP_STATUS_BY_API_ERROR_CODE[code]).toBeGreaterThanOrEqual(400);
    }
    expect(
      apiErrorBodySchema.safeParse({ code: 'TEAPOT', message: 'm', requestId: 'r' }).success,
    ).toBe(false);
  });
});
