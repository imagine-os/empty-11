/**
 * `@paperos/core` barrel — contract-zero primitives every other package may import.
 *
 * Ownership: app-shell owns this file. Other modules add sub-folders
 * (`audience/`, `filter/`, `events/`, `types/`, `modules/`, `pwa/`, `windows/`,
 * `native/`, `flags/`, `i18n/`) and re-export them from here only with an
 * app-shell review. See `README.md` for the table.
 */

/** Version of the PaperOS platform contract this checkout implements. */
export const PAPEROS_VERSION = '0.1.0' as const;

/** Domain events: envelope, topic registry, transactional outbox `publish()` (PAP-555, ADR 0013). */
export * from './events/index.js';

export * from './filter/index.js';
