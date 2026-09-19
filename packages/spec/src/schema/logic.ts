/**
 * `logic.actions`: the page's actions registry.
 *
 * Every action declares `intent` (the phrase a person says or types to run it,
 * as a message key so it exists in English and Spanish), `permission` (what the
 * caller needs) and `steps`. The actions registry, the WebMCP surface and the
 * voice controller read these entries; codegen binds component `events` to them.
 */
import { z } from 'zod';
import { ActionRef, MessageRef, PermissionRef, RouteRef, ScalarTypeForInput } from './shared.js';

export const WIRED_STATUSES = ['wired', 'not-wired'] as const;

export const WiredStatus = z.enum(WIRED_STATUSES).meta({
  id: 'WiredStatus',
  description:
    '`not-wired` marks a placeholder: dev mode shows it, activation shows the "not wired yet" toast.',
});

export const EffectSchema = z
  .union([
    z.string().min(1),
    z.strictObject({
      kind: z
        .enum(['mutation', 'navigate', 'notify', 'emit', 'integration', 'job'])
        .describe('What the effect touches; drives graph edges (PAP-123).'),
      ref: z
        .string()
        .min(1)
        .optional()
        .describe('Mutation name, route, event topic, capability id or job name.'),
      copy: MessageRef.optional().describe('Notification copy, when `kind: notify`.'),
    }),
  ])
  .meta({
    id: 'Effect',
    description:
      'Side effect of an action: prose, or `{ kind, ref?, copy? }` when it should show on the flow graph.',
  });

export const OnErrorSchema = z
  .strictObject({
    strategy: z
      .enum(['toast', 'inline', 'retry', 'redirect', 'ignore'])
      .describe('How the failure surfaces.'),
    copy: MessageRef.optional().describe('Copy shown for `toast` and `inline`.'),
    to: RouteRef.optional().describe('Destination for `redirect`.'),
  })
  .meta({ id: 'OnError', description: 'Failure handling for one action.' });

export const ActionSchema = z
  .strictObject({
    intent: MessageRef.describe(
      'Intent phrase for the voice controller and WebMCP, as a message key (`customer-invoices.actions.pay.intent`).',
    ),
    permission: PermissionRef.describe('Permission required to run the action.'),
    description: z.string().optional().describe('Author-facing note, not rendered.'),
    steps: z.array(z.string().min(1)).min(1).describe('What happens, in order, as prose.'),
    guard: z
      .string()
      .min(1)
      .optional()
      .describe('Precondition as prose or an expression (PAP-314 compiles it).'),
    effects: z.array(EffectSchema).default([]).describe('Side effects.'),
    onError: OnErrorSchema.optional(),
    input: z
      .record(ActionRef, ScalarTypeForInput)
      .default({})
      .describe('Parameters the action takes, for the WebMCP tool signature.'),
    status: WiredStatus.default('wired').describe('`not-wired` while the logic is a stub.'),
  })
  .meta({ id: 'Action', description: 'One registered page action.' });

export const LogicSectionSchema = z
  .strictObject({
    actions: z
      .record(ActionRef, ActionSchema)
      .default({})
      .describe('Actions keyed by camelCase id.'),
  })
  .meta({ id: 'LogicSection', description: 'Actions registry of the page.' });

export type Action = z.output<typeof ActionSchema>;
export type ActionInput = z.input<typeof ActionSchema>;
export type LogicSection = z.output<typeof LogicSectionSchema>;
export type WiredStatus = z.infer<typeof WiredStatus>;
