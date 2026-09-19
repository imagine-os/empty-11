import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'views',
    environment: 'node',
    passWithNoTests: true,
    // json-schema.test.ts compiles several Zod schemas to JSON Schema and validates golden
    // fixtures with ajv; on a loaded box (many turbo tasks in parallel) that exceeds vitest's
    // 5 s default (9.2 s observed under load). Raised for the whole package rather than one
    // file/test so any future schema-generation test here inherits the same headroom.
    testTimeout: 60_000,
  },
});
