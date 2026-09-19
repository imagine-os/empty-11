# apps/desktop (stub)

Tauri 2 desktop shell. Owner: app-shell (PAP-19). Empty until that issue lands; the folder exists
so the workspace glob, CI and the docs map already know about it.

## Secrets contract this app must mount (PAP-17)

`packages/core/src/config/adapters/tauri-keychain.ts` (`TauriKeychainStore`) already implements
the client-side `SecretStore` port against four Tauri commands. It throws a clear "not wired yet"
error today because nothing below exists yet. When PAP-19 scaffolds `src-tauri/`, it adds:

* `src-tauri/src/commands/secrets.rs` with four `#[tauri::command]` functions:
  * `secret_get(key: String) -> Result<Option<String>, String>`
  * `secret_set(key: String, value: String) -> Result<(), String>`
  * `secret_delete(key: String) -> Result<(), String>`
  * `secret_list() -> Result<Vec<String>, String>`, scoped server-side to this app's
    `paperos.<app>.` namespace prefix so one app can never enumerate another's keys.
* Backed by the [`keyring`](https://crates.io/crates/keyring) crate: macOS Keychain, Windows
  Credential Manager, Linux `secret-service` (falling back to an encrypted file when no
  `secret-service` is running — headless CI, some window managers — with a loud, visible warning
  the first time it falls back; never a silent downgrade).
* Registered only for the **main window**'s capability set (`src-tauri/capabilities/main.json`),
  not exposed to any other window or webview, so a compromised secondary window can't reach it.
* `key` arriving at every command is already the namespaced `paperos.<app>.<name>` string —
  `TauriKeychainStore` does that namespacing on the TypeScript side before calling `invoke()`.

Round-trip test (DoD): `cargo test` for `secrets.rs` against the `keyring` crate's mock backend,
plus a real round-trip recorded on Linux (`secret-service`) and macOS (Keychain) — skipped, and
noted as skipped, on a machine with neither.

## Config the desktop process itself needs

Same `serverEnvSchema` as any other Node/Tauri-Rust process — nothing desktop-specific. The
Tauri **webview** (the React shell running inside it) uses only `publicEnvSchema` (`VITE_*`),
exactly like `apps/web`; `getTarget()` (`@paperos/core/config`) returns `'desktop'` there once
`window.__TAURI_INTERNALS__` exists, which is how the config layer picks
`TauriKeychainStore` over `WebSecretStore` automatically.
