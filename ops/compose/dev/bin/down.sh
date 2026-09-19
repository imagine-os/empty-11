#!/usr/bin/env bash
# Stop the PAP-42 local dev stack. Data is kept (named volumes); use reset.sh
# to drop it.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
docker compose -f "$DIR/compose.yaml" down
echo "[stack] down (data kept in volumes; run reset.sh to drop it)"
