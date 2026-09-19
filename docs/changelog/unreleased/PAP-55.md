### Added — PAP-55: audience model (`@paperos/core/audience`)

- `Principal` (`human|agent|service|anonymous`), five base roles, `resource:action` permission
  grammar, the segment expression language, fifteen built-in audiences with example principals,
  the surface → audience map, `matches` / `describe` / `validateAudiences` / `createAudienceRegistry`,
  and the generated JSON Schema for the `audiences:` section of `app.spec.yaml`.
- Demo CLI: `pnpm --filter @paperos/core audience explain|validate`; goldens under `fixtures/golden/`.
- Paths: `packages/core/src/audience/`, `packages/core/scripts/`, `docs/platform/audiences.md`,
  `docs/evidence/PAP-55/`.
- ADR: [0017-audience-model](../../adr/0017-audience-model.md)
