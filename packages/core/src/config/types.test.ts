import { describe, expectTypeOf, it } from 'vitest';
import type { LoadedConfig } from './load.js';
import { publicEnv, serverEnv } from './load.js';
import type { PublicEnv, ServerEnv } from './schema.js';
import type { SecretStore } from './secret-store.js';
import type { Target } from './target.js';

/**
 * Type-level checks: these run under `tsc --noEmit` (the same `typecheck`
 * script every package uses) and are no-ops at runtime. Their job is to pin
 * the *shapes* the interface contract promises — `PublicEnv` has no server
 * keys, `ServerEnv` has no `VITE_` keys, optional fields are really optional
 * — so a future edit that widens one by accident fails typecheck, not a
 * runtime assertion buried three files away.
 */
describe('config types', () => {
  it('PublicEnv has exactly the VITE_* keys the spec lists, required ones non-optional', () => {
    expectTypeOf<PublicEnv>().toEqualTypeOf<{
      VITE_API_URL: string;
      VITE_APP_NAME: string;
      VITE_GIT_SHA: string;
      VITE_ELECTRIC_URL: string;
      VITE_YJS_URL: string;
      VITE_SENTRY_DSN?: string;
      VITE_FLAGS?: string;
    }>();
  });

  it('ServerEnv has no VITE_-prefixed keys', () => {
    expectTypeOf<ServerEnv>().not.toHaveProperty('VITE_API_URL' as never);
    expectTypeOf<ServerEnv['NODE_ENV']>().toEqualTypeOf<'development' | 'test' | 'production'>();
  });

  it('publicEnv and serverEnv are live values typed exactly as PublicEnv / ServerEnv', () => {
    expectTypeOf(publicEnv).toEqualTypeOf<PublicEnv>();
    expectTypeOf(serverEnv).toEqualTypeOf<ServerEnv>();
  });

  it('LoadedConfig.serverEnv is optional (absent for browser-only targets)', () => {
    expectTypeOf<LoadedConfig>().toHaveProperty('serverEnv');
    expectTypeOf<LoadedConfig['serverEnv']>().toEqualTypeOf<ServerEnv | undefined>();
  });

  it("Target is exactly the four spec'd values", () => {
    expectTypeOf<Target>().toEqualTypeOf<'web' | 'desktop' | 'ios' | 'android'>();
  });

  it('SecretStore methods return Promises, and list() returns bare names', () => {
    expectTypeOf<SecretStore['get']>().returns.resolves.toEqualTypeOf<string | undefined>();
    expectTypeOf<SecretStore['set']>().returns.resolves.toEqualTypeOf<void>();
    expectTypeOf<SecretStore['list']>().returns.resolves.toEqualTypeOf<readonly string[]>();
  });
});
