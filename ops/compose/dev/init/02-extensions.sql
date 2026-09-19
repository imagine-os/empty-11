-- Extensions the schema work (PAP-30, PAP-32, PAP-39) needs pre-installed,
-- so the local stack matches the VPS instances PAP-30 provisions. `vector`
-- ships in the `pgvector/pgvector:pg17` image already; the rest are
-- contrib modules bundled with every official Postgres image.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
-- Requires shared_preload_libraries=pg_stat_statements, set on the postgres
-- service's `command:` in ../compose.yaml.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
