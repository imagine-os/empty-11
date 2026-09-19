# spikes/

Throwaway experiments. One folder per spike, named `<PAP-n>-<slug>/`, each with a `README.md`
stating the question, the answer and what was thrown away. Spikes are never imported by
`apps/*` or `packages/*`, are excluded from `pnpm check`, and are deleted once their finding
lands in `docs/research/` or an ADR.
