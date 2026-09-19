import { z } from 'zod';

/**
 * Treat `""` as absent everywhere in this file. A shell variable that is set
 * but empty (`VITE_API_URL=` in a `.env`) is a common accident and the spec's
 * edge cases call it out explicitly: "empty string counts as missing."
 */
const requiredString = () => z.string().trim().min(1, 'required, got an empty string');

const requiredUrl = () =>
  z.string().trim().min(1, 'required, got an empty string').url('must be a valid URL');

const optionalString = () =>
  z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined));

const optionalUrl = () =>
  z
    .string()
    .trim()
    .url('must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined));

/**
 * `VITE_*` — the only variables that may reach the browser bundle. Every key
 * here (and only these) is safe to read from `import.meta.env` in
 * `apps/web/**`, `apps/desktop/**` (webview) and `apps/mobile/**` (webview).
 *
 * Other modules add their own `VITE_*` keys with `publicEnvSchema.extend(...)`
 * and register the extension in `config/registry.ts` — see that file.
 */
export const publicEnvSchema = /* @__PURE__ */ z.object({
  /** Base URL of the API the shell talks to. */
  VITE_API_URL: requiredUrl(),
  /** Product name shown in chrome, titles and the message catalog fallback. */
  VITE_APP_NAME: requiredString(),
  /** Commit SHA stamped into the build (`apps/web/vite.config.ts` sets it via `define`). */
  VITE_GIT_SHA: requiredString(),
  /** Electric sync service the client subscribes to. */
  VITE_ELECTRIC_URL: requiredUrl(),
  /** Yjs / Hocuspocus realtime endpoint. */
  VITE_YJS_URL: requiredUrl(),
  /** Sentry DSN; unset disables client error reporting. */
  VITE_SENTRY_DSN: optionalUrl(),
  /**
   * Comma-separated flag names turned on before the runtime flag service
   * (a later app-shell issue) has loaded. Bootstrap only — never the source of
   * truth once that service exists.
   */
  VITE_FLAGS: optionalString(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Server-only variables. Never imported by anything that ships to a browser,
 * desktop or mobile bundle — `packages/core/src/config/vite-plugin.ts` fails a
 * client build that tries.
 *
 * `S3_*` is the concrete family the local dev stack (PAP-42) and Postgres
 * provisioning (PAP-30) already write under "names from PAP-17":
 * `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`.
 *
 * Downstream modules extend this with their own server keys
 * (`DATABASE_URL_ELECTRIC`, `DATABASE_URL_READONLY`, the `OTEL_*` quartet,
 * `SMTP_URL`, service-side `ELECTRIC_URL` / `YJS_URL`, ...) with
 * `serverEnvSchema.extend(...)` registered in `config/registry.ts`, not by
 * editing this file — see the extension table in `docs/platform/config.md`.
 *
 * `/* @__PURE__ *\/` immediately before `z.object(...)` matters, not just
 * style: without it, a bundler cannot prove this top-level initializer has no
 * side effects and keeps it — and its literal key strings, `DATABASE_URL`
 * included — in *any* bundle that reaches this file at all, which is exactly
 * the leak this layer exists to prevent (see the same note on `publicEnv` /
 * `serverEnv` in `load.ts`).
 */
export const serverEnvSchema = /* @__PURE__ */ z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),

  /** App role connection, routed through PgBouncer in every environment but local dev. */
  DATABASE_URL: requiredString(),
  /** Owner-role connection used only to run migrations. */
  DATABASE_URL_MIGRATOR: requiredString(),

  S3_ENDPOINT: requiredUrl(),
  S3_ACCESS_KEY: requiredString(),
  S3_SECRET_KEY: requiredString(),
  S3_BUCKET: requiredString(),

  BETTER_AUTH_SECRET: requiredString(),
  BETTER_AUTH_URL: requiredUrl(),

  /** Present once billing (business-core) is enabled; absent otherwise. */
  STRIPE_SECRET_KEY: optionalString(),
  /** OpenTelemetry OTLP collector endpoint; unset disables tracing export. */
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl(),
  /**
   * Consumed by the field-encryption issue (data-layer), not by this layer.
   * Declared here only so it is validated and never logged.
   */
  APP_ENCRYPTION_KEY: optionalString(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Every key name this layer knows about, public first — a function, not a
 * top-level constant, on purpose: an eagerly-computed `const` here would
 * touch `serverEnvSchema` unconditionally at module load, which stops a
 * bundler from ever dropping `serverEnvSchema`'s definition (and its literal
 * key strings, `DATABASE_URL` and friends) from a build that only wants
 * `publicEnvSchema` — exactly the leak `docs/platform/config.md`'s bundle
 * guard exists to catch. Called only by diagnostics and docs generation,
 * never at import time.
 */
export function knownEnvKeys(): readonly string[] {
  return [...Object.keys(publicEnvSchema.shape), ...Object.keys(serverEnvSchema.shape)];
}
