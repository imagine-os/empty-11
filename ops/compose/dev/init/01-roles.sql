-- PAP-42 local dev stack: roles matching PAP-30/PAP-42's Interface Contract
-- ("Roles paperos_owner, paperos_app, paperos_readonly, electric identical to
-- PAP-30 so PAP-34 tests run locally"). `paperos_owner` already exists — it
-- is created by the postgres image's own bootstrap from POSTGRES_USER above
-- and owns `paperos_dev` — so this file only adds the other three.
--
-- Naming note: the PAP-42 build-loop brief that scoped this issue's paths
-- names the roles "paperos_app / paperos_admin". The canonical spec (PAP-30's
-- Interface Contract, which PAP-42 must match "identical ... so PAP-34 tests
-- run locally") names them `paperos_app` and `paperos_owner`. This file uses
-- the canonical spec names; `paperos_owner` *is* the "admin"/migrator role.
-- Passwords below are fixed, published, local-only values — never use them
-- outside this compose network.

-- Subject to row-level security (PAP-34); the API and every application
-- query runs as this role.
CREATE ROLE paperos_app LOGIN PASSWORD 'paperos_dev_local' NOBYPASSRLS;
GRANT ALL PRIVILEGES ON DATABASE paperos_dev TO paperos_app;
GRANT ALL ON SCHEMA public TO paperos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO paperos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO paperos_app;

-- Read-only role for reporting / read replicas locally.
CREATE ROLE paperos_readonly LOGIN PASSWORD 'paperos_dev_local' NOBYPASSRLS;
GRANT CONNECT ON DATABASE paperos_dev TO paperos_readonly;
GRANT USAGE ON SCHEMA public TO paperos_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO paperos_readonly;

-- Electric's logical-replication role (ADR 0004: direct connection, not
-- through a pooler, REPLICATION attribute, not superuser). Locally it is
-- also granted `paperos_owner` membership so it can create the publication
-- it manages on startup without full Postgres superuser — creating a
-- publication needs ownership of every table it covers, which membership in
-- the owning role satisfies. Production hardens this per PAP-30/PAP-270.
CREATE ROLE electric LOGIN PASSWORD 'paperos_dev_local' REPLICATION NOBYPASSRLS;
GRANT paperos_owner TO electric;
