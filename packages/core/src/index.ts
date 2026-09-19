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

/**
 * Typed env schemas, `loadConfig()`, `SecretStore` per target (PAP-17). Also reachable directly
 * as `@paperos/core/config` — prefer that subpath in a browser/webview app (`apps/web`,
 * `apps/desktop`'s webview, `apps/mobile`'s webview): it is exactly the same module, this line only
 * exists to satisfy rule R12 (the barrel re-exports `./<folder>/index.js`, nothing deeper).
 * `docs/platform/config.md` §5 covers why importing only the public accessors still tree-shakes
 * the server-only schema out of a real (minified) client build either way.
 */
export * from './config/index.js';
/** Domain events: envelope, topic registry, transactional outbox `publish()` (PAP-555, ADR 0013). */
export * from './events/index.js';
export * from './filter/index.js';
