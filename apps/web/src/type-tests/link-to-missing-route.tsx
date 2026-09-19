/**
 * Type-only fixture, compiled by `tsc --noEmit` (the `typecheck` script),
 * never run by Vitest. Definition of done: "a typed `Link` to a missing
 * route fails typecheck." `@ts-expect-error` asserts that `to="/nope"` is a
 * type error against the generated route tree (`routeTree.gen.ts`); if a
 * future change makes `/nope` compile, this file itself fails typecheck
 * (the expectation no longer holds), which is the point — this check cannot
 * silently rot.
 */
import { Link } from '@tanstack/react-router';

export function LinkTypeChecks() {
  return (
    <>
      <Link to="/dashboard">valid route, compiles</Link>
      {
        // @ts-expect-error '/nope' is not a route in routeTree.gen.ts.
        <Link to="/nope">invalid route, must fail typecheck</Link>
      }
    </>
  );
}
