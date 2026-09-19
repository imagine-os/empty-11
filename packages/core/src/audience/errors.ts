import type { AudienceId } from './audience.js';

/** Base class of every error this module throws. Attribute lookups never throw; references may. */
export class AudienceError extends Error {
  override name = 'AudienceError';
}

/** A segment referenced an audience id the registry does not know. */
export class UnknownAudienceError extends AudienceError {
  override name = 'UnknownAudienceError';
  constructor(public readonly audienceId: AudienceId) {
    super(`unknown audience "${audienceId}"`);
  }
}

/** Audience references form a cycle. `path` is the cycle, first id repeated at the end. */
export class AudienceCycleError extends AudienceError {
  override name = 'AudienceCycleError';
  constructor(public readonly path: readonly AudienceId[]) {
    super(`audience reference cycle: ${path.join(' -> ')}`);
  }
}
