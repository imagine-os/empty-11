/**
 * Audience id grammar, in its own module so `audience.ts` (which needs `segmentSchema`) and
 * `segment.ts` (which needs `audienceIdSchema` for `{ audience: id }` leaves) both import it
 * without importing each other.
 *
 * `^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.<segment>)*$` — kebab-case segments joined by dots. Built-ins are
 * single kebab-case ids (`customer-pro`); the dotted form is the namespace for derived families
 * (`customer.<tier>`, `staff.<staffRole>`, `agent.<character>`).
 */
import { z } from 'zod';

export const AUDIENCE_ID_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/;

/** A validated audience id. Plain string at the type level; the grammar is enforced at boundaries. */
export type AudienceId = string;

export const audienceIdSchema = z
  .string()
  .regex(
    AUDIENCE_ID_PATTERN,
    'audience ids are kebab-case segments joined by dots, e.g. "customer-pro" or "agent.forge"',
  );

export function isAudienceId(value: unknown): value is AudienceId {
  return typeof value === 'string' && AUDIENCE_ID_PATTERN.test(value);
}
