/**
 * `access` section — INTERIM shape. PAP-116 owns the final schema, compiler
 * (`toPolicies`) and rules; it extends this file in place. The keys below are
 * the ones PAP-116's Spec already fixes, so specs written today keep validating.
 */
import { z } from 'zod';
import { FilterTreeSchema } from './filter.js';
import { ActionRef, AudienceId, EntityId } from './refs.js';

export const AccessActionSchema = z
  .strictObject({
    audiences: z.array(AudienceId).min(1).describe('Audiences allowed to run the action.'),
    condition: FilterTreeSchema.optional().describe(
      'Row or attribute condition that must hold, `{ $var: "principal.id" }` allowed.',
    ),
  })
  .meta({ id: 'AccessAction', description: 'Who may run one `logic.actions` entry.' });

export const AccessSectionSchema = z
  .strictObject({
    public: z
      .boolean()
      .default(false)
      .describe(
        '`true` grants the `anonymous` audience `page.view`; conflicts with `principal.*` refs.',
      ),
    view: z.array(AudienceId).default([]).describe('Audiences granted `page.view`.'),
    actions: z
      .record(ActionRef, AccessActionSchema)
      .default({})
      .describe('Per-action grants; keys must exist under `logic.actions`.'),
    rows: z
      .record(EntityId, FilterTreeSchema)
      .default({})
      .describe(
        'Row predicates per entity, merged into every query (PAP-119) and enforced server-side.',
      ),
    deny: z
      .array(AudienceId)
      .default([])
      .describe('Audiences denied everything on this page; beats every grant.'),
    fields: z
      .record(
        z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9]*$/, 'use `entity.field`'),
        z.strictObject({ view: z.array(AudienceId).min(1) }),
      )
      .default({})
      .describe('Field-level visibility, `entity.field` → audiences.'),
    inherit: z
      .boolean()
      .default(true)
      .describe('Merge `app.spec.yaml` `defaults.access`; `false` starts from nothing.'),
  })
  .meta({
    id: 'AccessSection',
    description: 'Who can see the page and run its actions (interim; final shape PAP-116).',
  });

export type AccessSection = z.output<typeof AccessSectionSchema>;
export type AccessSectionInput = z.input<typeof AccessSectionSchema>;
