#!/usr/bin/env bash
# Start the PAP-42 local dev stack and wait for every service to report
# healthy. See ../README.md for ports, roles and env vars.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$DIR/compose.yaml"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Install Docker Desktop (macOS/Windows) or docker-ce (Linux)," >&2
  echo "or set PAPEROS_STACK=remote and point DATABASE_URL etc. at a shared staging" >&2
  echo "database (see ../README.md 'Docker missing')." >&2
  exit 1
fi

echo "[stack] starting: postgres, electric, minio, mailpit ..."
docker compose -f "$COMPOSE_FILE" up -d --wait --wait-timeout 120

# minio-init is a one-shot bucket-creation container; `--wait` above does not
# block on it in every Compose version, so wait for its exit explicitly.
echo "[stack] waiting for the paperos-dev bucket ..."
docker compose -f "$COMPOSE_FILE" wait minio-init >/dev/null 2>&1 || true

cat <<'EOF'

[stack] up. Services:
  postgres  localhost:5432   db=paperos_dev  user=paperos_owner (see README for app/readonly/electric roles)
  electric  localhost:3000   http://localhost:3000/v1/health
  minio     localhost:9000   (S3 API)   console: http://localhost:9001
  mailpit   localhost:8025   (web UI)   smtp: localhost:1025

Env vars for .env.local (see ../README.md "Env vars"):
  DATABASE_URL=postgresql://paperos_app:paperos_dev_local@localhost:5432/paperos_dev
  DATABASE_URL_MIGRATOR=postgresql://paperos_owner:paperos_dev_local@localhost:5432/paperos_dev
  S3_ENDPOINT=http://localhost:9000  S3_ACCESS_KEY=paperos_dev  S3_SECRET_KEY=paperos_dev_local  S3_BUCKET=paperos-dev
  SMTP_URL=smtp://localhost:1025
  ELECTRIC_URL=http://localhost:3000

Next: pnpm db:migrate (once PAP-32 lands) or `docker compose -f ops/compose/dev/compose.yaml logs -f`.
EOF
