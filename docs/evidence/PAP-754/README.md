# PAP-754 evidence

* `timeout-probe.log` — a captured CLI transcript of `probe.mjs` polling a refused port
  (`http://127.0.0.1:1/`) until its own timeout elapses, standing in for a screenshot of the
  workflow's timeout path (the spec's Definition of done: "timeout path proven with a deliberately
  broken compose"). There is no Docker daemon in the build sandbox (see
  `ops/ci/compose-smoke/README.md` "What could not be run"), so this exercises the same
  `waitForHealthy()` logic the `Health probe` workflow step calls, against a connection that never
  answers, rather than an actual broken compose stack.

Still owed once a Docker daemon (or a self-hosted runner) is available: a real
`docker compose up --wait` run against `ops/compose/example-postgres/`, its artefact JSON, and a
run against a compose file with a `--wait-timeout` deliberately set too low, screenshotted from the
Actions UI.
