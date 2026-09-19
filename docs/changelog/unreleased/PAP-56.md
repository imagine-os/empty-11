### Added — PAP-56: authentication library comparison and decision

- Compared Better Auth, Lucia, Clerk and Auth.js against PaperOS's eleven auth requirements
  (self-hosting, organizations/teams onto our own `tenant`/`workspace`, passkeys, magic link, OAuth,
  agent API keys, RLS-friendly session data, Drizzle adapter, licence, maintenance velocity), scored
  on the PAP-209 rubric, every fact sourced and dated 2026-09-19.
- **Decision: Better Auth 1.7.5, self-hosted on Postgres via `@better-auth/drizzle-adapter`.** Lucia
  rejected (deprecated March 2025), Clerk rejected (no self-host path), Auth.js kept as the
  documented fallback (no organizations; passkeys experimental and Prisma-only).
- Downstream consequences: `oidcProvider` was removed in Better Auth 1.7, so PAP-45/PAP-226 use
  `@better-auth/oauth-provider`; Tauri authenticates through a system-browser PKCE flow with an
  OS-keychain bearer token instead of webview WebAuthn (PAP-225); API-key mock sessions stay off
  (PAP-60). Pinned package list for PAP-57 is in the research doc §8.
- Not done here: runnable spikes, Chromium screenshots and `tauri dev` runs on Linux/macOS - listed
  as open risks with owners in the research doc §6.
- Paths: `docs/research/auth-libraries.md`, `docs/adr/0003-auth-library.md`, `docs/adr/README.md`.
- ADR: [0003-auth-library](../../adr/0003-auth-library.md)
