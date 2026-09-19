-- Function grants: every app-facing role can call the helpers PAP-32's
-- schema code relies on.
GRANT EXECUTE ON FUNCTION uuid_generate_v7() TO paperos_app, paperos_readonly;
GRANT EXECUTE ON FUNCTION set_updated_at() TO paperos_app;
