### Added — PAP-44: version control and forge ADR

- ADR 0002 records the decision: Git stays the storage and wire format, a self-hosted Forgejo
  (pinned to the 15.x LTS line) is the primary forge, the GitHub org `imagine-os` is a mirror and
  public front door, Forgejo Actions is the CI fallback, and a custom VCS is deferred indefinitely
  (Jujutsu allowed as a personal client only). Seven sourced alternatives, eight consequences,
  eight numeric reopen criteria.
- Forge topology reference: mirroring direction, failover and failback order, loop-safety
  invariants and a ten-row failure-mode table — the document PAP-47 implements against.
- Paths: `docs/adr/0002-git-forgejo-mirror.md`, `docs/platform/forge-topology.md`,
  `docs/adr/README.md` (register row).
- ADR: [0002-git-forgejo-mirror](../../adr/0002-git-forgejo-mirror.md)
