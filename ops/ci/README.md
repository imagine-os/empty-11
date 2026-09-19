# ops/ci (stub)

Scripts and composite actions the CI workflows call, so `.github/workflows/*.yml` stays thin.
Gate 1 (`ci / check`) is defined in `.github/workflows/ci.yml`; PAP-78 extends it with the
quality gates and publishes gate artefacts.
