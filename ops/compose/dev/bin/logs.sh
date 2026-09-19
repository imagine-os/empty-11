#!/usr/bin/env bash
# Tail logs for the PAP-42 local dev stack. Pass a service name to scope it,
# e.g. `logs.sh postgres`.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
docker compose -f "$DIR/compose.yaml" logs -f --tail=200 "$@"
