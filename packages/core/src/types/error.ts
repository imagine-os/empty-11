/**
 * The error body every PaperOS surface returns and the error class every
 * package throws.
 *
 * Interface & Data Contracts section 4: the code is a closed union, the body is
 * the same shape over oRPC, REST and the SDK, and the HTTP status is derived
 * from the code, never chosen per route.
 */

import { z } from 'zod';

/** The closed set of error codes. Adding one is a contract change (ADR, PAP-130). */
export const API_ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** HTTP status for each code. The transport reads this; routes never pick a status. */
export const HTTP_STATUS_BY_API_ERROR_CODE: Readonly<Record<ApiErrorCode, number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL: 500,
};

/** One field-level problem. `path` is the JSON path into the request body. */
export interface ApiErrorDetail {
  path: (string | number)[];
  issue: string;
}

/** The JSON body of every non-2xx response. */
export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  details?: ApiErrorDetail[] | undefined;
  /** Seconds the caller should wait before retrying. Set on `RATE_LIMITED`. */
  retryAfter?: number | undefined;
}

export interface ApiErrorOptions {
  details?: ApiErrorDetail[] | undefined;
  retryAfter?: number | undefined;
  cause?: unknown;
}

/**
 * The error every package in the workspace throws. The API middleware catches
 * it and renders `toBody(requestId)`; anything else becomes `INTERNAL`.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details: ApiErrorDetail[] | undefined;
  readonly retryAfter: number | undefined;

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
  }

  /** HTTP status for this error's code. */
  get status(): number {
    return HTTP_STATUS_BY_API_ERROR_CODE[this.code];
  }

  /** Render the wire body. `requestId` comes from the request context. */
  toBody(requestId: string): ApiErrorBody {
    const body: ApiErrorBody = { code: this.code, message: this.message, requestId };
    if (this.details !== undefined) body.details = this.details;
    if (this.retryAfter !== undefined) body.retryAfter = this.retryAfter;
    return body;
  }

  static is(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}

/** Thrown by every value-type parser in this folder. Code `VALIDATION`. */
export class ValidationError extends ApiError {
  constructor(message: string, options: Omit<ApiErrorOptions, 'retryAfter'> = {}) {
    super('VALIDATION', message, options);
  }
}

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const apiErrorDetailSchema = z.object({
  path: z.array(z.union([z.string(), z.number().int()])),
  issue: z.string().min(1),
});

/** Wire schema for {@link ApiErrorBody}. Converts to JSON Schema unchanged. */
export const apiErrorBodySchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  requestId: z.string().min(1),
  details: z.array(apiErrorDetailSchema).optional(),
  retryAfter: z.number().int().nonnegative().optional(),
});
