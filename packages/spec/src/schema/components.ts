/**
 * `components`: the component tree. Every node names a registered component id
 * (PAP-74), a page-unique `key`, the slot it renders in and the actions its
 * events bind to. `status: not-wired` marks a placeholder so dev mode can flag it.
 */
import { z } from 'zod';
import { WiredStatus } from './logic.js';
import { ActionRef, CamelId, ComponentRef, EventName, SlotName } from './refs.js';

export interface Component {
  id: ComponentRef;
  key: CamelId;
  props: Record<string, unknown>;
  slot: SlotName;
  events: Record<string, ActionRef>;
  status: WiredStatus;
  children: Component[];
}

export interface ComponentInput {
  id: ComponentRef;
  key: CamelId;
  props?: Record<string, unknown> | undefined;
  slot?: SlotName | undefined;
  events?: Record<string, ActionRef> | undefined;
  status?: WiredStatus | undefined;
  children?: ComponentInput[] | undefined;
}

export const ComponentSchema: z.ZodType<Component, ComponentInput> = z
  .strictObject({
    id: ComponentRef.describe('Registered component id.'),
    key: CamelId.describe('Page-unique key; codegen, tours and comments anchor on it.'),
    props: z
      .record(z.string(), z.unknown())
      .default({})
      .describe(
        'Props as JSON; text-bearing props take a `MessageRef`. Validated against the registry by PAP-115.',
      ),
    slot: SlotName.default('main').describe('Layout slot the component renders in.'),
    events: z
      .record(EventName, ActionRef)
      .default({})
      .describe('Component event → action id under `logic.actions`.'),
    status: WiredStatus.default('wired').describe('`not-wired` marks a placeholder.'),
    get children() {
      return z.array(ComponentSchema).default([]).describe('Nested components.');
    },
  })
  .meta({ id: 'Component', description: 'One node of the component tree.' });

export const ComponentsSectionSchema = z
  .array(ComponentSchema)
  .meta({ id: 'ComponentsSection', description: 'Component tree of the page.' });

export type ComponentsSection = z.output<typeof ComponentsSectionSchema>;
