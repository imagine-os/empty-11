# Spec Corpus Fixtures for Benchmarking

Generated with seeded determinism for validator, pipeline, editor and graph benchmarks.

## Overview

The corpus generator creates synthetic page specs for stress testing and benchmarking:

- **small** (10 pages): Fast iteration and CI validation
- **medium** (60 pages): Full benchmark suite
- **large** (300 pages): Generated on demand in CI; not committed

All specs validate with zero warnings under `--strict` mode.

## Usage

### Generate the corpus

```bash
# Generate small and medium (committed)
pnpm spec fixtures:build small
pnpm spec fixtures:build medium

# Generate large (on-demand, CI only)
pnpm spec fixtures:build large
```

### Validate the corpus

```bash
# Validate medium corpus against the schema
pnpm spec fixtures:validate
```

## Structure

- `packages/spec/fixtures/corpus/{small,medium,large}/` – generated spec files
- `packages/spec/fixtures/corpus/{size}/app.spec.yaml` – app spec listing all pages
- `packages/spec/fixtures/corpus/{size}/manifest.json` – hash manifest and metadata

### Manifest format

```json
{
  "corpusVersion": 1,
  "seed": 42,
  "size": "medium",
  "pageCount": 60,
  "generatedAt": "2026-09-19T...",
  "specs": [
    { "id": "fx-invoice-0000", "hash": "5253f786" },
    // ...
  ]
}
```

## Spec generation details

### Determinism

Same seed produces identical specs byte-for-byte. Regenerating with a new schema version:
1. Changes the specs' structure to match the updated schema
2. Bumps `corpusVersion` in the manifest
3. Is treated as a normal PR (diff review required)

### Distribution

- **Page kinds**: 60% list/detail, 20% forms, 20% dashboards/settings
- **Audiences**: customer.basic, staff.admin, agent.builder (per size)
- **Page entities**: Invoice, Order, User, Product, Report, Document, Setting, Member, Project, Task, Template, Config, Status, Event, Log, Audit
- **Actions**: create, edit, delete, approve, export, refresh, filter, search
- **Naming**: All generated page ids are namespaced `fx-<entity>-<index>` to avoid collisions with real pages

### Access control

Each spec includes:
- `access.view` – surface (customer, staff, agent)
- `access.actions` – per-action audiences and conditions
- Three edge cases (unit, e2e, manual) per spec
- At least one event transition for graph connectivity

## Benchmarks using this corpus

These issues reference and consume the fixture corpus:

- **PAP-115**: Validator benchmarks (300 specs under 2s)
- **PAP-362**: Pipeline benchmarks (60-page stress fixture under 20s)
- **PAP-361**: Graph benchmarks (60 pages × 3 audiences under 5s)
- **PAP-377**: Editor benchmarks (300-component spec)
- **PAP-123**: Graph visualization (300 pages)
- **PAP-743**: PR diff comments (conformance + corpus subsets)
- **PAP-306**: Weekly rehearsal (mixed corpus runs)

## Implementation

Generator: `packages/spec/fixtures/generate.ts`

Uses a seeded linear congruential generator (LCG) for determinism; no external random libraries required. Produces valid YAML specs that pass schema validation with zero warnings.

Tests:
- Determinism (two runs with same seed are byte-identical)
- Validity (all specs validate `--strict`)
- Sample validation (spot-check 10 specs from medium corpus)
- Manifest integrity
- SeededRandom consistency
