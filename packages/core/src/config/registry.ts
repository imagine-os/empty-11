import type { z } from 'zod';
import { publicEnvSchema, serverEnvSchema } from './schema.js';

/**
 * How another module adds its own env keys without editing this file.
 *
 * `contract-app-shell`'s config port is the long-term home for per-module
 * settings (PAP-444: `settingsSchema` in the manifest, validated by the
 * kernel). Until that lands, a module that needs a new `VITE_*` or
 * server-only variable calls one of these once, at import time, from its own
 * package:
 *
 * ```ts
 * import { registerServerEnvExtension } from '@paperos/core/config';
 * import { z } from 'zod';
 *
 * registerServerEnvExtension('data-layer', z.object({
 *   DATABASE_URL_ELECTRIC: z.string().min(1),
 * }));
 * ```
 *
 * `loadConfig()` merges every registered extension with `.extend()` before
 * parsing, so a missing extension key fails boot the same way a base key
 * does, named the same way (module + key, never the value).
 */

type AnyObjectSchema = z.ZodObject<z.ZodRawShape>;

interface Extension {
  readonly module: string;
  readonly schema: AnyObjectSchema;
}

const publicExtensions = new Map<string, Extension>();
const serverExtensions = new Map<string, Extension>();

function register(store: Map<string, Extension>, module: string, schema: AnyObjectSchema): void {
  const existing = store.get(module);
  if (existing && existing.schema !== schema) {
    throw new Error(`config registry: module "${module}" already registered a different extension`);
  }
  store.set(module, { module, schema });
}

/** Register additional `VITE_*` keys owned by `module`. Safe to call more than once with the same schema. */
export function registerPublicEnvExtension(module: string, schema: AnyObjectSchema): void {
  register(publicExtensions, module, schema);
}

/** Register additional server-only keys owned by `module`. Safe to call more than once with the same schema. */
export function registerServerEnvExtension(module: string, schema: AnyObjectSchema): void {
  register(serverExtensions, module, schema);
}

/** The public schema plus every registered extension, folded in with `.extend()`. */
export function extendedPublicEnvSchema(): AnyObjectSchema {
  let schema: AnyObjectSchema = publicEnvSchema;
  for (const { schema: extension } of publicExtensions.values()) {
    schema = schema.extend(extension.shape);
  }
  return schema;
}

/** The server schema plus every registered extension, folded in with `.extend()`. */
export function extendedServerEnvSchema(): AnyObjectSchema {
  let schema: AnyObjectSchema = serverEnvSchema;
  for (const { schema: extension } of serverExtensions.values()) {
    schema = schema.extend(extension.shape);
  }
  return schema;
}

/** Which module owns which registered key; used by diagnostics so a failure names an owner. */
export function extensionOwners(): ReadonlyMap<string, readonly string[]> {
  const owners = new Map<string, string[]>();
  for (const [store, kind] of [
    [publicExtensions, 'public'],
    [serverExtensions, 'server'],
  ] as const) {
    for (const { module, schema } of store.values()) {
      owners.set(`${kind}:${module}`, Object.keys(schema.shape));
    }
  }
  return owners;
}

/** Test-only: drop every registered extension so suites do not leak into each other. */
export function resetConfigRegistry(): void {
  publicExtensions.clear();
  serverExtensions.clear();
}
