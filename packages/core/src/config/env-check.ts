import { parseDotEnv } from './env-source.js';
import { extendedPublicEnvSchema, extendedServerEnvSchema } from './registry.js';

export interface MissingEnvKey {
  readonly key: string;
  readonly source: 'public' | 'server';
}

export interface EnvCheckResult {
  readonly ok: boolean;
  /** Schema keys with no line at all in the checked file. */
  readonly missing: readonly MissingEnvKey[];
  /** Lines in the checked file that name no schema key — informational, never fails the check. */
  readonly extra: readonly string[];
}

/**
 * `pnpm env:check`'s logic: does `.env.example` (or whatever dotenv-shaped
 * text is passed in) still declare every key `publicEnvSchema` /
 * `serverEnvSchema` — plus every registered extension — requires?
 *
 * This checks *names*, not values: `.env.example` holds placeholders, not
 * real URLs or secrets, so it is never run through the Zod schemas
 * themselves (that would fail on the placeholders every time).
 */
export function checkEnvExample(exampleContents: string): EnvCheckResult {
  const declared = new Set(Object.keys(parseDotEnv(exampleContents)));

  const publicKeys = Object.keys(extendedPublicEnvSchema().shape);
  const serverKeys = Object.keys(extendedServerEnvSchema().shape);

  const missing: MissingEnvKey[] = [
    ...publicKeys
      .filter((key) => !declared.has(key))
      .map((key) => ({ key, source: 'public' as const })),
    ...serverKeys
      .filter((key) => !declared.has(key))
      .map((key) => ({ key, source: 'server' as const })),
  ];

  const known = new Set([...publicKeys, ...serverKeys]);
  const extra = [...declared].filter((key) => !known.has(key));

  return { ok: missing.length === 0, missing, extra };
}

/** Renders the failure table the DoD asks for: one row per missing key, never a value. */
export function formatEnvCheckTable(result: EnvCheckResult): string {
  if (result.ok) return 'env:check ok — every known key is declared in .env.example';
  const rows = result.missing
    .map((row) => `  ${row.key.padEnd(32)} missing (${row.source} schema)`)
    .join('\n');
  return `env:check failed — .env.example is missing:\n${rows}`;
}
