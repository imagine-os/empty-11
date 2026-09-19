/**
 * `@paperos/core/config` — the typed environment and config layer (PAP-17).
 *
 * See `docs/platform/config.md` for the full picture: which variable goes
 * where, how CI and Coolify supply them, and the extension pattern other
 * modules use to add their own keys.
 */

export {
  MOBILE_SECRET_VALUE_LIMIT_BYTES,
  MobileSecureStore,
} from './adapters/mobile-secure-storage.js';
export { EnvSecretStore, maskSecret } from './adapters/node.js';
export { TauriKeychainStore } from './adapters/tauri-keychain.js';
export { WebSecretStore } from './adapters/web.js';
export type { EnvCheckResult, MissingEnvKey } from './env-check.js';
export { checkEnvExample, formatEnvCheckTable } from './env-check.js';
export type { LoadedConfig } from './load.js';
export {
  ConfigError,
  getPublicEnv,
  getServerEnv,
  loadConfig,
  publicEnv,
  serverEnv,
} from './load.js';
export {
  extendedPublicEnvSchema,
  extendedServerEnvSchema,
  extensionOwners,
  registerPublicEnvExtension,
  registerServerEnvExtension,
} from './registry.js';
export type { PublicEnv, ServerEnv } from './schema.js';
export { knownEnvKeys, publicEnvSchema, serverEnvSchema } from './schema.js';
export type { SecretStore } from './secret-store.js';
export { namespacedKey, namespacePrefix, stripNamespace } from './secret-store.js';
export type { SecretStoreOptions } from './secrets.js';
export { getSecretStore } from './secrets.js';
export type { Target, TargetScope } from './target.js';
export { getTarget } from './target.js';
export type { EnvGuardOptions } from './vite-plugin.js';
export { findEnvLeaks, isExemptModule, paperosEnvGuard } from './vite-plugin.js';
