import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSpec } from './parse.js';
import { notWiredComponents, pageActions } from './registry.js';

const source = readFileSync(
  resolve(import.meta.dirname, '../fixtures/valid/customer-invoices.spec.yaml'),
  'utf8',
);
const result = parseSpec(source);
if (!result.ok) throw new Error('fixture must parse');
const spec = result.value;

describe('pageActions', () => {
  it('flattens logic.actions into registry entries with id, intent, permission and bindings', () => {
    const entries = pageActions(spec);
    expect(entries.map((e) => e.id)).toEqual([
      'customer-invoices.openInvoice',
      'customer-invoices.payInvoice',
      'customer-invoices.downloadPdf',
      'customer-invoices.retryLoad',
    ]);
    expect(entries[1]).toEqual({
      id: 'customer-invoices.payInvoice',
      page: 'customer-invoices',
      action: 'payInvoice',
      route: '/invoices',
      intent: 'customer-invoices.actions.payInvoice.intent',
      intentDefault: 'pay invoice',
      permission: 'invoice.pay',
      status: 'wired',
      input: { invoiceId: 'uuid' },
      boundTo: ['payButton'],
    });
    expect(entries[2]?.status).toBe('not-wired');
    expect(entries[2]).not.toHaveProperty('intentDefault');
    expect(entries[0]?.boundTo).toEqual(['invoiceTable']);
  });
});

describe('notWiredComponents', () => {
  it('lists placeholder components and actions with their paths', () => {
    expect(notWiredComponents(spec)).toEqual([
      { kind: 'component', key: 'pdfButton', id: 'ui.button', path: 'components[1].children[1]' },
      {
        kind: 'action',
        key: 'downloadPdf',
        id: 'customer-invoices.downloadPdf',
        path: 'logic.actions.downloadPdf',
      },
    ]);
  });
});
