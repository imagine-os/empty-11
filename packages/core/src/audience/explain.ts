/**
 * `explainPrincipal` — which audiences a principal belongs to and why. Backs the demo
 * CLI (`pnpm --filter @paperos/core audience explain`) and PAP-59's non-production `explain`.
 */
import type { AudienceId } from './audience.js';
import type { Principal } from './principal.js';
import type { AudienceRegistry } from './registry.js';
import { BUILTIN_REGISTRY } from './registry.js';

export type AudienceExplanation = {
  id: AudienceId;
  name: string;
  matches: boolean;
  /** The audience's segment in words, from `describe`. */
  because: string;
};

export function explainPrincipal(
  principal: Principal,
  registry: AudienceRegistry = BUILTIN_REGISTRY,
): AudienceExplanation[] {
  return registry.ids.map((id) => {
    const audience = registry.get(id);
    return {
      id,
      name: audience?.name ?? id,
      matches: registry.matches(principal, id),
      because: audience ? registry.describe(audience.match) : id,
    };
  });
}
