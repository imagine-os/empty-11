/**
 * Nominal ("branded") types.
 *
 * A branded type is the underlying primitive at runtime and a distinct type at
 * compile time, so a bare `string` can never be passed where a `Uuid` is
 * required. The brand carries no runtime cost and never appears in JSON: on the
 * wire a `Uuid` is a string, an `IsoDate` is a string, an `Iso4217` is a string.
 *
 * Construct branded values through the module that owns them (`toUuid`,
 * `toIsoDate`, `currency`, ...), never with a cast at the call site.
 */

declare const BRAND: unique symbol;

/** `Brand<string, 'Uuid'>` is a `string` that only `Uuid` values inhabit. */
export type Brand<T, B extends string> = T & { readonly [BRAND]: B };

/** Strip a brand back to its underlying primitive. */
export type Unbrand<T> = T extends Brand<infer U, string> ? U : T;
