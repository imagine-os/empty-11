/**
 * Read-side helpers over a validated `PageSpec`: the actions registry entries
 * the WebMCP surface and the voice controller consume, and the placeholder list
 * dev mode marks.
 */
import type { Component } from './schema/components.js';
import type { WiredStatus } from './schema/logic.js';
import type { PageSpec } from './schema/page.js';
import { type MessageKey, messageKeyOf, type PermissionRef } from './schema/refs.js';

export interface PageActionEntry {
  /** Registry id: `<pageId>.<actionId>` (`customer-invoices.payInvoice`). */
  id: string;
  page: string;
  action: string;
  route: string;
  /** Message key of the intent phrase; resolve per locale in the catalog. */
  intent: MessageKey;
  /** English seed of the intent phrase, when the spec supplied one. */
  intentDefault?: string;
  permission: PermissionRef;
  status: WiredStatus;
  /** Parameter names and scalar types, for the WebMCP tool signature. */
  input: Record<string, string>;
  /** Component keys whose events bind to this action. */
  boundTo: string[];
}

/** Flatten `logic.actions` into registry entries. Deterministic order: declaration order. */
export function pageActions(spec: PageSpec): PageActionEntry[] {
  const bindings = new Map<string, string[]>();
  const visit = (component: Component): void => {
    for (const action of Object.values(component.events)) {
      const list = bindings.get(action) ?? [];
      list.push(component.key);
      bindings.set(action, list);
    }
    for (const child of component.children) visit(child);
  };
  for (const component of spec.components) visit(component);

  return Object.entries(spec.logic.actions).map(([action, entry]) => {
    const item: PageActionEntry = {
      id: `${spec.meta.id}.${action}`,
      page: spec.meta.id,
      action,
      route: spec.meta.route,
      intent: messageKeyOf(entry.intent),
      permission: entry.permission,
      status: entry.status,
      input: { ...entry.input },
      boundTo: bindings.get(action) ?? [],
    };
    if (typeof entry.intent === 'object' && entry.intent.default !== undefined) {
      item.intentDefault = entry.intent.default;
    }
    return item;
  });
}

export interface NotWiredEntry {
  kind: 'component' | 'action';
  key: string;
  id: string;
  path: string;
}

/** Every placeholder on the page: components and actions with `status: not-wired`. */
export function notWiredComponents(spec: PageSpec): NotWiredEntry[] {
  const out: NotWiredEntry[] = [];
  const visit = (component: Component, path: string): void => {
    if (component.status === 'not-wired') {
      out.push({ kind: 'component', key: component.key, id: component.id, path });
    }
    component.children.forEach((child, i) => {
      visit(child, `${path}.children[${i}]`);
    });
  };
  spec.components.forEach((component, i) => {
    visit(component, `components[${i}]`);
  });
  for (const [name, action] of Object.entries(spec.logic.actions)) {
    if (action.status === 'not-wired') {
      out.push({
        kind: 'action',
        key: name,
        id: `${spec.meta.id}.${name}`,
        path: `logic.actions.${name}`,
      });
    }
  }
  return out;
}
