/**
 * `@paperos/core` barrel — contract-zero primitives every other package may import.
 *
 * Ownership: app-shell owns this file. It is a **curated barrel**: it re-exports
 * sub-folder indexes (`./<folder>/index.js`) and nothing else, so a sub-folder
 * owner decides what leaves their folder and the barrel stays a one-line change.
 * Rule R12 of the boundary lint fails an import of a file inside a sub-folder
 * from here. Sub-folder owners are in `README.md` and `ownership.json`; adding a
 * folder to this list needs an app-shell review (Interface & Data Contracts §5).
 */

export * from './devices/index.js';
export * from './modules/index.js';

/** Version of the PaperOS platform contract this checkout implements. */
export const PAPEROS_VERSION = '0.1.0' as const;

/** Audience model: principals, roles, segments, audiences and matching (identity, PAP-55, ADR 0017). */
export * from './audience/index.js';

/** Domain events: envelope, topic registry, transactional outbox `publish()` (PAP-555, ADR 0013). */
export * from './events/index.js';

/** Filter and condition grammar (data-layer, PAP-279, ADR 0012). */
export * from './filter/index.js';

/** Shared value types and wire encodings (data-layer, PAP-302, ADR 0011). */
export * from './types/index.js';

/**
 * `./events` (PAP-555) and `./types` (PAP-302) both export these names. The shared value
 * types are the canonical spelling (ADR 0011), so the root barrel re-exports them from there
 * explicitly and the two `export *` lines stop being ambiguous (TS2308);
 * `@paperos/core/events` keeps its own copies on its subpath.
 */
export {
  type ActorRef,
  actorRefSchema,
  type EntityRef,
  entityRefSchema,
  formatEntityKey,
  isoDateTimeSchema,
  type Uuid,
  uuidSchema,
  uuidv7,
} from './types/index.js';
