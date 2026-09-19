### Added — PAP-42: local dev stack (Postgres, ElectricSQL, MinIO, Mailpit)

- Compose stack with healthchecks and named volumes, role/extension/`uuid_generate_v7()` init SQL,
  and `up|down|reset|logs` shell scripts.
- Paths: `ops/compose/dev/`, `docs/platform/dev-stack.md`.
- Docs: `docs/platform/README.md`, `docs/reference/surfaces.md`.
- Deviations (per-worktree isolation, session-start hook, `ci-services.yml`, Hocuspocus) recorded in
  `docs/platform/dev-stack.md` "Deviations" and filed as follow-ups.
