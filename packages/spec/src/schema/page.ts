/**
 * `PageSpecSchema`: the canonical `page.spec.yaml` shape, v1 (ADR 0015).
 *
 * Sections: meta, purpose, logic, access, data, integrations, layout, components,
 * states, events, edgeCases. The v1.1 keys (`flags`, `modules`, `comments`,
 * `help`, `seo`, `budgets`) parse as unknown so early writers are not rejected;
 * `x-*` keys pass through untouched; any other top-level key is an error.
 *
 * The schema alone does not know about files, positions or cross-references.
 * `validatePageSpec` / `parseSpec` add the `status: ready` gate, reference
 * resolution (`SPEC_ACTION_UNBOUND`, duplicate keys) and line/column positions.
 */
import { z } from 'zod';
import { AccessSectionSchema } from './access.js';
import { ComponentsSectionSchema } from './components.js';
import { DataSectionSchema } from './data.js';
import { IntegrationsSectionSchema } from './integrations.js';
import { LogicSectionSchema } from './logic.js';
import {
  ActionRef,
  CamelId,
  ComponentRef,
  EventSource,
  ExternalUrl,
  KebabId,
  MessageRef,
  RouteRef,
  SlotName,
} from './refs.js';

export const CURRENT_SPEC_VERSION = 1 as const;

export const SURFACES = ['customer', 'staff', 'developer', 'agent', 'public'] as const;
export const SPEC_STATUSES = ['draft', 'ready', 'built', 'deprecated'] as const;
export const LAYOUT_TEMPLATES = ['app', 'public', 'focus', 'kiosk'] as const;
export const KNOWN_STATES = ['loading', 'empty', 'error', 'offline', 'denied'] as const;
export const EDGE_CASE_TESTS = ['unit', 'e2e', 'manual'] as const;
export const EVENT_KINDS = ['navigate', 'replace', 'modal', 'external'] as const;

/** Top-level keys reserved for v1.1 (PAP-740). Parsed as unknown with `SPEC_RESERVED_KEY`. */
export const RESERVED_KEYS = ['flags', 'modules', 'comments', 'help', 'seo', 'budgets'] as const;

export const Surface = z.enum(SURFACES).meta({
  id: 'Surface',
  description: 'Who the page is for; picks the default layout, audiences and shell.',
});

export const SpecStatus = z.enum(SPEC_STATUSES).meta({
  id: 'SpecStatus',
  description: '`draft` → `ready` (gate rules apply) → `built` → `deprecated`.',
});

export const MetaSchema = z
  .strictObject({
    id: KebabId.describe('Page id; equals the file name stem of `specs/pages/<id>.spec.yaml`.'),
    title: MessageRef.describe('Page title as a message key.'),
    description: z.string().optional().describe('Author-facing summary, not rendered.'),
    route: RouteRef.describe('Route the page mounts at.'),
    surface: Surface,
    owner: KebabId.describe('Owning project or character (`spec-builder`, `quill`).'),
    status: SpecStatus.default('draft'),
    specVersion: z
      .literal(CURRENT_SPEC_VERSION)
      .default(CURRENT_SPEC_VERSION)
      .describe('Schema version; missing is read as 1 with a warning.'),
    tags: z.array(KebabId).default([]).describe('Free tags for the spec list and graph filters.'),
  })
  .meta({ id: 'Meta', description: 'Identity of the page.' });

export const PurposeSchema = z
  .strictObject({
    summary: z.string().min(1).describe('One paragraph: who uses the page and what they get done.'),
    successMetric: z
      .string()
      .min(1)
      .optional()
      .describe('How we know the page works (a measurable outcome).'),
  })
  .meta({ id: 'Purpose', description: 'Why the page exists.' });

export const SlotSpecSchema = z
  .strictObject({
    title: MessageRef.optional().describe('Slot heading when the shell shows one.'),
    collapsible: z.boolean().default(false),
    defaultCollapsed: z.boolean().default(false),
  })
  .meta({ id: 'SlotSpec', description: 'Options for one layout slot the page fills.' });

export const LayoutSchema = z
  .strictObject({
    template: z
      .enum(LAYOUT_TEMPLATES)
      .describe(
        '`app` shell with nav; `public` marketing chrome; `focus` single task; `kiosk` full-screen, 10-foot type.',
      ),
    slots: z
      .partialRecord(SlotName, SlotSpecSchema)
      .default({})
      .describe('Slots the page fills and their options; components target them with `slot`.'),
    density: z
      .enum(['compact', 'default', 'comfortable'])
      .default('default')
      .describe('Default density; `kiosk` templates should use `comfortable`.'),
  })
  .meta({ id: 'Layout', description: 'Template and slots.' });

export const StateSchema = z
  .strictObject({
    copy: MessageRef.describe('Copy shown in this state, as a message key.'),
    component: ComponentRef.optional().describe(
      'Component that renders the state (`ui.errorState`, `ui.offlineBanner`, `ui.deniedState`, PAP-234).',
    ),
    action: ActionRef.optional().describe(
      'Call to action, an id under `logic.actions` (retry, create first item).',
    ),
  })
  .meta({ id: 'State', description: 'One page state.' });

export const StatesSectionSchema = z
  .record(
    CamelId.describe(
      'State name: `loading`, `empty`, `error`, `offline`, `denied` or a custom camelCase name.',
    ),
    StateSchema,
  )
  .meta({
    id: 'StatesSection',
    description:
      'Page states: the five standard ones plus custom states, each `{ copy, component?, action? }`.',
  });

export const TransitionSchema = z
  .strictObject({
    on: EventSource.describe('What fires the transition.'),
    to: z
      .union([RouteRef, ExternalUrl])
      .describe('Destination route (`$param` syntax) or, with `kind: external`, an http(s) URL.'),
    guard: z.string().min(1).optional().describe('Condition, as prose or an expression.'),
    kind: z
      .enum(EVENT_KINDS)
      .default('navigate')
      .describe('`navigate` push, `replace`, `modal` overlay, `external` new tab.'),
  })
  .meta({ id: 'Transition', description: 'A navigation edge on the flow graph (PAP-123).' });

export const EdgeCaseSchema = z
  .strictObject({
    id: KebabId.describe('Stable id, unique on the page.'),
    scenario: z.string().min(1).describe('What happens.'),
    expected: z.string().min(1).describe('What the page must do.'),
    test: z.enum(EDGE_CASE_TESTS).describe('How it is verified.'),
    action: ActionRef.optional().describe('Action involved, if one.'),
  })
  .meta({ id: 'EdgeCase', description: 'One edge case the page handles.' });

const reserved = z.unknown().optional();

const PageSpecObject = z
  .object({
    meta: MetaSchema,
    purpose: PurposeSchema,
    logic: LogicSectionSchema.default({ actions: {} }),
    access: AccessSectionSchema.optional().describe('Required for `status: ready`.'),
    data: DataSectionSchema.optional().describe(
      'Required for `status: ready` unless `x-static: true`.',
    ),
    integrations: IntegrationsSectionSchema.default([]),
    layout: LayoutSchema,
    components: ComponentsSectionSchema.default([]),
    states: StatesSectionSchema.default({}),
    events: z.array(TransitionSchema).default([]).describe('Navigation transitions.'),
    edgeCases: z.array(EdgeCaseSchema).default([]).describe('At least three for `status: ready`.'),
    flags: reserved.describe('Reserved for v1.1 (PAP-740).'),
    modules: reserved.describe('Reserved for v1.1 (PAP-740).'),
    comments: reserved.describe('Reserved for v1.1 (PAP-740).'),
    help: reserved.describe('Reserved for v1.1 (PAP-740).'),
    seo: reserved.describe('Reserved for v1.1 (PAP-740).'),
    budgets: reserved.describe('Reserved for v1.1 (PAP-740).'),
  })
  .catchall(z.unknown());

/** Known top-level keys, including the reserved v1.1 ones. */
export const PAGE_SPEC_SHAPE = PageSpecObject.shape;
export const PAGE_SPEC_KEYS = Object.keys(PAGE_SPEC_SHAPE) as ReadonlyArray<
  keyof typeof PAGE_SPEC_SHAPE
>;

export const PageSpecSchema = PageSpecObject.superRefine((value, ctx) => {
  for (const key of Object.keys(value)) {
    if (key in PAGE_SPEC_SHAPE || key.startsWith('x-')) continue;
    ctx.addIssue({
      code: 'custom',
      path: [key],
      message: `unknown top-level key \`${key}\`; prefix extensions with \`x-\``,
      params: { code: 'SPEC_UNKNOWN_KEY' },
    });
  }
}).meta({
  title: 'PaperOS page spec v1',
  description: 'PaperOS page spec v1 (`specs/pages/<id>.spec.yaml`, ADR 0015).',
});

export type PageSpec = z.output<typeof PageSpecSchema>;
export type PageSpecInput = z.input<typeof PageSpecSchema>;
export type Meta = z.output<typeof MetaSchema>;
export type Purpose = z.output<typeof PurposeSchema>;
export type Layout = z.output<typeof LayoutSchema>;
export type State = z.output<typeof StateSchema>;
export type StatesSection = z.output<typeof StatesSectionSchema>;
export type Transition = z.output<typeof TransitionSchema>;
export type EdgeCase = z.output<typeof EdgeCaseSchema>;
export type Surface = z.infer<typeof Surface>;
export type SpecStatus = z.infer<typeof SpecStatus>;
