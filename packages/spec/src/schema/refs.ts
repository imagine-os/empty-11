/**
 * Reference grammars shared by every section of a page spec.
 *
 * Each ref is a Zod 4 string schema with a regex, registered with a stable `id`
 * so the generated JSON Schema names it under `$defs` and editors show the
 * grammar on hover. The regex sources are exported because the validator maps
 * a Zod `invalid_format` issue back to a `SPEC_*` code by pattern.
 */
import { z } from 'zod';

/** Kebab-case identifier: page ids, edge-case ids, owners, audiences. */
export const KEBAB_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** camelCase identifier: action ids, component keys, query and mutation names. */
export const CAMEL_ID_RE = /^[a-z][a-zA-Z0-9]*$/;
/** Component id grammar agreed with PAP-74 (`ui.button`, `app.invoiceCard`, `print.header`). */
export const COMPONENT_REF_RE = /^(?:ui|app|print)\.[a-z][A-Za-z0-9]*$/;
/** TanStack route: `/`, `/invoices`, `/invoices/$invoiceId/edit`. `:param` is rejected on purpose. */
export const ROUTE_REF_RE =
  /^\/$|^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*|\$[a-zA-Z][a-zA-Z0-9]*)(?:\/(?:[a-z0-9]+(?:-[a-z0-9]+)*|\$[a-zA-Z][a-zA-Z0-9]*))*\/?$/;
/** External destination for `events[].kind: external`. */
export const EXTERNAL_URL_RE = /^https?:\/\/[^\s]+$/;
/**
 * Message catalog key: `<specId>.<path>` such as `customer-invoices.states.empty.copy`.
 * At least one dot, no spaces: a literal sentence never matches, which is the point.
 */
export const MESSAGE_KEY_RE = /^[a-z][a-z0-9-]*(?:\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
/** Permission needed to run an action: `public`, `page.view`, `invoice.pay`, `settings.members.invite`. */
export const PERMISSION_RE = /^(?:public|[a-z][a-z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+)$/;
/** Component event name as PAP-74 registers them: `onClick`, `onChange`, `onRowSelect`. */
export const EVENT_NAME_RE = /^on[A-Z][a-zA-Z0-9]*$/;
/**
 * Source of a transition: an action id (fires when the action succeeds), `key.onEvent`
 * (a component event that navigates without logic) or the lifecycle hooks `page.load` / `page.leave`.
 */
export const EVENT_SOURCE_RE =
  /^(?:[a-z][a-zA-Z0-9]*(?:\.on[A-Z][a-zA-Z0-9]*)?|page\.(?:load|leave))$/;
/** Entity id from `app.spec.yaml` (PAP-117): `invoice`, `line-item`. */
export const ENTITY_ID_RE = KEBAB_ID_RE;
/** Field path inside an entity: `status`, `customer.email`. */
export const FIELD_PATH_RE = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/;

export const KebabId = z
  .string()
  .regex(KEBAB_ID_RE, 'kebab-case identifier expected (lowercase letters, digits, single dashes)')
  .meta({ id: 'KebabId', description: 'Kebab-case identifier: `customer-invoices`.' });

export const CamelId = z
  .string()
  .regex(CAMEL_ID_RE, 'camelCase identifier expected (starts with a lowercase letter)')
  .meta({ id: 'CamelId', description: 'camelCase identifier: `payInvoice`.' });

export const ComponentRef = z
  .string()
  .regex(COMPONENT_REF_RE, 'component id must be `ui.<name>`, `app.<name>` or `print.<name>`')
  .meta({
    id: 'ComponentRef',
    description:
      'Design-system component id registered by PAP-74: `ui.dataTable`, `app.invoiceCard`, `print.header`.',
  });

export const RouteRef = z
  .string()
  .regex(ROUTE_REF_RE, 'route must be an absolute TanStack path using `$param` segments')
  .meta({
    id: 'RouteRef',
    description:
      'Absolute TanStack route with `$param` segments: `/invoices/$invoiceId`. `:param` is rejected.',
  });

export const ExternalUrl = z
  .string()
  .regex(EXTERNAL_URL_RE, 'external destination must be an http(s) URL')
  .meta({ id: 'ExternalUrl', description: 'http(s) URL for `events[].kind: external`.' });

export const MessageKey = z
  .string()
  .regex(
    MESSAGE_KEY_RE,
    'user-visible text must be a message catalog key such as `customer-invoices.states.empty.copy`, not a literal string',
  )
  .meta({
    id: 'MessageKey',
    description:
      'Message catalog key (`<specId>.<path>`) resolved in every locale; never a literal sentence.',
  });

export const MessageRef = z
  .union([
    MessageKey,
    z.strictObject({
      id: MessageKey.describe('Message catalog key.'),
      default: z
        .string()
        .optional()
        .describe(
          'Source-locale (English) text the catalog is seeded with; never rendered directly.',
        ),
    }),
  ])
  .meta({
    id: 'MessageRef',
    description:
      'User-visible text as a message key, or `{ id, default }` where `default` seeds the English catalog (PAP-375).',
  });

export const PermissionRef = z
  .string()
  .regex(PERMISSION_RE, 'permission must be `public` or dotted like `invoice.pay`')
  .meta({
    id: 'PermissionRef',
    description: 'Permission the caller needs: `public`, `page.view`, `invoice.pay`.',
  });

export const ActionRef = z
  .string()
  .regex(
    CAMEL_ID_RE,
    'action reference must be the camelCase key of an entry under `logic.actions`',
  )
  .meta({
    id: 'ActionRef',
    description: 'Key of an entry under `logic.actions` on the same page.',
  });

export const EventName = z
  .string()
  .regex(EVENT_NAME_RE, 'component event must be named `on<Event>`')
  .meta({ id: 'EventName', description: 'Component event as registered by PAP-74: `onClick`.' });

export const EventSource = z
  .string()
  .regex(
    EVENT_SOURCE_RE,
    'transition source must be an action id, `componentKey.onEvent`, `page.load` or `page.leave`',
  )
  .meta({
    id: 'EventSource',
    description:
      'What fires a transition: an action id, `componentKey.onEvent`, `page.load` or `page.leave`.',
  });

export const AudienceId = z
  .string()
  .regex(KEBAB_ID_RE, 'audience id must be kebab-case (`customer`, `staff-admin`, `anonymous`)')
  .meta({
    id: 'AudienceId',
    description: 'Audience id from `app.spec.yaml` (PAP-117) / the audience model (PAP-55).',
  });

export const EntityId = z
  .string()
  .regex(ENTITY_ID_RE, 'entity id must be kebab-case (`invoice`, `line-item`)')
  .meta({ id: 'EntityId', description: 'Entity id from `app.spec.yaml` (PAP-117).' });

export const FieldPath = z
  .string()
  .regex(FIELD_PATH_RE, 'field path must be dotted camelCase (`customer.email`)')
  .meta({
    id: 'FieldPath',
    description: 'Field path inside an entity: `status`, `customer.email`.',
  });

/** Shell slots a component can target (PAP-16 `SlotName` plus the public/kiosk `header` and `footer`). */
export const SLOT_NAMES = [
  'nav',
  'sidebar',
  'main',
  'inspector',
  'commandbar',
  'statusbar',
  'header',
  'footer',
] as const;

export const SlotName = z.enum(SLOT_NAMES).meta({
  id: 'SlotName',
  description:
    'Layout slot: the six app-shell slots of PAP-16 plus `header` and `footer` for public and kiosk templates.',
});

export type KebabId = z.infer<typeof KebabId>;
export type CamelId = z.infer<typeof CamelId>;
export type ComponentRef = z.infer<typeof ComponentRef>;
export type RouteRef = z.infer<typeof RouteRef>;
export type ExternalUrl = z.infer<typeof ExternalUrl>;
export type MessageKey = z.infer<typeof MessageKey>;
export type MessageRef = z.infer<typeof MessageRef>;
export type PermissionRef = z.infer<typeof PermissionRef>;
export type ActionRef = z.infer<typeof ActionRef>;
export type EventName = z.infer<typeof EventName>;
export type EventSource = z.infer<typeof EventSource>;
export type AudienceId = z.infer<typeof AudienceId>;
export type EntityId = z.infer<typeof EntityId>;
export type FieldPath = z.infer<typeof FieldPath>;
export type SlotName = z.infer<typeof SlotName>;

/** Resolve a `MessageRef` to its catalog key. */
export function messageKeyOf(ref: MessageRef): MessageKey {
  return typeof ref === 'string' ? ref : ref.id;
}
