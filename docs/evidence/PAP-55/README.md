# Evidence: PAP-55 audience model

| File | What it proves |
| -- | -- |
| `coverage.txt` | Vitest v8 coverage of `packages/core/src/audience/`: `matches.ts` 100 % statements / branches / functions / lines; folder 98 %+ branches. |
| `bench.txt` | `matches` at depth 6 with an audience reference: mean 0.0012 ms (1.2 µs), p99 0.0017 ms, against the 50 µs budget. |
| `cli-explain.txt` | The demo: `audience explain` on the two worked examples (customer who is also a partner; agent acting for a staff member) against the fixture `app.spec` audiences. |
| `cli-validate.txt` | `audience validate` accepting the valid fixture and naming the cycle, the shadowed built-in and the unknown reference in the broken one (exit 1). |

Reproduce from `packages/core`: `pnpm test`, `pnpm exec vitest bench --run src/audience`,
`pnpm audience explain --principal src/audience/fixtures/principals/customer-partner.json --audiences src/audience/fixtures/app-spec.audiences.json`,
`pnpm audience validate --audiences src/audience/fixtures/app-spec.audiences.cyclic.json`.
