/**
 * `@paperos/core/types` — the value types every package passes across a
 * boundary, and the one encoding each of them has in TypeScript, in Postgres
 * and in JSON.
 *
 * Owner: data-layer (PAP-302). Decision: ADR 0011. Reference table:
 * `docs/platform/types.md`. Column helpers for the Postgres side live in
 * `@paperos/db` (`src/schema/_shared.ts`) so that this folder stays free of
 * Drizzle, React, the database and the network.
 */

export {
  type ActorRef,
  ANONYMOUS_ACTOR,
  actorRefSchema,
  isAnonymous,
  isPrincipalType,
  PRINCIPAL_TYPES,
  type PrincipalLike,
  type PrincipalType,
  principalTypeSchema,
  toActorRef,
} from './actor.js';
export type { Brand, Unbrand } from './brand.js';
export {
  CURSOR_SECRET_ENV,
  CURSOR_SECRET_PREVIOUS_ENV,
  CURSOR_SIGNATURE_BYTES,
  type CursorPayload,
  type CursorSecrets,
  type CursorValue,
  cursorPayloadSchema,
  readCursorSecretsFromEnv,
  signCursor,
  verifyCursor,
} from './cursor.js';
export {
  assertEntityType,
  type EntityKey,
  type EntityRef,
  type EntityTypeValidator,
  entityKeySchema,
  entityRef,
  entityRefSchema,
  entityTypeSchema,
  formatEntityKey,
  isEntityKey,
  parseEntityKey,
  setEntityTypeValidator,
} from './entity.js';
export {
  API_ERROR_CODES,
  ApiError,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiErrorDetail,
  type ApiErrorOptions,
  apiErrorBodySchema,
  apiErrorCodeSchema,
  apiErrorDetailSchema,
  HTTP_STATUS_BY_API_ERROR_CODE,
  ValidationError,
} from './error.js';
export {
  isUuid,
  isUuidV7,
  NIL_UUID,
  toUuid,
  type Uuid,
  uuidSchema,
  uuidv7,
  uuidv7Timestamp,
} from './ids.js';
export {
  abs,
  add,
  allocate,
  assertSameCurrency,
  CurrencyMismatch,
  compare,
  currency,
  type Decimal,
  type DecimalLike,
  decimal,
  equals,
  fromMajorUnits,
  type Iso4217,
  isMoney,
  isNegative,
  isPositive,
  isZero,
  type Money,
  type MoneyJson,
  minorUnits,
  money,
  moneyJson,
  moneyJsonSchema,
  moneySchema,
  multiply,
  negate,
  type Rounding,
  subtract,
  toMajorUnits,
  zeroMoney,
} from './money.js';
export {
  addDuration,
  type Duration,
  days,
  durationSchema,
  hours,
  type IsoDate,
  type IsoDateTime,
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
