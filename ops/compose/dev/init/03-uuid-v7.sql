-- uuid_generate_v7(): time-ordered UUIDs (RFC 9562 UUIDv7), for PAP-32's
-- `id()` column helper and every table's primary key across the platform
-- (org standard: "multiplayer-ready data ... uuidv7 ids"). Postgres 17 has
-- no built-in `uuidv7()` (that lands in Postgres 18) and the
-- `pgvector/pgvector:pg17` image does not bundle a UUIDv7 extension, so this
-- is a plain SQL function: 48-bit big-endian Unix ms timestamp, then random
-- bits from `gen_random_uuid()` (pgcrypto) with the version (0111) and
-- variant (10) bits forced per the spec. This is the widely used public
-- pattern for hand-rolled Postgres UUIDv7 (no novel logic here); PAP-32's
-- migration 0000 is expected to ship the same function (or supersede this one)
-- when the real Drizzle schema-as-code migration lands — see
-- docs/platform/dev-stack.md "Deviations".
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  SELECT encode(
    set_byte(
      set_byte(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6
        ),
        6, ((b'0111' || get_byte(uuid_send(gen_random_uuid()), 6)::bit(4))::bit(8))::int
      ),
      8, ((b'10' || get_byte(uuid_send(gen_random_uuid()), 8)::bit(6))::bit(8))::int
    ),
    'hex'
  )::uuid;
$$;

COMMENT ON FUNCTION uuid_generate_v7() IS
  'Time-ordered UUIDv7 (RFC 9562). See ops/compose/dev/init/03-uuid-v7.sql for provenance.';

-- set_updated_at(): PAP-32's migration-0000 trigger function for the
-- `timestamps()` column helper's `updated_at` column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS
  'BEFORE UPDATE trigger: stamps NEW.updated_at := now(). Attach per table once PAP-32 schemas exist.';
