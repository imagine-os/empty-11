/**
 * `ShellSearch` — the panel-state search-param schema (PAP-16 Interface contract).
 *
 * `?inspector=open&sidebar=collapsed` on any route. Validated with Zod 4;
 * anything invalid or missing falls back to the documented default rather
 * than throwing, per the Definition of done ("Invalid search params fall
 * back to defaults") and the Test plan ("`ShellSearch` fallbacks on invalid
 * values").
 */
import { z } from 'zod';

export const INSPECTOR_DEFAULT = 'closed' as const;
export const SIDEBAR_DEFAULT = 'expanded' as const;

const shellSearchSchema = z.object({
  // `.catch()` covers both an invalid value and a missing key (`undefined`
  // fails the bare enum check too), so one operator gives us both defaulting
  // and fallback-on-invalid.
  inspector: z.enum(['open', 'closed']).catch(INSPECTOR_DEFAULT),
  sidebar: z.enum(['expanded', 'collapsed']).catch(SIDEBAR_DEFAULT),
});

export type ShellSearch = z.infer<typeof shellSearchSchema>;

/**
 * Parses raw search params (as TanStack Router hands `validateSearch`, or any
 * unknown record) into a fully-defaulted `ShellSearch`. `.catch()` per field
 * means one bad value (e.g. `?inspector=sideways`) falls back to that
 * field's default without discarding the rest of the object.
 */
export function parseShellSearch(input: unknown): ShellSearch {
  const result = shellSearchSchema.safeParse(input);
  if (result.success) return result.data;
  // Not even an object (e.g. `null`, a string): every field falls back.
  return { inspector: INSPECTOR_DEFAULT, sidebar: SIDEBAR_DEFAULT };
}

/**
 * `validateSearch` for `createRootRoute`. Typed to return `Partial<ShellSearch>`
 * (not the fully-defaulted `ShellSearch`) on purpose: TanStack Router infers a
 * route's search params as link-optional only when every field in the
 * validated type is itself optional, and `?inspector=`/`?sidebar=` should
 * never be mandatory on a `<Link>`. The value actually returned at runtime is
 * always fully defaulted (same `parseShellSearch` every other caller gets) —
 * `useShellSearch()` and `<AppShell search>` already read it with `??`
 * fallbacks, so nothing downstream needs to change if this ever turns fully
 * required again (e.g. once PAP-116 model this as a first-class contract).
 */
export function validateShellSearch(input: Record<string, unknown>): Partial<ShellSearch> {
  return parseShellSearch(input);
}
