/**
 * Schema barrel: every PaperOS table plus the shared column helpers they are all built from.
 * PAP-302 lands `_shared.ts`; PAP-555 lands `events.ts`; PAP-32 adds the remaining tables.
 */

export * from './_shared.js';
export * from './events.js';
