#!/usr/bin/env bash
# Stop the PAP-42 local dev stack and delete its data (Postgres + MinIO
# volumes). Use this to get back to a clean, empty stack.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
docker compose -f "$DIR/compose.yaml" down --volumes
echo "[stack] reset: containers and volumes removed. Run up.sh to start fresh."
