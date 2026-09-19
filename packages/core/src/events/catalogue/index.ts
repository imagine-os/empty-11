/**
 * The initial topic catalogue: every topic named in Interface & Data Contracts section 3, plus
 * `flags.changed` (runtime flags) and `permission.changed` (PAP-591).
 *
 * Importing this module **registers** the topics — `packages/core/src/events/index.ts` does that
 * for every consumer. Producers are placeholders until the owning issue merges; the owner replaces
 * `status: 'placeholder'` with `'live'` in the same commit that starts publishing.
 *
 * This file is also where the catalogue's payload types reach `on()` and `publish()`: the
 * `TopicMap` augmentation at the bottom is what makes `on('invoice.paid', h)` infer `h`'s payload.
 */
import type { z } from 'zod';
import { agentTopics } from './agents.js';
import { commerceTopics } from './commerce.js';
import { contentTopics } from './content.js';
import { engagementTopics } from './engagement.js';
import { platformTopics } from './platform.js';
import { tenancyTopics } from './tenancy.js';

export * from './agents.js';
export * from './commerce.js';
export * from './content.js';
export * from './engagement.js';
export * from './platform.js';
export * from './tenancy.js';

export const catalogue = {
  ...tenancyTopics,
  ...agentTopics,
  ...contentTopics,
  ...platformTopics,
  ...commerceTopics,
  ...engagementTopics,
} as const;

export type Catalogue = typeof catalogue;

type PayloadOf<T> = T extends { readonly schema: z.ZodType<infer P> } ? P : never;

/** `{ 'invoice.paid': { invoiceId: string, ... }, ... }` — derived, never hand-written. */
export type CataloguePayloads = { [K in keyof Catalogue]: PayloadOf<Catalogue[K]> };

declare module '../registry.js' {
  interface TopicMap extends CataloguePayloads {}
}
