### Added — PAP-17: typed environment and config layer with per-target secret storage

- Zod 4 `publicEnvSchema` (`VITE_*`) / `serverEnvSchema`, extension registry, fail-fast
  `loadConfig(target)` / `getPublicEnv()` / `getServerEnv()` with redacted diagnostics, and a
  client-side `SecretStore` port with `WebSecretStore` (live), `TauriKeychainStore` /
  `MobileSecureStore` (not wired yet — apps/desktop and apps/mobile are still stubs) and
  `EnvSecretStore` (the Node/server building block).
- A Vite leak-guard plugin (`paperosEnvGuard`) and a regression test that builds a real client
  bundle and asserts no `serverEnvSchema` key name survives minification.
- Paths: `packages/core/src/config/**` (subpath export `@paperos/core/config`),
  `apps/web/src/config.ts`, `apps/desktop/README.md`, `.env.example`, `.env.test`,
  `docs/platform/config.md`.
