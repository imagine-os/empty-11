### Added — PAP-14: device matrix research and machine-readable spec

- Decided and documented the seven-breakpoint / six-device-class matrix (phone, tablet, laptop,
  desktop, TV/kiosk, foldable) the rest of the plan builds against: `xs 360`, `sm 390`, `md 768`,
  `lg 1280`, `xl 1920`, `2xl 2560`, `3xl 3840`, confirmed with 2026 market data.
- Paths: `packages/core/src/devices/matrix.ts` (+ `matrix.test.ts`), `scripts/gen-breakpoints.ts`,
  `ops/ci/breakpoints.json` (generated), `scripts/matrix-shots.spec.ts`, `docs/research/device-matrix.md`.
- ADR: [0022-device-matrix](../../adr/0022-device-matrix.md)
